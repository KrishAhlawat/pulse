# Frontend Setup

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
npm run dev
```

## Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pulse?schema=public"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-min-32-chars"

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
JWT_SECRET="same-as-backend-jwt-secret"
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret to `.env.local`

## Routes

- `/` - Landing page (redirects to signin or dashboard)
- `/auth/signin` - Sign in page
- `/dashboard` - Protected dashboard (requires authentication)

## Architecture

```
app/
├── api/
│   ├── auth/
│   │   ├── [...nextauth]/  # NextAuth handler
│   │   └── sync/           # Backend user sync
│   └── me/                 # Get current user
├── auth/
│   └── signin/             # Sign in page
├── dashboard/              # Protected pages
├── layout.tsx              # Root layout
└── page.tsx                # Home page
```

## Testing Authentication Flow

1. Navigate to http://localhost:3000
2. Click "Continue with Google"
3. Complete Google OAuth
4. Should redirect to `/dashboard`
5. Check:
   - User info displays correctly
   - WebSocket shows "Connected"
   - Backend sync status shows "✅ Synced"
