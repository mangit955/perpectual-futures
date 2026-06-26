# 🎯 How to Fix Order Cancellation Issue

## Quick Diagnosis

```bash
# Check system health (use production credentials)
REDIS_URL="rediss://..." DATABASE_URL="postgresql://..." bun run diag:full
```

**Look for:**
- `Events: 0 messages` ❌ = Matching engine not working
- `Events: >0 messages` ✅ = Matching engine is working

## The Problem

Workers are running but matching engine fails silently when processing commands:
- Commands sent to Redis: ✅
- Events generated: ❌
- Orders stuck in PENDING: ❌

## The Fix

### Step 1: Reset Consumer Group

```bash
REDIS_URL="rediss://..." bun run reset:consumers
```

This forces the matching engine to reprocess all commands.

### Step 2: Restart Workers on Railway

1. Go to Railway Dashboard
2. Find "workers" service
3. Click Deploy → Redeploy
4. Watch logs for rapid processing

**Expected logs:**
```
[2026-06-26T...] Processed 10 items (total: 10)
[2026-06-26T...] Processed 10 items (total: 20)
...continues rapidly...
```

### Step 3: Verify

```bash
REDIS_URL="rediss://..." DATABASE_URL="postgresql://..." bun run diag:full
```

Should show:
```
Events: >100 messages ✅
Recent orders: Status OPEN or CANCELLED (not PENDING)
```

### Step 4: Test Cancellation

Try cancelling an order in your frontend - should work within 5 seconds.

## If Matching Engine Errors

After restart, if you see `[MATCHING] Error processing message` in worker logs:
- The engine is hitting errors processing commands
- Share the error logs to fix the root cause
- May be data validation issues

## Useful Commands

```bash
# Full diagnostic
REDIS_URL="..." DATABASE_URL="..." bun run diag:full

# Test Redis connectivity  
REDIS_URL="..." bun run test:redis

# Monitor in real-time
REDIS_URL="..." DATABASE_URL="..." bun run monitor

# Reset consumers (if needed again)
REDIS_URL="..." bun run reset:consumers

# Clean up PEL if it builds up
REDIS_URL="..." bun run cleanup:pel
```

## What Was Wrong

The matching engine was reading commands from Redis but **failing silently** when processing them. Commands were ACKed anyway, so they wouldn't be retried. Resetting the consumer group forces reprocessing.

---

**Next:** Restart workers on Railway and verify events are generated!
