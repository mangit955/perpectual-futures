# 🔗 URL Configuration Guide

This document explains how URLs are configured throughout the Flux trading platform.

## 📍 Current State

Your `.env.local` already has the correct local development URLs:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
NEXT_PUBLIC_USE_REAL_API=true
```

## 🗺️ URL Flow Map

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│                  http://localhost:3001                       │
│                                                              │
│  Reads from .env.local:                                      │
│  ├── NEXT_PUBLIC_API_URL → API calls                        │
│  ├── NEXT_PUBLIC_WS_URL  → WebSocket connection             │
│  └── NEXT_PUBLIC_USE_REAL_API → Enable/disable real API     │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ▼                          ▼
        HTTP Requests              WebSocket Connection
               │                          │
               └──────────┬───────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │    Backend API (Bun + Express)     │
         │      http://localhost:3000         │
         │                                    │
         │  Endpoints:                        │
         │  ├── GET  /health                  │
         │  ├── POST /auth/login              │
         │  ├── GET  /orders                  │
         │  ├── POST /orders                  │
         │  ├── DELETE /orders/:id ← CANCEL   │
         │  └── WS /ws ← WebSocket            │
         └────────────────────────────────────┘
```

## 📂 Where URLs Are Defined

### Frontend Configuration Files

| File | Purpose | Variables |
|------|---------|-----------|
| `.env.local` | Local development | All `NEXT_PUBLIC_*` vars |
| `.env.production` | Production build | Production URLs |
| `.env.example` | Template/documentation | Example values |

### Code Files Using URLs

| File | Usage | Configuration |
|------|-------|---------------|
| `apps/web/lib/api.ts` | HTTP API calls | Reads `NEXT_PUBLIC_API_URL` |
| `apps/web/lib/websocket-client.ts` | WebSocket connection | Reads `NEXT_PUBLIC_WS_URL` |
| `apps/web/hooks/use-api-data.ts` | Data fetching | Uses `api.ts` functions |
| `apps/web/next.config.mjs` | Next.js config | Passes env vars to browser |

## 🔧 How URL Configuration Works

### 1. Environment Variables

Next.js requires `NEXT_PUBLIC_` prefix for client-side variables:

```javascript
// ✅ CORRECT - Accessible in browser
NEXT_PUBLIC_API_URL=http://localhost:3000

// ❌ WRONG - Only available server-side
API_URL=http://localhost:3000
```

### 2. API Client (apps/web/lib/api.ts)

```typescript
// Gets URL with fallback
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (!url) {
      console.warn('[API] Using default URL');
      return "http://localhost:3000";
    }
    return url;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

const BASE_URL = getApiUrl();
```

### 3. WebSocket Client (apps/web/lib/websocket-client.ts)

```typescript
const getWebSocketUrl = (): string => {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;
    const defaultUrl = "ws://localhost:3000/ws";
    return envUrl || defaultUrl;
  }
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000/ws";
};
```

## 🌐 Environment-Specific URLs

### Local Development
```bash
# Backend
http://localhost:3000        # API server
ws://localhost:3000/ws       # WebSocket

# Frontend
http://localhost:3001        # Next.js dev server
```

### Production
```bash
# Backend (your deployed backend)
https://your-backend.com     # API server (HTTPS!)
wss://your-backend.com/ws    # WebSocket (WSS!)

# Frontend (Vercel)
https://your-app.vercel.app  # Next.js production
```

## ✅ Configuration Validation

Run this command to validate your configuration:

```bash
cd apps/web
npm run check-config
```

Expected output:
```
✅ NEXT_PUBLIC_API_URL = http://localhost:3000
✅ NEXT_PUBLIC_WS_URL = ws://localhost:3000/ws
✅ NEXT_PUBLIC_USE_REAL_API = true
⚠️  Using local development URLs
```

## 🔍 Debugging URL Issues

### Check Current Configuration

```javascript
// In browser console
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('WS URL:', process.env.NEXT_PUBLIC_WS_URL);
console.log('Use Real API:', process.env.NEXT_PUBLIC_USE_REAL_API);
```

### Common Issues

#### 1. "Cannot connect to API"
**Check:**
- Is backend running? `curl http://localhost:3000/health`
- Is URL correct in `.env.local`?
- Did you restart Next.js after changing `.env.local`?

#### 2. "WebSocket connection failed"
**Check:**
- Backend logs show WebSocket upgrade?
- URL uses `ws://` (local) or `wss://` (production)?
- Port matches backend port?

#### 3. "Orders not cancelling"
**Check:**
- WebSocket connected? (Check browser console)
- Token present? (Check localStorage)
- Backend processing events? (Check backend logs)
- DELETE request succeeds? (Check network tab)

## 🚀 Deployment URL Updates

### Before Deployment

1. Deploy backend first
2. Note the URLs:
   ```
   API: https://your-backend-url.com
   WS:  wss://your-backend-url.com/ws
   ```

3. Update `.env.production`:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   NEXT_PUBLIC_WS_URL=wss://your-backend-url.com/ws
   NEXT_PUBLIC_USE_REAL_API=true
   ```

4. Deploy frontend to Vercel with these env vars

### After Deployment

Update backend CORS to allow your frontend:

```typescript
// apps/api/src/app.ts
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://your-app.vercel.app",
  // ...
};
```

## 📊 URL Configuration Checklist

- [ ] `.env.local` exists with correct local URLs
- [ ] `.env.production` created with production URLs
- [ ] `NEXT_PUBLIC_` prefix on all client-side variables
- [ ] Backend URL uses correct protocol (http/https)
- [ ] WebSocket URL uses correct protocol (ws/wss)
- [ ] Backend CORS allows frontend domain
- [ ] Configuration validated with `npm run check-config`
- [ ] Frontend restarts after env changes

## 🎯 Quick Reference

### Local URLs
```bash
API:  http://localhost:3000
WS:   ws://localhost:3000/ws
Web:  http://localhost:3001
```

### Production URLs (example)
```bash
API:  https://flux-api.railway.app
WS:   wss://flux-api.railway.app/ws
Web:  https://flux-trading.vercel.app
```

### Test Commands
```bash
# Test backend health
curl http://localhost:3000/health

# Test WebSocket (requires wscat)
wscat -c ws://localhost:3000/ws

# Validate frontend config
cd apps/web && npm run check-config

# Check env vars in browser console
console.log(process.env.NEXT_PUBLIC_API_URL)
```

## 💡 Best Practices

1. **Never commit `.env.local`** - It contains local settings
2. **Always use `.env.example`** - Document required variables
3. **Restart dev server** after changing `.env.local`
4. **Use HTTPS/WSS in production** - Never HTTP/WS
5. **Validate configuration** before deploying
6. **Update CORS** when deploying to new domains
7. **Test locally first** before deploying

## 🆘 Still Having Issues?

1. Check browser console for errors
2. Check network tab for failed requests
3. Check backend logs for errors
4. Verify configuration with `npm run check-config`
5. Review [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
6. Ensure backend is actually running and accessible
