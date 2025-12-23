import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import axios from 'axios';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

    // Sync user with backend
    const response = await axios.post(
      `${backendUrl}/auth/sync`,
      {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      {
        headers: {
          Authorization: `Bearer ${session.backendToken}`,
        },
      }
    );

    return NextResponse.json({
      success: true,
      user: response.data.user,
    });
  } catch (error: any) {
    console.error('Auth sync error:', error.message);
    return NextResponse.json(
      { error: 'Failed to sync user', details: error.message },
      { status: 500 }
    );
  }
}
