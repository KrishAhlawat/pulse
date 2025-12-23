import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import axios from 'axios';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

    const response = await axios.get(`${backendUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.backendToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Get user error:', error.message);
    return NextResponse.json(
      { error: 'Failed to get user', details: error.message },
      { status: 500 }
    );
  }
}
