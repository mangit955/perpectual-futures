# Quick Troubleshooting Guide

**Can't cancel orders in production?** Use this guide.

---

## 🚨 Emergency Fix (2 steps)

```bash
# 1. Reset consumer group (use production Redis URL)
REDIS_URL="rediss://..." bun run reset:consumers

# 2. Restart workers in Railway Dashboard
#    Go to: Railway → workers service → Deploy → Redeploy
```

Then verify:
```bash
REDIS_URL="..." DATABASE_URL="..." bun run diag:full
# Look for: Events: >0 messages ✅
```

---

## 📊 Check System Health

```bash
# Full diagnostic
REDIS_URL="..." DATABASE_URL="..." bun run diag:full

# Test Redis
REDIS_URL="..." bun run test:redis
```

---

## 🔍 What to Look For

```bash
Run: bun run diag:full

┌─ Events: 0 messages?
│  └─ ❌ Matching engine not processing
│     └─ FIX: bun run reset:consumers then restart workers
│
├─ Events: >0 messages?
│  └─ ✅ System healthy!
│
├─ Commands > 1000?
│  └─ ⚠️ Backlog building up
│     └─ FIX: Check if workers are running
│
└─ Recent orders stuck in PENDING?
   └─ ❌ Workers not processing
      └─ FIX: Restart workers
```

---

## 🔧 Available Commands

| Command | What it does |
|---------|-------------|
| `bun run diag:full` | Detailed system diagnostic |
| `bun run reset:consumers` | Reset Redis consumer groups |
| `bun run test:redis` | Test Redis connectivity |
| `bun run cleanup:pel` | Clear stuck messages |
| `bun run monitor` | Real-time dashboard |

**Note:** All commands need production credentials:
```bash
REDIS_URL="rediss://..." DATABASE_URL="postgresql://..." bun run <command>
```

---

## 📚 Documentation

- [FINAL_FIX.md](./FINAL_FIX.md) - Complete fix guide
- [scripts/README.md](./scripts/README.md) - Detailed tool documentation

---

**Last Updated:** June 26, 2026
