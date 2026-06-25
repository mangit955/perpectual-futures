# ⚡ Quick Start Guide

Get your Flux trading platform running in 5 minutes.

## 🎯 What You Need

- Node.js 18+ or Bun
- PostgreSQL database
- Redis instance
- 10 minutes of your time

## 🚀 Local Development Setup

### Step 1: Start Backend (Terminal 1)

```bash
# Navigate to project root
cd /Users/manasraghuwanshi/Developer/s-30/flux

# Start the API server
cd apps/api
bun run src/index.ts

# You should see:
# API listening on http://localhost:3000
# WebSocket available at ws://localhost:3000/ws
```

### Step 2: Start Frontend (Terminal 2)

```bash
# Navigate to web app
cd /Users/manasraghuwanshi/Developer/s-30/flux/apps/web

# Install dependencies if needed
npm install

# Start dev server
npm run dev

# You should see:
# ▲ Next.js 16.x.x
# - Local: http://localhost:3001
```

### Step 3: Open & Test

1. **Open browser:** http://localhost:3001
2. **Register account:** Click "Sign Up"
3. **Place a test order:** Try buying/selling
4. **Cancel an order:** Click "Cancel" button

## ✅ Verify Everything Works

Run this quick check:

```bash
# Terminal 3
cd apps/web
npm run check-config
```

Expected output:
```
✅ NEXT_PUBLIC_API_URL = http://localhost:3000
✅ NEXT_PUBLIC_WS_URL = ws://localhost:3000/ws
✅ NEXT_PUBLIC_USE_REAL_API = true
✅ All required environment variables are set!
```

## 🐛 Something Not Working?

### Backend won't start?

```bash
# Check if port 3000 is already in use
lsof -i :3000

# Kill any process using port 3000
kill -9 <PID>

# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check Redis connection
redis-cli ping
```

### Frontend won't start?

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Try again
npm run dev
```

### Order cancellation not working?

This is the issue you're experiencing! Here's the fix:

1. **Check WebSocket connection** in browser console:
   ```
   Look for: [WebSocket] Connected successfully
   ```

2. **Check backend logs** for order processing:
   ```
   Look for: [DEBUG] Processed X items
   ```

3. **Verify token** in browser localStorage:
   ```javascript
   localStorage.getItem('token')
   ```

## 📚 Next Steps

### For Local Development
- Read [URL_CONFIGURATION.md](./URL_CONFIGURATION.md) to understand how URLs work
- Check [apps/web/README.md](./apps/web/README.md) for frontend details
- Review [DETAILED_ARCHITECTURE.md](./DETAILED_ARCHITECTURE.md) for system design

### For Deployment
- Follow [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) step by step
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions
- Update URLs in `.env.production` before deploying

## 🎉 You're All Set!

Your trading platform should now be running at:
- **Frontend:** http://localhost:3001
- **Backend:** http://localhost:3000
- **WebSocket:** ws://localhost:3000/ws

Happy trading! 📈
