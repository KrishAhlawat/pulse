'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UserData {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  lastSeen: string | null;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Sync user with backend on mount
  useEffect(() => {
    if (session) {
      syncUser();
    }
  }, [session]);

  const syncUser = async () => {
    try {
      setSyncStatus('Syncing...');
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
      });
      
      if (response.ok) {
        setSyncStatus('Synced with backend');
        fetchUserData();
      } else {
        setSyncStatus('Sync failed');
      }
    } catch (err: any) {
      setError('Sync error: ' + err.message);
      setSyncStatus('Sync error');
    }
  };

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (err: any) {
      setError('Failed to fetch user data: ' + err.message);
    }
  };

  // WebSocket connection
  useEffect(() => {
    if (!session?.backendToken) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    
    const newSocket = io(backendUrl, {
      auth: {
        token: session.backendToken,
      },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('connected', (data) => {
      console.log('Connected event received:', data);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket error:', err.message);
      setError('WebSocket error: ' + err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [session?.backendToken]);

  const sendHeartbeat = () => {
    if (socket) {
      socket.emit('heartbeat', {}, (response: any) => {
        console.log('Heartbeat response:', response);
      });
    }
  };

  const sendPing = () => {
    if (socket) {
      socket.emit('ping', {}, (response: any) => {
        console.log('Ping response:', response);
      });
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Not authenticated</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Pulse Dashboard</h1>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="flex items-center gap-4 mb-4">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name}
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-lg">{session.user.name}</p>
              <p className="text-gray-600">{session.user.email}</p>
              <p className="text-sm text-gray-500">ID: {session.user.id}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <p>{syncStatus}</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span>
                WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={sendHeartbeat}
                disabled={!isConnected}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send Heartbeat
              </button>
              <button
                onClick={sendPing}
                disabled={!isConnected}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send Ping
              </button>
            </div>
          </div>
        </div>

        {/* Backend User Data */}
        {userData && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Backend User Data (/me)</h2>
            <div className="bg-gray-50 p-4 rounded">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(userData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Testing Checklist */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Testing Checklist</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✅</span>
              <span>Session persists (session.user.id available)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={userData ? 'text-green-500' : 'text-gray-400'}>
                {userData ? '✅' : '⬜'}
              </span>
              <span>/me API returns authenticated user</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={isConnected ? 'text-green-500' : 'text-gray-400'}>
                {isConnected ? '✅' : '⬜'}
              </span>
              <span>WebSocket connection authenticated</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={syncStatus.includes('✅') ? 'text-green-500' : 'text-gray-400'}>
                {syncStatus.includes('✅') ? '✅' : '⬜'}
              </span>
              <span>Backend user sync completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={isConnected ? 'text-green-500' : 'text-gray-400'}>
                {isConnected ? '✅' : '⬜'}
              </span>
              <span>Redis presence tracking active</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
