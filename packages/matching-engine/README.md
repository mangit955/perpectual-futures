# matching-engine

In-memory matching engine for perpetual futures markets.

## Features

- One orderbook per market.
- Price-time priority.
- Limit orders.
- Market orders.
- IOC behavior.
- Post-only rejection.
- Reduce-only intent storage.
- Partial fills.
- Multi-level fills.
- Self-trade prevention using expire-taker behavior.
- O(log n) price-level insertion with FIFO queues inside each level.
- Snapshot and event replay recovery.

## Public API

```ts
import { MatchingEngine } from "matching-engine";

const engine = new MatchingEngine();

const events = engine.submitOrder({
  commandId: "cmd-1",
  orderId: "order-1",
  userId: "user-1",
  market: "BTC-PERP",
  side: "buy",
  type: "limit",
  qtyLots: 1,
  priceTicks: 650000,
  timeInForce: "GTC",
  createdAt: Date.now(),
});
```

## Recovery API

```ts
import {
  createStoredSnapshot,
  FileSnapshotStore,
  recoverOrderBookFromSnapshot,
} from "matching-engine";
```

See `docs/RECOVERY.md` for the full flow.

## Tests

```bash
bun test packages/matching-engine
bunx tsc --noEmit -p packages/matching-engine/tsconfig.json
```
