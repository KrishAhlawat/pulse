import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async send(userId: string, dto: SendMessageDto) {
    const { conversationId, content, type } = dto;

    // Validate conversation exists
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Validate sender is a member
    const isMember = conversation.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    // Create message and message statuses in a transaction
    const message = await this.prisma.$transaction(async (tx) => {
      // Create the message
      const newMessage = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content,
          type,
        },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });

      // Create message statuses for all members
      const statusData = conversation.members.map((member) => ({
        messageId: newMessage.id,
        userId: member.userId,
        // Sender's message is immediately delivered
        deliveredAt: member.userId === userId ? new Date() : null,
        readAt: null,
      }));

      await tx.messageStatus.createMany({
        data: statusData,
      });

      // Update conversation's updatedAt timestamp
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return newMessage;
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
      sender: message.sender,
    };
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    // Validate conversation exists
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Validate user is a member
    if (conversation.members.length === 0) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    // Build query with cursor-based pagination
    const where: any = { conversationId };

    if (cursor) {
      // Cursor is an ISO date string - fetch messages older than this
      where.createdAt = {
        lt: new Date(cursor),
      };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
        statuses: {
          select: {
            userId: true,
            deliveredAt: true,
            readAt: true,
          },
        },
      },
    });

    // Determine next cursor
    const nextCursor =
      messages.length === limit
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        content: msg.content,
        type: msg.type,
        createdAt: msg.createdAt,
        sender: msg.sender,
        statuses: msg.statuses,
      })),
      nextCursor,
      hasMore: messages.length === limit,
    };
  }

  async getMessageById(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
        statuses: {
          select: {
            userId: true,
            deliveredAt: true,
            readAt: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check membership
    if (message.conversation.members.length === 0) {
      throw new ForbiddenException('You do not have access to this message');
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
      sender: message.sender,
      statuses: message.statuses,
    };
  }
}
