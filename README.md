# Pulse - Real-time Chat System (Phase 1: Authentication & Identity)

A production-ready real-time chat system built with Next.js, NestJS, Socket.io, and Redis.

> **👋 New here?** Start with **[Getting Started Guide](GETTING_STARTED.md)** for the best experience!

## 📚 Quick Links

- **[🚀 Quick Start Guide](QUICKSTART.md)** - Get running in 5 minutes
- **[📋 Setup Checklist](CHECKLIST.md)** - Interactive setup verification
- **[🔧 Environment Setup](ENVIRONMENT.md)** - Detailed configuration guide
- **[🧪 Testing Guide](TESTING.md)** - Complete test procedures
- **[🔍 Troubleshooting](TROUBLESHOOTING.md)** - Common errors and solutions
- **[📖 Documentation Index](DOCUMENTATION_INDEX.md)** - Navigate all docs
- **[📦 File Manifest](FILE_MANIFEST.md)** - All created files
- **[📊 Project Summary](PROJECT_SUMMARY.md)** - Implementation overview

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth**: NextAuth.js with Google OAuth
- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL (Supabase compatible)
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Cache/Presence**: Redis

## 📁 Project Structure

```
pulse/
├── backend/              # NestJS backend
│   ├── src/
│   │   ├── auth/        # Authentication module
│   │   ├── prisma/      # Database module
│   │   ├── redis/       # Redis presence module
│   │   ├── websocket/   # Socket.io gateway
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
└── frontend/            # Next.js frontend
    ├── app/
    │   ├── api/
    │   │   ├── auth/    # NextAuth endpoints
    │   │   └── me/      # User endpoint
    │   ├── auth/        # Auth pages
    │   ├── dashboard/   # Protected pages
    │   └── layout.tsx
    ├── lib/             # Utilities
    └── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ 
- PostgreSQL (or Supabase account)
- Redis server
- Google OAuth credentials

### 1. Clone and Setup

```bash
cd c:\CODING\webDev\pulse
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/pulse"
JWT_SECRET="your-strong-secret-key"
REDIS_HOST="localhost"
REDIS_PORT="6379"
FRONTEND_URL="http://localhost:3000"
```

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start backend
npm run start:dev
```

Backend runs on http://localhost:4000

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/pulse"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# Get from Google Cloud Console
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
JWT_SECRET="same-as-backend-jwt-secret"
```

```bash
# Generate Prisma client (frontend uses same schema)
npx prisma generate --schema=../backend/prisma/schema.prisma

# Start frontend
npm run dev
```

Frontend runs on http://localhost:3000

### 4. Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to `.env.local`

### 5. Start Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
# Windows: Download from https://github.com/microsoftarchive/redis/releases
# Mac: brew install redis && redis-server
# Linux: sudo apt-get install redis-server
```

## ✅ Testing the Implementation

### Phase 1 Success Criteria

Access http://localhost:3000 and test:

#### 1. Authentication Flow
- ✅ Click "Continue with Google"
- ✅ Authenticate with Google
- ✅ Should redirect to `/dashboard`
- ✅ Refresh page → session persists

#### 2. Session Check
- ✅ Check browser console: `session.user.id` should be visible
- ✅ User info displayed on dashboard

#### 3. Backend API
- ✅ `/me` endpoint returns user data
- ✅ Check dashboard "Backend User Data" section

#### 4. WebSocket Connection
- ✅ Green indicator shows "Connected"
- ✅ Backend logs: `✅ User connected: <userId>`
- ✅ Click "Send Ping" → should get pong response

#### 5. Redis Presence
- ✅ Backend logs confirm Redis connection
- ✅ Send heartbeat to extend presence

#### 6. Disconnect Behavior
- ✅ Close browser → backend logs disconnect
- ✅ `lastSeen` timestamp updated in database

### Manual API Testing

