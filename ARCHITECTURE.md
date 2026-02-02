# 🏗️ System Architecture Diagram

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                         PULSE CHAT SYSTEM                               │
│                   Phase 1: Authentication & Identity                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Complete Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER (Browser)                             │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│  │   Sign In Page  │────▶│   Dashboard     │     │  Protected      │         │
│  │  (Google OAuth) │     │  (User Info)    │     │   Routes        │          │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘          │
│           │                       │                        │                  │
│           │                       │                        │                  │
│           ▼                       ▼                        ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │                      Next.js 15 (App Router)                    │          │
│  │                                                                 │          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │          │
│  │  │  NextAuth.js │  │ Socket.io    │  │  REST API    │           │          │
│  │  │   (OAuth)    │  │   Client     │  │   Client     │           │          │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │          │
│  │         │                 │                  │                  │          │
│  └─────────┼─────────────────┼──────────────────┼──────────────────┘          │
│            │                 │                  │                             │
│            │       JWT Token │                  │                             │
│            │                 │                  │                             │
└────────────┼─────────────────┼──────────────────┼──────────────────────────── ┘
             │                 │                  │
             │                 │                  │
    ┌────────▼─────────────────▼──────────────────▼──────────┐
    │                    INTERNET                            │
    └────────┬─────────────────┬──────────────────┬──────────┘
             │                 │                  │
             │                 │                  │
┌────────────▼─────────────────▼──────────────────▼────────────────────────────┐
│                          BACKEND LAYER (NestJS)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │                       API Gateway / CORS                         │        │
│  └──────────────────────┬───────────────────────────────────────────┘        │
│                         │                                                    │
│         ┌───────────────┼───────────────┐                                    │
│         │               │               │                                    │
│         ▼               ▼               ▼                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                             │
│  │    Auth     │ │  WebSocket  │ │   Global    │                             │
│  │   Module    │ │   Gateway   │ │  Pipes/     │                             │
│  │             │ │             │ │  Filters    │                             │
│  └──────┬──────┘ └──────┬──────┘ └─────────────┘                             │
│         │               │                                                    │
│  ┌──────▼──────┐ ┌──────▼──────┐                                             │
│  │   Auth      │ │   Socket    │                                             │
│  │  Controller │ │   Handler   │                                             │
│  │             │ │             │                                             │
│  │ POST /sync  │ │ connect()   │                                             │
│  │ GET  /me    │ │ disconnect()│                                             │
│  └──────┬──────┘ └──────┬──────┘                                             │
│         │               │                                                    │
│  ┌──────▼───────────────▼──────┐                                             │
│  │       Auth Service          │                                             │
│  │                             │                                             │
│  │  • validateToken()          │                                             │
│  │  • syncUser()               │                                             │
│  │  • getUserById()            │                                             │
│  │  • updateLastSeen()         │                                             │
│  └──────┬────────────┬─────────┘                                             │
│         │            │                                                       │
│         │            │                                                       │
│  ┌──────▼──────┐ ┌──▼──────────┐                                             │
│  │   Prisma    │ │    Redis    │                                             │
│  │   Service   │ │   Service   │                                             │
│  │             │ │             │                                             │
│  │ • Database  │ │ • Presence  │                                             │
│  │   Queries   │ │   Tracking  │                                             │
│  └──────┬──────┘ └──┬──────────┘                                             │
│         │            │                                                       │
└─────────┼────────────┼───────────────────────────────────────────────────────┘
          │            │
          │            │
