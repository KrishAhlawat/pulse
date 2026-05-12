import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { LoggerService } from '../logger/logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';
import {
  JoinConversationPayload,
  LeaveConversationPayload,
  SendMessagePayload,
  MessageReceivedPayload,
  RedisMessagePayload,
  TypingStartPayload,
  TypingStopPayload,
  MessageReadPayload,
  UserTypingPayload,
  MessageDeliveredPayload,
  MessageReadStatusPayload,
} from './events';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private authService: AuthService,
    private redisService: RedisService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private prismaService: PrismaService,
    private rateLimitService: RateLimitService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Initialize gateway and set up Redis message handler
   * This ensures all instances can receive and broadcast messages
   */
  afterInit(server: Server) {
    this.logger.info('ChatGateway initialized', LOG_CONTEXTS.WEBSOCKET);
    
    // Register Redis message handler for cross-instance broadcasting
    this.redisService.onMessage('chat:messages', async (payload: RedisMessagePayload) => {
      await this.handleRedisMessage(payload);
    });
  }

  /**
   * Handle new WebSocket connections with JWT authentication
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;

      if (!token) {
        this.logger.warn('Socket connection rejected: No token', LOG_CONTEXTS.WEBSOCKET);
        client.disconnect();
        return;
      }

      const user = await this.authService.validateToken(token);

      if (!user) {
        this.logger.warn('Socket connection rejected: Invalid token', LOG_CONTEXTS.WEBSOCKET);
        client.disconnect();
        return;
      }

      client.userId = user.id;
      
      // Set user online in Redis
      await this.redisService.setUserOnline(user.id);

      // Track active connections
      this.metrics.wsConnectionsActive.inc();

      this.logger.info('User connected', LOG_CONTEXTS.WEBSOCKET, { userId: user.id, email: user.email });
      
      // Notify user of successful connection
      client.emit('connected', {
        userId: user.id,
        message: 'Successfully connected',
      });
    } catch (error) {
      this.logger.error('Connection error', LOG_CONTEXTS.WEBSOCKET, { error: error.message });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections and cleanup
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      try {
        // Update last seen
        await this.authService.updateLastSeen(client.userId);
        
        // Set user offline in Redis
        await this.redisService.setUserOffline(client.userId);

        // Track active connections
        this.metrics.wsConnectionsActive.dec();
        
        this.logger.info('User disconnected', LOG_CONTEXTS.WEBSOCKET, { userId: client.userId });
      } catch (error) {
        this.logger.error('Disconnect error', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      }
    }
  }

  /**
   * Event: join_conversation
   * Allows a user to join a conversation room for real-time updates
   * 
   * Security: Validates user is a member before allowing join
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      const { conversationId } = payload;

      if (!conversationId) {
        throw new BadRequestException('conversationId is required');
      }

      // Validate user is a member of this conversation
      const isMember = await this.conversationsService.validateMembership(
        conversationId,
        client.userId,
      );

      if (!isMember) {
        throw new ForbiddenException('You are not a member of this conversation');
      }

      // Join the Socket.io room
      const roomName = `conversation:${conversationId}`;
      await client.join(roomName);

      this.logger.debug('User joined room', LOG_CONTEXTS.WEBSOCKET, { userId: client.userId, room: roomName });

      return {
        success: true,
        message: `Joined conversation ${conversationId}`,
        conversationId,
      };
    } catch (error) {
      this.logger.error('Error joining conversation', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Event: leave_conversation
   * Allows a user to leave a conversation room
   */
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveConversationPayload,
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      const { conversationId } = payload;

      if (!conversationId) {
        throw new BadRequestException('conversationId is required');
      }

      // Leave the Socket.io room
      const roomName = `conversation:${conversationId}`;
      await client.leave(roomName);

      this.logger.debug('User left room', LOG_CONTEXTS.WEBSOCKET, { userId: client.userId, room: roomName });

      return {
        success: true,
        message: `Left conversation ${conversationId}`,
        conversationId,
      };
    } catch (error) {
      this.logger.error('Error leaving conversation', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Event: send_message
   * Handles real-time message sending
   * 
   * Flow:
   * 1. Validate authentication
   * 2. Validate conversation membership
   * 3. Persist message to database (Phase 2 service)
   * 4. Publish to Redis for horizontal scaling
   * 5. Redis subscriber broadcasts to all conversation members
   * 
   * Security:
   * - JWT authentication required
   * - Membership validation enforced
   * - Never trust client payloads for userId
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      // Phase 7: Rate limit check before processing
      try {
        await this.rateLimitService.checkMessageRateLimit(client.userId);
      } catch (rateLimitError) {
        client.emit('rate_limit_error', {
          type: 'message',
          message: rateLimitError.message || 'Rate limit exceeded',
          retryAfter: 60,
        });
        return {
          success: false,
          error: rateLimitError.message || 'Rate limit exceeded',
        };
      }

      const { conversationId, content, type, mediaUrl, mediaMeta } = payload;

      // Validate payload
      if (!conversationId || !type) {
        throw new BadRequestException('conversationId and type are required');
      }

      if (!['text', 'image', 'video'].includes(type)) {
        throw new BadRequestException('type must be text, image, or video');
      }

      // Validate text messages have content
      if (type === 'text' && !content) {
        throw new BadRequestException('content is required for text messages');
      }

      // Validate media messages have mediaUrl
      if ((type === 'image' || type === 'video') && !mediaUrl) {
        throw new BadRequestException('mediaUrl is required for media messages');
      }

      // STEP 1: Persist message using Phase 2 service
      // This validates membership and creates message + statuses
      const message = await this.messagesService.send(client.userId, {
        conversationId,
        content,
        type,
        mediaUrl,
        mediaMeta,
      });

      this.logger.info('Message persisted', LOG_CONTEXTS.WEBSOCKET, {
        messageId: message.id,
        type,
        conversationId,
        userId: client.userId,
      });

      // Track WebSocket message metric
      this.metrics.wsMessagesTotal.inc({ event: 'send_message' });

      // STEP 2: Publish to Redis for horizontal scaling
      // All backend instances will receive this and broadcast to their connected clients
      const redisPayload: RedisMessagePayload = {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
      };

      await this.redisService.publishMessage(redisPayload);

      this.logger.debug('Message published to Redis', LOG_CONTEXTS.WEBSOCKET, { messageId: message.id });

      // Return success to sender
      return {
        success: true,
        message: 'Message sent',
        messageId: message.id,
      };
    } catch (error) {
      this.logger.error('Error sending message', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      this.metrics.wsErrorsTotal.inc();
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle incoming messages from Redis Pub/Sub
   * This method is called when ANY backend instance publishes a message
   * 
   * Responsibilities:
   * 1. Fetch full message from database (source of truth)
   * 2. Broadcast to conversation room on THIS instance
   * 3. Never re-persist (already done by sender)
   * 
   * Idempotency: Message ID serves as deduplication key
   */
  private async handleRedisMessage(payload: RedisMessagePayload) {
    try {
      const { messageId, conversationId, senderId } = payload;

      this.logger.debug('Received Redis message', LOG_CONTEXTS.WEBSOCKET, { messageId, conversationId });

      // Fetch full message from database (source of truth)
      const message = await this.prismaService.message.findUnique({
        where: { id: messageId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      if (!message) {
        this.logger.error('Message not found in database', LOG_CONTEXTS.WEBSOCKET, { messageId });
        return;
      }

      // Prepare payload for client
      const clientPayload: MessageReceivedPayload = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content || undefined,
        type: message.type,
        mediaUrl: message.mediaUrl || undefined,
        mediaMeta: message.mediaMeta || undefined,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          name: message.sender.name || '',
          email: message.sender.email,
          image: message.sender.image || undefined,
        },
      };

      // Broadcast to all clients in this conversation room on THIS instance
      const roomName = `conversation:${conversationId}`;
      this.server.to(roomName).emit('message_received', clientPayload);

      this.logger.debug('Broadcasted message to room', LOG_CONTEXTS.WEBSOCKET, { messageId, room: roomName });
    } catch (error) {
      this.logger.error('Error handling Redis message', LOG_CONTEXTS.WEBSOCKET, { error: error.message });
    }
  }

  /**
   * Heartbeat to maintain presence
   */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.userId) {
      await this.redisService.extendPresence(client.userId);
      return { status: 'ok' };
    }
  }

  /**
   * Ping-pong for connection health check
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  // ============================================
  // Phase 4: Typing Indicators + Receipts
  // ============================================

  /**
   * Event: typing_start
   * User started typing in a conversation
   * 
   * Flow:
   * 1. Validate authentication
   * 2. Validate conversation membership
   * 3. Broadcast to conversation room (except sender)
   * 
   * Important:
   * - Ephemeral: NO DATABASE WRITES
   * - Room-scoped: Only conversation members receive
   * - Throttled: Client should throttle (e.g., 500ms)
   */
  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingStartPayload,
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      // Phase 7: Typing event throttle (silent rejection)
      const typingAllowed = await this.rateLimitService.checkTypingRateLimit(client.userId);
      if (!typingAllowed) {
        return { success: false, error: 'Typing throttled' };
      }

      const { conversationId } = payload;

      if (!conversationId) {
        throw new BadRequestException('conversationId is required');
      }

      // Validate user is a member of this conversation
      const isMember = await this.conversationsService.validateMembership(
        conversationId,
        client.userId,
      );

      if (!isMember) {
        throw new ForbiddenException('You are not a member of this conversation');
      }

      // Get user name for display
      const user = await this.prismaService.user.findUnique({
        where: { id: client.userId },
        select: { name: true },
      });

      // Broadcast to room (except sender)
      const roomName = `conversation:${conversationId}`;
      const typingPayload: UserTypingPayload = {
        conversationId,
        userId: client.userId,
        userName: user?.name || 'Unknown',
      };

      client.to(roomName).emit('user_typing', typingPayload);

      this.metrics.wsMessagesTotal.inc({ event: 'typing_start' });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error('Error handling typing_start', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Event: typing_stop
   * User stopped typing in a conversation
   * 
   * Flow:
   * 1. Validate authentication
   * 2. Validate conversation membership
   * 3. Broadcast stop signal to room (except sender)
   * 
   * Important:
   * - Ephemeral: NO DATABASE WRITES
   * - Client should auto-send after timeout (e.g., 3s of inactivity)
   */
  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingStopPayload,
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      const { conversationId } = payload;

      if (!conversationId) {
        throw new BadRequestException('conversationId is required');
      }

      // Validate membership (lightweight check)
      const isMember = await this.conversationsService.validateMembership(
        conversationId,
        client.userId,
      );

      if (!isMember) {
        throw new ForbiddenException('You are not a member of this conversation');
      }

      // Broadcast stop to room (except sender)
      const roomName = `conversation:${conversationId}`;
      const typingPayload: UserTypingPayload = {
        conversationId,
        userId: client.userId,
        userName: '', // Not needed for stop event
      };

      client.to(roomName).emit('user_typing_stop', typingPayload);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error('Error handling typing_stop', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Event: message_delivered
   * Mark message(s) as delivered for the authenticated user
   * 
   * Flow:
   * 1. Client receives message_received
   * 2. Client immediately emits message_delivered
   * 3. Server updates MessageStatus.deliveredAt (idempotent)
   * 4. Server broadcasts to conversation room
   * 
   * Important:
   * - Idempotent: Don't overwrite existing deliveredAt
   * - Per-user: Each user has their own delivery status
   * - Sender gets delivery instantly (handled in send_message)
   */
  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string; messageId: string },
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      const { conversationId, messageId } = payload;

      if (!conversationId || !messageId) {
        throw new BadRequestException('conversationId and messageId are required');
      }

      // Validate membership
      const isMember = await this.conversationsService.validateMembership(
        conversationId,
        client.userId,
      );

      if (!isMember) {
        throw new ForbiddenException('You are not a member of this conversation');
      }

      // Update delivery status (idempotent)
      const now = new Date();
      await this.prismaService.messageStatus.updateMany({
        where: {
          messageId,
          userId: client.userId,
          deliveredAt: null, // Only update if not already delivered
        },
        data: {
          deliveredAt: now,
        },
      });

      // Broadcast delivery receipt to room
      const roomName = `conversation:${conversationId}`;
      const deliveryPayload: MessageDeliveredPayload = {
        conversationId,
        messageId,
        userId: client.userId,
        deliveredAt: now,
      };

      this.server.to(roomName).emit('message_delivered', deliveryPayload);

      this.logger.debug('Message delivered', LOG_CONTEXTS.WEBSOCKET, { messageId, userId: client.userId });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error('Error handling message_delivered', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Event: message_read
   * Mark message(s) as read for the authenticated user
   * 
   * Flow:
   * 1. User opens conversation or scrolls to message
   * 2. Client emits message_read with batch of message IDs
   * 3. Server updates MessageStatus.readAt in transaction
   * 4. Server broadcasts to conversation room
   * 
   * Important:
   * - Batch updates: Update multiple messages at once
   * - Transaction: All-or-nothing update
   * - Idempotent: Don't overwrite existing readAt
   * - Auto-delivery: Reading implies delivery
   */
  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MessageReadPayload,
  ) {
    try {
      if (!client.userId) {
        throw new UnauthorizedException('Not authenticated');
      }

      const { conversationId, messageIds } = payload;

      if (!conversationId || !messageIds || messageIds.length === 0) {
        throw new BadRequestException('conversationId and messageIds are required');
      }

      // Validate membership
      const isMember = await this.conversationsService.validateMembership(
        conversationId,
        client.userId,
      );

      if (!isMember) {
        throw new ForbiddenException('You are not a member of this conversation');
      }

      // Verify messages belong to this conversation
      const messages = await this.prismaService.message.findMany({
        where: {
          id: { in: messageIds },
          conversationId,
        },
        select: { id: true },
      });

      if (messages.length === 0) {
        throw new BadRequestException('No valid messages found');
      }

      const validMessageIds = messages.map((m) => m.id);
      const now = new Date();

      // Batch update in transaction
      // Set both deliveredAt and readAt (reading implies delivery)
      await this.prismaService.$transaction([
        // Update delivered (if not already)
        this.prismaService.messageStatus.updateMany({
          where: {
            messageId: { in: validMessageIds },
            userId: client.userId,
            deliveredAt: null,
          },
          data: {
            deliveredAt: now,
          },
        }),
        // Update read (if not already)
        this.prismaService.messageStatus.updateMany({
          where: {
            messageId: { in: validMessageIds },
            userId: client.userId,
            readAt: null,
          },
          data: {
            readAt: now,
          },
        }),
      ]);

      // Broadcast read receipt to room
      const roomName = `conversation:${conversationId}`;
      const readPayload: MessageReadStatusPayload = {
        conversationId,
        messageIds: validMessageIds,
        userId: client.userId,
        readAt: now,
      };

      this.server.to(roomName).emit('message_read', readPayload);

      this.logger.debug('Messages read', LOG_CONTEXTS.WEBSOCKET, {
        userId: client.userId,
        count: validMessageIds.length,
        conversationId,
      });

      return {
        success: true,
        messagesUpdated: validMessageIds.length,
      };
    } catch (error) {
      this.logger.error('Error handling message_read', LOG_CONTEXTS.WEBSOCKET, { error: error.message, userId: client.userId });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
