# Backend Setup

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run start:dev
```

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pulse?schema=public"
JWT_SECRET="your-secret-key-min-32-chars"
REDIS_HOST="localhost"
REDIS_PORT="6379"
FRONTEND_URL="http://localhost:3000"
PORT="4000"
```

## Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run start:prod` - Start production server
- `npm run build` - Build the application
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:push` - Push schema to database (for prototyping)

## Testing Endpoints

### Health Check
```bash
curl http://localhost:4000
```

### Get Current User (Protected)
```bash
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Sync User (Protected)
```bash
curl -X POST http://localhost:4000/auth/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": "https://..."
  }'
```

## Database Management

```bash
# Open Prisma Studio (GUI)
npx prisma studio

# Create new migration
npm run prisma:migrate -- --name your_migration_name

# Reset database
npx prisma migrate reset
```

## Architecture

```
src/
├── auth/          # Authentication & authorization
├── prisma/        # Database service
├── redis/         # Redis presence service  
├── websocket/     # Socket.io gateway
├── app.module.ts  # Root module
└── main.ts        # Application entry
```