```bash
# 1. Login to get session token
# Copy backendToken from browser dev tools (Application → Cookies)

# 2. Test /me endpoint
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer YOUR_BACKEND_TOKEN"

# Expected: User object with id, email, name, avatar

# 3. Test without token (should fail)
curl http://localhost:4000/auth/me

# Expected: 401 Unauthorized
```

### Database Verification

```bash
cd backend
npx prisma studio
```

Check:
- Users table has your account
- `lastSeen` updates on disconnect

## 🔧 Troubleshooting

### "Database connection failed"
- Check PostgreSQL is running
- Verify `DATABASE_URL` in both `.env` files
- Run migrations: `npm run prisma:migrate`

### "Redis connection error"
- Ensure Redis is running: `redis-cli ping` (should return "PONG")
- Check `REDIS_HOST` and `REDIS_PORT`

### "Google OAuth error"
- Verify redirect URI in Google Console matches exactly
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure `NEXTAUTH_URL` matches your local URL

### "WebSocket won't connect"
- Check backend is running on port 4000
- Verify `NEXT_PUBLIC_BACKEND_URL` is correct
- Check browser console for errors

### "JWT verification failed"
- Ensure `JWT_SECRET` is identical in both `.env` files
- Token expires after 7 days (by default)

## 🧪 Testing Checklist

Run through this checklist:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Redis connection confirmed
- [ ] Database migrations applied
- [ ] Google OAuth login works
- [ ] Session persists on refresh
- [ ] `/me` API returns user data
- [ ] WebSocket connects successfully
- [ ] Backend logs show user connection
- [ ] Heartbeat/ping work
- [ ] Disconnect updates `lastSeen`
- [ ] Redis tracks online status

## 📝 What's Implemented (Phase 1)

✅ **Database Schema**
- User model with Prisma
- NextAuth tables (Session, Account, etc.)

✅ **Authentication**
- Google OAuth via NextAuth
- JWT-based sessions
- Frontend-backend token sync

✅ **Backend API**
- JWT verification guard
- `POST /auth/sync` - User synchronization
- `GET /auth/me` - Get current user

✅ **WebSocket**
- Socket.io with JWT authentication
- User ID attached to socket
- Connect/disconnect handlers

✅ **Redis Presence**
- Online/offline tracking
- TTL-based presence (60s)
- Heartbeat extension
- Last seen tracking

## 🚫 Not Implemented (Future Phases)

- ❌ Chat messages
- ❌ Conversations/Channels
- ❌ Groups
- ❌ Notifications
- ❌ File uploads
- ❌ Message queue (BullMQ)

## 📚 API Reference

### Backend Endpoints

#### `POST /auth/sync`
Sync authenticated user with backend database.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Body:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "avatar": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

#### `GET /auth/me`
Get current authenticated user.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "avatar": "https://...",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "lastSeen": "2024-01-01T00:00:00.000Z"
}
```

### WebSocket Events

#### Client → Server

**`heartbeat`**
```javascript
socket.emit('heartbeat');
// Response: { status: 'ok' }
```

**`ping`**
```javascript
socket.emit('ping');
// Response: { event: 'pong', data: { timestamp: 1234567890 } }
```

#### Server → Client

**`connected`**
```javascript
socket.on('connected', (data) => {
  console.log(data.userId); // Your user ID
});
```

## 🔐 Security Features

- ✅ JWT token verification on all protected routes
- ✅ WebSocket authentication required
- ✅ CORS configured for frontend origin
- ✅ Input validation with class-validator
- ✅ Secure session handling
- ✅ Token expiration (7 days)

## 🎯 Next Steps (Future Phases)

Phase 2 would include:
- Message schema and APIs
- Conversation/channel management
- Real-time message broadcasting
- Message persistence
- Read receipts
- Typing indicators

## 📄 License

MIT

## 🤝 Contributing

This is a learning/demonstration project for building production-ready real-time systems.

---

**Built with ❤️ using modern web technologies**
