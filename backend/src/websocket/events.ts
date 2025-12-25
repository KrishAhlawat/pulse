// Socket.io Event Types for Phase 3: Real-Time Messaging

// Client → Server Events
export interface JoinConversationPayload {
  conversationId: string;
}

export interface LeaveConversationPayload {
  conversationId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'video';
}

// Server → Client Events
export interface MessageReceivedPayload {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

// Redis Pub/Sub Payload
export interface RedisMessagePayload {
  messageId: string;
  conversationId: string;
  senderId: string;
}