┌─────────▼────────────▼───────────────────────────────────────────────────────┐
│                        DATA LAYER                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐        │
│  │      PostgreSQL Database    │      │         Redis Cache         │        │
│  │         (Supabase)          │      │                             │        │
│  ├─────────────────────────────┤      ├─────────────────────────────┤        │
│  │                             │      │                             │        │
│  │  Tables:                    │      │  Keys:                      │        │
│  │  • users                    │      │  • user:{id}:online         │        │
│  │  • accounts                 │      │                             │        │
│  │  • sessions                 │      │  TTL: 60 seconds            │        │
│  │  • verification_tokens      │      │                             │        │
│  │                             │      │  Features:                  │        │
│  │  Features:                  │      │  • Online/offline status    │        │
│  │  • User persistence         │      │  • Heartbeat extension      │        │
│  │  • OAuth accounts           │      │  • Presence tracking        │        │
│  │  • Session management       │      │                             │        │
│  │  • Prisma ORM               │      │                             │        │
│  └─────────────────────────────┘      └─────────────────────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌──────────┐                                                    ┌──────────┐
│          │  1. Click "Sign in with Google"                    │          │
│  Client  │───────────────────────────────────────────────────▶│ NextAuth │
│ (Browser)│                                                    │          │
└──────────┘                                                    └────┬─────┘
     ▲                                                               │
     │                                                               │
     │  6. Redirect to /dashboard                                    │
     │     with session cookie                                       │
     │                                                               │
     │                                                          2. Redirect to
     │                                                             Google OAuth
     │                                                               │
     │                                                               ▼
     │                                                    ┌─────────────────┐
     │                                                    │                 │
     │                                5. Return with      │     Google      │
     │                                   user data        │   OAuth API     │
     │                                ◀──────────────────│                 │
     │                                                    └─────────────────┘
     │                                                               │
     │                                                               │
     │                                                          3. User approves
     │                                                               │
     │                                                               ▼
     │                                                    ┌─────────────────┐
     │                                                    │                 │
     │                                4. Auth callback    │    NextAuth     │
     │                                ◀──────────────────│    Handler      │
     │                                                    │                 │
     │                                                    └────┬────────────┘
     │                                                         │
     │                                                         │
     │                                                    5. Create session
     │                                                       Generate JWT
     │                                                         │
     │                                                         ▼
     │                                                    ┌────────────┐
     │                                                    │            │
     │                        7. Sync user                │  Database  │
     └────────────────────────────────────────────────────│  (Prisma)  │
                                                          │            │
                                                          └────────────┘
```

## API Request Flow

```
┌──────────┐                                                    ┌──────────┐
│          │  1. GET /auth/me                                   │          │
│  Client  │    Authorization: Bearer <JWT>                     │ NestJS   │
│          │───────────────────────────────────────────────────▶│ Backend  │
└──────────┘                                                    └────┬─────┘
     ▲                                                               │
     │                                                               │
     │  4. Return user data                                          │
     │     { id, email, name, avatar }                          2. Extract JWT
     │                                                               │
     │                                                               ▼
     │                                                    ┌─────────────────┐
     │                                                    │                 │
     │                                3. User found       │   Auth Guard    │
     │                                ◀──────────────────│  (JWT Verify)   │
     │                                                    │                 │
     │                                                    └────┬────────────┘
     │                                                         │
     │                                                         │
     │                                                    Validate token
     │                                                    Decode payload
     │                                                         │
     │                                                         ▼
     │                                                    ┌────────────┐
     │                                                    │            │
     │                                                    │   Auth     │
     └────────────────────────────────────────────────────│  Service   │
                                                          │            │
                                                          └─────┬──────┘
                                                                │
                                                           Query user
                                                                │
                                                                ▼
                                                          ┌────────────┐
                                                          │            │
                                                          │  Database  │
                                                          │            │
                                                          └────────────┘
```

## WebSocket Connection Flow

```
┌──────────┐                                                    ┌──────────┐
│          │  1. io.connect(backend)                            │          │
│  Client  │    auth: { token: JWT }                            │ Socket.io│
│          │───────────────────────────────────────────────────▶│ Gateway  │
└──────────┘                                                    └────┬─────┘
     ▲                                                               │
     │                                                               │
     │  5. emit('connected', { userId })                             │
     │                                                          2. Verify token
     │                                                               │
     │                                                               ▼
     │                                                    ┌─────────────────┐
     │                                                    │                 │
     │                                4. Token valid      │   Auth Service  │
     │                                ◀──────────────────│  (validateToken)│
     │                                                    │                 │
     │                                                    └────┬────────────┘
     │                                                         │
     │                                                         │
     │                                                    3. Validate JWT
     │                                                         │
     │                                                         ▼
     │                                                    ┌────────────┐
     │                                6. Set online       │            │
     │                                ◀──────────────────│   Redis    │
     │                                   status           │  Service   │
     │                                                    │            │
     │                                                    └────────────┘
     │                                                         │
     │                                                         │
     │                                              user:{id}:online = true
     │                                                    TTL: 60s
     │                                                         │
     │                                                         │
     │   Heartbeat every 30s ──────────────────────────────────┘
     │   (extends TTL)
     │
     │
     │  On disconnect:
     │  • Remove online status
     │  • Update lastSeen in database
     └──────────────────────────────────────────────────────────────────────┐
                                                                            │
                                                                            ▼
                                                                    ┌────────────┐
                                                                    │            │
                                                                    │  Database  │
                                                                    │            │
                                                                    └────────────┘
