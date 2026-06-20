# Testing Instructions

The project uses Bun tests.

## Full Test Suite

```bash
bun test
```

## Type Checks

```bash
bunx tsc --noEmit -p packages/matching-engine/tsconfig.json
bunx tsc --noEmit -p packages/db/tsconfig.json
bunx tsc --noEmit -p packages/risk/tsconfig.json
bunx tsc --noEmit -p packages/websocket/tsconfig.json
bunx tsc --noEmit -p packages/runtime/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p apps/workers/tsconfig.json
bunx tsc --noEmit -p apps/market-data/tsconfig.json
```

## Docker Config Check

```bash
docker compose config
```

This validates `docker-compose.yml` without starting containers.

## Whitespace Check

```bash
git diff --check
```

## Coverage Areas

Matching engine:

- exact fill
- partial fill
- multi-level fill
- price-time priority
- market order expiry
- post-only
- reduce-only intent
- self-trade prevention
- cancellation
- deterministic batch sequencing

Persistence:

- order event persistence
- fill persistence
- position projection persistence after trades
- processed-event idempotency
- outbox helper
- outbox publisher success and failure paths
- funding payment mapper
- liquidation mapper

Risk:

- position open, increase, reduce, close, reverse
- realized and unrealized PnL
- cross-margin summary
- sufficient and insufficient margin
- funding rate and payments
- liquidation trigger
- insurance fund
- simplified ADL

WebSocket:

- public subscriptions
- private authenticated subscriptions
- fanout
- unsubscribe/disconnect cleanup
- snapshots and resync notices

Recovery:

- file snapshot write/read
- snapshot restore
- event replay after snapshot

Runtime/API:

- API register/login/deposit/order/fills flow
- JWT signing and verification
- Redis stream adapter command shape
- stream command processing
- matching worker
- persistence worker
- position updates after trades

Market data:

- Binance mark-price message parsing
- unknown symbol and malformed payload handling
- combined stream URL construction
