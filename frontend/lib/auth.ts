import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import * as jwt from 'jsonwebtoken';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  pages: {
    signIn: '/auth/signin',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      // Generate custom JWT for backend
      if (token.id) {
        const secret = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';
        token.backendToken = jwt.sign(
          {
            sub: token.id,
            email: token.email,
            name: token.name,
          },
          secret,
          { expiresIn: '7d' }
        );
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.backendToken = token.backendToken as string;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, account, profile }) {
      console.log('✅ User signed in:', user.email);
    },
  },
};
