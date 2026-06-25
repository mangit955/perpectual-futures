# 🚀 Deployment Checklist

Follow this step-by-step guide to deploy your Flux trading platform.

## ✅ Pre-Deployment Checklist

### Backend Setup

- [ ] Backend is deployed and accessible via HTTPS
- [ ] WebSocket endpoint is working (test with `wscat`)
- [ ] Database (PostgreSQL) is set up and accessible
- [ ] **Database has been initialized with migrations and seed data**
- [ ] Redis is set up and accessible
- [ ] Environment variables are configured on backend:
  - [ ] `DATABASE_URL`
  - [ ] `REDIS_URL`
  - [ ] `JWT_SECRET`
  - [ ] `PASSWORD_PEPPER`
  - [ ] `RUNTIME_MODE=production`
  - [ ] `SNAPSHOT_DIR=/app/snapshots`
  - [ ] `SNAPSHOT_INTERVAL_MS=60000`
  - [ ] `BINANCE_WS_URL=wss://fstream.binance.com/ws`
- [ ] Backend `/health` endpoint returns `{"ok":true}`
- [ ] CORS is configured to allow your frontend domain

### Frontend Setup

- [ ] `.env.production` file created with production URLs
- [ ] All environment variables are correct
- [ ] Configuration validated with `npm run check-config`
- [ ] Build succeeds locally with `npm run build`

## 📝 Step-by-Step Deployment

### Step 1: Deploy Backend First

1. **Choose your hosting provider:**
  - Railway (recommended for ease)
  - Render
  - Fly.io
  - DigitalOcean/AWS/Vercel (requires more setup)

2. **Provision infrastructure:**
  - PostgreSQL database
  - Redis instance

3. **Initialize the database:**
  
  **CRITICAL:** Run this BEFORE starting your application:
  
  ```bash
  # Option 1: Use the setup script
  ./scripts/setup-db.sh
  
  # Option 2: Manual setup
  cd packages/db
  bun run prisma:generate
  bun run prisma:deploy
  bun run db:seed
  ```
  
  This creates all database tables and adds seed data (markets, etc.).

4. **Deploy backend:**
  ```bash
   cd apps/api
   # Follow your provider's deployment instructions
  ```

5. **Test backend:**
  ```bash
   curl https://your-backend-url.com/health
   # Should return: {"ok":true}

   # Test WebSocket
   wscat -c wss://your-backend-url.com/ws
   # Should connect successfully
  ```
4. **Note your URLs:**
  - API URL: `https://your-backend-url.com`
  - WebSocket URL: `wss://your-backend-url.com/ws`

### Step 2: Configure Frontend

1. **Update `.env.production`:**
  ```bash
   cd apps/web
   nano .env.production
  ```
   Set:
2. **Validate configuration:**
  ```bash
   npm run check-config
  ```
3. **Test build locally:**
  ```bash
   npm run build
  ```

### Step 3: Deploy Frontend to Vercel

#### Option A: Vercel CLI (Recommended)

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Navigate to web app
cd apps/web

# Login to Vercel
vercel login

# Deploy preview
vercel

# Review and test preview deployment

# Deploy to production
vercel --prod
```

#### Option B: Vercel Dashboard

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure project:
  - **Framework Preset:** Next.js
  - **Root Directory:** `apps/web`
  - **Build Command:** `cd ../.. && turbo run build --filter=web`
  - **Output Directory:** `.next`
4. Add Environment Variables:
  - `NEXT_PUBLIC_API_URL` = `https://your-backend-url.com`
  - `NEXT_PUBLIC_WS_URL` = `wss://your-backend-url.com/ws`
  - `NEXT_PUBLIC_USE_REAL_API` = `true`
5. Click "Deploy"

### Step 4: Update Backend CORS

After deployment, update your backend to allow the frontend domain:

```typescript
// apps/api/src/app.ts
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://your-app.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
```

