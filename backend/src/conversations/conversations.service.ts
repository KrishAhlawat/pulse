import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto) {
    const { userIds, isGroup = false, name } = dto;

    // Validate group requirements
    if (isGroup && !name) {
      throw new BadRequestException('Group conversations must have a name');
    }

    if (isGroup && userIds.length < 2) {
      throw new BadRequestException('Group conversations must have at least 2 members');
    }

    if (!isGroup && userIds.length !== 1) {
      throw new BadRequestException('1-to-1 conversations must have exactly 1 other user');
    }

    // Ensure all users exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more users not found');
    }

    // For 1-to-1: Check if conversation already exists
    if (!isGroup) {
      const otherUserId = userIds[0];
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: [userId, otherUserId] },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
              sender: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      // Check if it's actually a 1-1 between these two users
      if (existingConversation && existingConversation.members.length === 2) {
        const memberIds = existingConversation.members.map((m) => m.userId).sort();
        const targetIds = [userId, otherUserId].sort();
        
        if (JSON.stringify(memberIds) === JSON.stringify(targetIds)) {
          return this.formatConversationResponse(existingConversation);
        }
      }
    }

    // Create new conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup,
        name: isGroup ? name : null,
        members: {
          create: [
            { userId, role: isGroup ? 'admin' : 'member' },
            ...userIds.map((id) => ({ userId: id, role: 'member' })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return this.formatConversationResponse(conversation);
  }

  async findAllForUser(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conv) => this.formatConversationResponse(conv));
  }

  async findOne(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is a member
    const isMember = conversation.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return this.formatConversationResponse(conversation);
  }

  async validateMembership(conversationId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    return !!member;
  }

  private formatConversationResponse(conversation: any) {
    const lastMessage = conversation.messages[0] || null;

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      name: conversation.name,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      members: conversation.members.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            type: lastMessage.type,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender,
          }
        : null,
    };
  }
}
