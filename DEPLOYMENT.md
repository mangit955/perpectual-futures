# Deployment Guide

This guide will help you deploy the Flux trading platform.

## Prerequisites

1. A deployed backend API (see Backend Deployment below)
2. Vercel account (for frontend deployment)
3. Backend URL (both HTTP and WebSocket)

## Backend Deployment 

### Option 1: Railway / Render / Fly.io

1. Deploy the backend from `/apps/api`
2. Set environment variables:
  ```
   NODE_ENV=production
   PORT=3000
   RUNTIME_MODE=production
   DATABASE_URL=your-postgres-url
   REDIS_URL=your-redis-url
   JWT_SECRET=your-secret-key
   PASSWORD_PEPPER=your-pepper-key
   SNAPSHOT_DIR=/app/snapshots
   SNAPSHOT_INTERVAL_MS=60000
  ```
3. Note down your deployed URL (e.g., `https://flux-api.railway.app`)

### Option 2: VPS (DigitalOcean, AWS, etc.)

1. SSH into your VPS
2. Install Bun: `curl -fsSL https://bun.sh/install | bash`
3. Clone the repo and install dependencies
4. Set up PostgreSQL and Redis
5. Configure environment variables in `.env`
6. Run: `bun run apps/api/src/index.ts`
7. Set up reverse proxy (nginx) for HTTPS and WebSocket support

## Frontend Deployment (Vercel)

### Step 1: Prepare Configuration

1. **Update `.env.production`** with your backend URLs:
  ```bash
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   NEXT_PUBLIC_WS_URL=wss://your-backend-url.com/ws
   NEXT_PUBLIC_USE_REAL_API=true
  ```

### Step 2: Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to web app
cd apps/web

# Deploy
vercel

# For production deployment
vercel --prod
```

#### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Root Directory** to `apps/web`
4. Add environment variables in Vercel dashboard:
  - `NEXT_PUBLIC_API_URL` = `https://your-backend-url.com`
  - `NEXT_PUBLIC_WS_URL` = `wss://your-backend-url.com/ws`
  - `NEXT_PUBLIC_USE_REAL_API` = `true`
5. Deploy

### Step 3: Configure Backend CORS

Update your backend CORS configuration in `apps/api/src/app.ts`:

```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://your-vercel-domain.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
```

For multiple domains (dev + prod):

```typescript
const allowedOrigins = [
  "http://localhost:3001",
  "https://your-vercel-domain.vercel.app"
];

const origin = request.headers.get("origin");
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
```

## Verification

After deployment, verify:

1. ✅ Frontend loads without errors
2. ✅ Can register/login
3. ✅ WebSocket connection established (check browser console)
4. ✅ Can place orders
5. ✅ Can cancel orders
6. ✅ Real-time updates working

## Troubleshooting

### WebSocket Connection Failed

- Ensure your backend supports WebSocket upgrades
- Check that WSS (not WS) is used in production
- Verify WebSocket path is `/ws`

### CORS Errors

- Update backend CORS headers with your frontend domain
- Ensure preflight OPTIONS requests return 204

### Orders Not Updating

- Check browser console for WebSocket errors
- Verify `NEXT_PUBLIC_USE_REAL_API=true`
- Check backend logs for order processing

### Environment Variables Not Working

- Vercel: Re-deploy after adding environment variables
- Local: Restart dev server after changing `.env.local`
- Ensure variables start with `NEXT_PUBLIC_` for client-side access

## Development vs Production URLs

### Local Development

```bash
# Backend: http://localhost:3000
# Frontend: http://localhost:3001
# WebSocket: ws://localhost:3000/ws
```

### Production

```bash
# Backend: https://your-api-domain.com
# Frontend: https://your-app.vercel.app
# WebSocket: wss://your-api-domain.com/ws
```

## Quick Reference

### Check Current Configuration

```bash
# In web app
echo $NEXT_PUBLIC_API_URL
echo $NEXT_PUBLIC_WS_URL
```

### Test Backend API

```bash
curl https://your-backend-url.com/health
# Should return: {"ok":true}
```

### Test WebSocket (using wscat)

```bash
npm i -g wscat
wscat -c wss://your-backend-url.com/ws
# Should connect successfully
```