Or for multiple origins:

```typescript
const allowedOrigins = [
  "http://localhost:3001",
  "https://your-app.vercel.app",
  "https://your-custom-domain.com"
];

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
```

Redeploy backend after CORS update.

### Step 5: Verification

Test your deployed application:

1. **Open frontend URL** (e.g., `https://your-app.vercel.app`)
2. **Check browser console:**
  - [ ] No CORS errors
     [ ] WebSocket connection successful
     [ ] API requests working
3. **Test functionality:**
  - [ ] Can register a new account
     [ ] Can login
     [ ] Can see markets
     [ ] Can place an order
     [ ] Can cancel an order
     [ ] Orders update in real-time
     [ ] Positions display correctly
     [ ] WebSocket updates working

## 🐛 Troubleshooting

### Issue: Database Tables Don't Exist

**Symptoms:** 
- `The table 'public.markets' does not exist in the current database`
- Application crashes on startup
- "PrismaClientKnownRequestError" in logs

**Solutions:**

1. The database needs to be initialized. Run:
   ```bash
   ./scripts/setup-db.sh
   ```

2. Or manually:
   ```bash
   cd packages/db
   bun run prisma:generate  # Generate Prisma Client
   bun run prisma:deploy    # Create tables
   bun run db:seed          # Add seed data
   ```

3. Restart your application after database setup

### Issue: CORS Errors

**Solution:**

1. Add your frontend domain to backend CORS configuration
2. Redeploy backend
3. Clear browser cache
4. Try again

### Issue: WebSocket Connection Failed

**Symptoms:** `WebSocket connection failed` in console

**Solutions:**

1. Verify WebSocket URL uses `wss://` (not `ws://`)
2. Check backend logs for WebSocket errors
3. Test WebSocket directly: `wscat -c wss://your-backend-url.com/ws`
4. Ensure backend supports WebSocket upgrades

### Issue: Environment Variables Not Working

**Solutions:**

1. Verify variables start with `NEXT_PUBLIC_`
2. In Vercel dashboard, check environment variables are set
3. Redeploy after changing environment variables
4. Check browser console for the actual values: `console.log(process.env.NEXT_PUBLIC_API_URL)`

### Issue: Orders Not Cancelling

**Solutions:**

1. Check WebSocket is connected (browser console)
2. Check network tab for failed API requests
3. Verify backend is processing drain() calls
4. Check backend logs for errors
5. Verify token is valid (check localStorage)

### Issue: Build Fails

**Solutions:**

1. Run `npm run check-types` to find TypeScript errors
2. Check all dependencies are installed
3. Verify turbo.json configuration
4. Try building locally first: `npm run build`

## 📊 Post-Deployment Monitoring

After deployment, monitor:

1. **Vercel Analytics:** Check response times and errors
2. **Backend Logs:** Monitor for errors and warnings
3. **WebSocket Connections:** Ensure stable connections
4. **Database:** Monitor connection pool and query performance
5. **Redis:** Check memory usage and connection count

## 🔄 Continuous Deployment

Set up automatic deployments:

1. **Connect Git Repository to Vercel**
  - Push to `main` branch auto-deploys to production
  - Pull requests create preview deployments
2. **Environment Variables**
  - Production variables apply to `main` branch
  - Preview variables for PR deployments
3. **Backend CI/CD**
  - Set up auto-deploy on your hosting provider
  - Configure staging and production environments

## 🎉 Success!

Once all checks pass:

- ✅ Backend is live and healthy
- ✅ Frontend is deployed on Vercel
- ✅ CORS is configured correctly
- ✅ WebSocket connections work
- ✅ All features are functional

Your Flux trading platform is now live! 🚀

## 📞 Need Help?

- Check the [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions
- Review [apps/web/README.md](./apps/web/README.md) for frontend specifics
- Check browser console and network tab for errors
- Review backend logs for server-side issues

