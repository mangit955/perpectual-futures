# Testing OrderBook in Production Mode

This guide will help you verify that limit orders now appear correctly on the orderbook in production mode.

## Prerequisites

1. **Redis** must be running locally or accessible via `REDIS_URL`
2. **PostgreSQL** database must be set up with proper schema
3. Environment variables configured in `.env`:
   ```env
   RUNTIME_MODE=production
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your-secret-key
   ```

## Testing Steps

### 1. Start Redis (if not already running)
```bash
redis-server
```

### 2. Start the API Server
```bash
cd /Users/manasraghuwanshi/Developer/s-30/flux
bun run --cwd apps/api dev
```

**Expected Output:**
```
Production API listening on port 3000
```

### 3. Start the Workers (in a new terminal)
```bash
cd /Users/manasraghuwanshi/Developer/s-30/flux
bun run --cwd apps/workers dev
```

**Expected Output:**
```
Production workers started with role=all, interval=100ms
```

### 4. Register a User and Login
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login and save the token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### 5. Deposit Funds
```bash
curl -X POST http://localhost:3000/api/balances/deposit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset":"USDT","amount":10000}'
```

### 6. Submit a Limit Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "BTC-PERP",
    "side": "BUY",
    "type": "LIMIT",
    "quantity": 1,
    "price": 50000,
    "timeInForce": "GTC"
  }'
```

### 7. Check the OrderBook ✅
```bash
curl http://localhost:3000/api/markets/BTC-PERP/orderbook
```

**Expected Output (with your order visible):**
```json
{
  "market": "BTC-PERP",
  "sequence": 1,
  "bids": [
    {
      "priceTicks": 50000,
      "totalQtyLots": 1
    }
  ],
  "asks": []
}
```

### 8. Submit a Sell Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "BTC-PERP",
    "side": "SELL",
    "type": "LIMIT",
    "quantity": 1,
    "price": 51000,
    "timeInForce": "GTC"
  }'
```

### 9. Check OrderBook Again
```bash
curl http://localhost:3000/api/markets/BTC-PERP/orderbook
```

**Expected Output (both orders visible):**
```json
{
  "market": "BTC-PERP",
  "sequence": 2,
  "bids": [
    {
      "priceTicks": 50000,
      "totalQtyLots": 1
    }
  ],
  "asks": [
    {
      "priceTicks": 51000,
      "totalQtyLots": 1
    }
  ]
}
```

## Verifying Redis Cache Directly

You can inspect the Redis cache directly:

```bash
# List all markets with cached orderbooks
redis-cli SMEMBERS orderbook:markets

# Get orderbook for BTC-PERP
redis-cli HGETALL orderbook:latest:BTC-PERP

# Check TTL (should be ~60 seconds)
redis-cli TTL orderbook:latest:BTC-PERP
```

**Expected Redis Output:**
```
1) "market"
2) "BTC-PERP"
3) "sequence"
4) "2"
5) "bids"
6) "[{\"priceTicks\":50000,\"totalQtyLots\":1}]"
7) "asks"
8) "[{\"priceTicks\":51000,\"totalQtyLots\":1}]"
9) "timestamp"
10) "1735228800000"
```

## Troubleshooting

### OrderBook is Empty
1. **Check if workers are running:** Look for "Production workers started" message
2. **Check Redis connection:** Verify `REDIS_URL` is correct
3. **Check logs:** Look for "Failed to publish orderbook to Redis cache" errors
4. **Verify order was accepted:** Check `/api/orders` endpoint to see order status

### Cache Not Updating
1. **Check worker logs:** Should see orderbook updates being published
2. **Verify Redis TTL:** Run `redis-cli TTL orderbook:latest:BTC-PERP` (should be ~60)
3. **Check worker interval:** Default is 100ms, can be adjusted with `WORKER_INTERVAL_MS`

### Redis Connection Errors
```bash
# Test Redis connectivity
redis-cli ping
# Expected: PONG

# Check if Bun can connect
bun -e "const redis = new Bun.RedisClient('redis://localhost:6379'); console.log(await redis.send('PING', []))"
# Expected: PONG
```

## Success Criteria ✅

You've successfully verified the implementation when:
- [ ] Workers start without errors
- [ ] API server starts in production mode
- [ ] Limit orders can be submitted
- [ ] OrderBook API returns orders (not empty)
- [ ] Redis contains orderbook data
- [ ] Both bids and asks are visible
- [ ] Sequence numbers increase with each order

## What Changed

Previously, in production mode, `PrismaApiRuntime.getOrderBook()` returned:
```typescript
{
  market: marketId,
  sequence: 0,
  bids: [],    // Always empty!
  asks: [],    // Always empty!
}
```

Now it reads from Redis cache populated by the matching engine worker, showing actual live orders! 🎉
