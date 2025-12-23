import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      const secret = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';
      const decoded = jwt.verify(token, secret) as JwtPayload;

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        image: user.image || undefined,
      };
    } catch (error) {
      console.error('Token validation error:', error.message);
      return null;
    }
  }

  async syncUser(data: { id: string; email: string; name: string; image?: string }) {
    return this.prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        image: data.image,
      },
      create: {
        id: data.id,
        email: data.email,
        name: data.name,
        image: data.image,
      },
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        lastSeen: true,
      },
    });
  }

  async updateLastSeen(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    });
  }
}