```

## Data Models

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            User Model                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User {                                                                 │
│    id:        String (UUID)  PRIMARY KEY                                │
│    email:     String         UNIQUE                                     │
│    name:      String                                                    │
│    avatar:    String?        OPTIONAL                                   │
│    createdAt: DateTime       DEFAULT now()                              │
│    lastSeen:  DateTime?      OPTIONAL                                   │
│  }                                                                      │
│                                                                         │
│  Relations:                                                             │
│  • Accounts (OAuth providers)                                           │
│  • Sessions (NextAuth sessions)                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         Redis Data Structure                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Key:   user:{userId}:online                                            │
│  Value: "true"                                                          │
│  TTL:   60 seconds                                                      │
│                                                                         │
│  Operations:                                                            │
│  • SET on connect                                                       │
│  • EXPIRE on heartbeat                                                  │
│  • DEL on disconnect                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Security Architecture                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: OAuth Authentication                                          │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  • Google OAuth 2.0                                           │      │
│  │  • Secure token exchange                                      │      │
│  │  • User consent required                                      │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                            │                                            │
│                            ▼                                            │
│  Layer 2: Session Management                                            │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  • NextAuth JWT sessions                                      │      │
│  │  • Secure httpOnly cookies                                    │      │
│  │  • 7-day expiration                                           │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                            │                                            │
│                            ▼                                            │
│  Layer 3: Backend Authentication                                        │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  • JWT verification                                           │      │
│  │  • Auth guard on routes                                       │      │
│  │  • Request user attachment                                    │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                            │                                            │
│                            ▼                                            │
│  Layer 4: WebSocket Security                                            │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  • Token required for connection                              │      │
│  │  • Connection rejection if invalid                            │      │
│  │  • User ID attached to socket                                 │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                            │                                            │
│                            ▼                                            │
│  Layer 5: Data Protection                                               │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  • Input validation                                           │      │
│  │  • SQL injection prevention (Prisma)                          │      │
│  │  • XSS protection                                             │      │
│  │  • CORS configuration                                         │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Scalability Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Horizontal Scaling Ready                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                │
│  │   Backend     │  │   Backend     │  │   Backend     │                │
│  │  Instance 1   │  │  Instance 2   │  │  Instance N   │                │
│  │  + Worker     │  │  + Worker     │  │  + Worker     │                │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘                │
│          │                  │                  │                        │
│          │     Stateless - No local state      │                        │
│          │                  │                  │                        │
│          └──────────────────┼──────────────────┘                        │
│                             │                                           │
│                             ▼                                           │
│                   ┌─────────────────┐                                   │
│                   │  Load Balancer  │                                   │
│                   └─────────┬───────┘                                   │
│                             │                                           │
│          ┌──────────────────┼──────────────────┐                        │
│          │                  │                  │                        │
│          ▼                  ▼                  ▼                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                │
│  │   Shared      │  │    Shared     │  │    Shared     │                │
│  │  PostgreSQL   │  │  Redis + MQ   │  │   Storage     │                │
│  └───────────────┘  └───────────────┘  └───────────────┘                │
│                                                                         │
│  Features:                                                              │
│  • Stateless backend instances                                          │
│  • Shared session store (Redis)                                         │
│  • Shared database (PostgreSQL)                                         │
│  • JWT tokens (no server-side session)                                  │
│  • BullMQ job queue for async tasks                                     │
│  • Ready for container orchestration                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Implementation Status

| Phase | Feature | Status | Documentation |
|-------|---------|--------|---------------|
| **Phase 1** | Authentication & JWT | ✅ Complete | Main docs |
| **Phase 2** | Conversations & Messages | ✅ Complete | Main docs |
| **Phase 3** | Real-time Messaging | ✅ Complete | Main docs |
| **Phase 4** | Typing & Read Receipts | ✅ Complete | Main docs |
| **Phase 5** | Media Messages (Supabase) | ✅ Complete | [PHASE5_MEDIA.md](backend/PHASE5_MEDIA.md) |
| **Phase 6** | Offline Notifications (BullMQ) | ✅ Complete | [PHASE6_NOTIFICATIONS.md](backend/PHASE6_NOTIFICATIONS.md) |
| **Phase 7** | Push Notifications (FCM) | 🔜 Planned | - |

---

**This architecture provides:**
- ✅ Secure authentication
- ✅ Scalable design
- ✅ Real-time capabilities
- ✅ Production readiness
- ✅ Clean separation of concerns
- ✅ Async job processing
- ✅ Offline notification support

