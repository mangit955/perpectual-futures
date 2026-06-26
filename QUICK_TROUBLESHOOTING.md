# Quick Troubleshooting Guide

**Problem:** Orders won't cancel in production? Use this guide.

---

## 🚨 Emergency Fix (5 minutes)

```bash
# 1. Clean up stuck messages (use production Redis URL)
REDIS_URL="rediss://..." bun run cleanup:pel

# 2. Restart workers in Railway
# Go to Railway Dashboard → workers service → Deploy

# 3. Verify it worked
bun run diag
# Look for: pending: 0 ✅

# 4. Test cancellation
bun run test:cancel https://your-api.railway.app "Bearer YOUR_TOKEN"
```

---

## 📊 Check System Health

```bash
# Quick check
bun run diag

# Real-time monitoring
REDIS_URL="..." DATABASE_URL="..." bun run monitor
```

---

## 🔍 Diagnostic Decision Tree

```
Run: bun run diag

┌─ PENDING > 10?
│  └─ YES → OutboxPublisher stuck
│     └─ FIX: Restart workers
│
├─ FAILED > 5?
│  └─ YES → Check worker logs for errors
│     └─ FIX: Fix error, restart workers
│
├─ pending > 100?
│  └─ YES → PEL buildup
│     └─ FIX: Run cleanup:prod
│
└─ All zeros?
   └─ ✅ System healthy!
```

---

## 📝 Common Issues

### Issue: Cancel button does nothing

**Quick fix:**
```bash
REDIS_URL="rediss://..." bun run cleanup:pel
```

### Issue: Orders stuck in PENDING

**Quick fix:**
```bash
# Check if workers are running
curl https://your-workers.railway.app/health

# If not responding, redeploy workers in Railway
```

### Issue: "Order not found" errors

**Diagnosis:** Order was created in API but not in matching engine

**Fix:**
```bash
# 1. Check outbox
bun run diag
# Look for PENDING > 0

# 2. If PENDING > 0, restart workers
# 3. If pending (Redis) > 0, run cleanup
REDIS_URL="rediss://..." bun run cleanup:pel
```

---

## 🔧 Available Commands

| Command | What it does | When to use |
|---------|-------------|-------------|
| `bun run diag` | Health snapshot | Daily checks |
| `bun run cleanup:pel` | Clear PEL | Orders won't process |
| `bun run monitor` | Live dashboard | During incidents |
| `bun run test:cancel` | E2E test | After fixes |

---

## 📞 Support Checklist

Before asking for help, run these:

```bash
# 1. System health
bun run diag

# 2. Cleanup if needed (use production Redis URL)
REDIS_URL="rediss://..." bun run cleanup:pel

# 3. Test functionality
bun run test:cancel https://your-api.railway.app "Bearer YOUR_TOKEN"
```

Then share the output in your support request.

---

## 📚 Full Documentation

- [ORDER_CANCELLATION_FIX.md](./ORDER_CANCELLATION_FIX.md) - Complete technical analysis
- [scripts/README.md](./scripts/README.md) - Detailed tool guide

---

## ✅ When Everything Works

You should see:
```bash
$ bun run diag
Outbox Stats: PENDING=0, FAILED=0, PUBLISHED=XXX
engine.commands.BTC-PERP: pending=0 ✅
```

And:
```bash
$ bun run test:cancel https://your-api.railway.app "Bearer ..."
✅ SUCCESS! Order was cancelled successfully! 🎉
```

**If you see this, everything is working correctly!**

---

**Last Updated:** June 26, 2026
