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
import { RedisService } from '../redis/redis.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import {
  JoinConversationPayload,
  LeaveConversationPayload,
  SendMessagePayload,
  MessageReceivedPayload,
  RedisMessagePayload,
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
  ) {}

  /**
   * Initialize gateway and set up Redis message handler
   * This ensures all instances can receive and broadcast messages
   */
  afterInit(server: Server) {
    console.log('🔌 ChatGateway initialized');
    
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
        console.log('❌ Socket connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const user = await this.authService.validateToken(token);

      if (!user) {
        console.log('❌ Socket connection rejected: Invalid token');
        client.disconnect();
        return;
      }

      client.userId = user.id;
      
      // Set user online in Redis
      await this.redisService.setUserOnline(user.id);

      console.log(`✅ User connected: ${user.id} (${user.email})`);
      
      // Notify user of successful connection
      client.emit('connected', {
        userId: user.id,
        message: 'Successfully connected',
      });
    } catch (error) {
      console.error('Connection error:', error.message);
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
        
        console.log(`👋 User disconnected: ${client.userId}`);
      } catch (error) {
        console.error('Disconnect error:', error.message);
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

      console.log(`👥 User ${client.userId} joined room ${roomName}`);

      return {
        success: true,
        message: `Joined conversation ${conversationId}`,
        conversationId,
      };
    } catch (error) {
      console.error('Error joining conversation:', error.message);
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

      console.log(`👋 User ${client.userId} left room ${roomName}`);

      return {
        success: true,
        message: `Left conversation ${conversationId}`,
        conversationId,
      };
    } catch (error) {
      console.error('Error leaving conversation:', error.message);
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

      const { conversationId, content, type } = payload;

      // Validate payload
      if (!conversationId || !content || !type) {
        throw new BadRequestException('conversationId, content, and type are required');
      }

      if (!['text', 'image', 'video'].includes(type)) {
        throw new BadRequestException('type must be text, image, or video');
      }

      // STEP 1: Persist message using Phase 2 service
      // This validates membership and creates message + statuses
      const message = await this.messagesService.send(client.userId, {
        conversationId,
        content,
        type,
      });

      console.log(`💾 Message persisted: ${message.id} in conversation ${conversationId}`);

      // STEP 2: Publish to Redis for horizontal scaling
      // All backend instances will receive this and broadcast to their connected clients
      const redisPayload: RedisMessagePayload = {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
      };

      await this.redisService.publishMessage(redisPayload);

      console.log(`📡 Message published to Redis: ${message.id}`);

      // Return success to sender
      return {
        success: true,
        message: 'Message sent',
        messageId: message.id,
      };
    } catch (error) {
      console.error('Error sending message:', error.message);
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

      console.log(`📨 Received Redis message: ${messageId} for conversation ${conversationId}`);

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
        console.error(`Message ${messageId} not found in database`);
        return;
      }

      // Prepare payload for client
      const clientPayload: MessageReceivedPayload = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content || '',
        type: message.type,
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

      console.log(`📢 Broadcasted message ${messageId} to room ${roomName}`);
    } catch (error) {
      console.error('Error handling Redis message:', error);
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
}
