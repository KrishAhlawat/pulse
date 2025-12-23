import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private authService: AuthService,
    private redisService: RedisService,
  ) {}

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

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(client: AuthenticatedSocket) {
    if (client.userId) {
      await this.redisService.extendPresence(client.userId);
      return { status: 'ok' };
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: AuthenticatedSocket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }
}
