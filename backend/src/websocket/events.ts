// Socket.io Event Types for Phase 3 & 4: Real-Time Messaging + UX Signals

// ============================================
// Phase 3: Core Messaging Events
// ============================================

// Client → Server Events
export interface JoinConversationPayload {
  conversationId: string;
}

export interface LeaveConversationPayload {
  conversationId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  content?: string;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  mediaMeta?: {
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
  };
}

// Server → Client Events
export interface MessageReceivedPayload {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string;
  type: string;
  mediaUrl?: string;
  mediaMeta?: any;
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

// ============================================
// Phase 4: Typing Indicators + Receipts
// ============================================

// Client → Server Events
export interface TypingStartPayload {
  conversationId: string;
}

export interface TypingStopPayload {
  conversationId: string;
}

export interface MessageReadPayload {
  conversationId: string;
  messageIds: string[]; // Batch read support
}

// Server → Client Events
export interface UserTypingPayload {
  conversationId: string;
  userId: string;
  userName: string;
}

export interface MessageDeliveredPayload {
  conversationId: string;
  messageId: string;
  userId: string;
  deliveredAt: Date;
}

export interface MessageReadStatusPayload {
  conversationId: string;
  messageIds: string[];
  userId: string;
  readAt: Date;
}
