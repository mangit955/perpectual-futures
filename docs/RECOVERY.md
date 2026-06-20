# Recovery Documentation

Implemented package:

```text
packages/matching-engine
```

Files:

```text
packages/matching-engine/src/recovery.ts
packages/matching-engine/recovery.test.ts
```

## Problem

The orderbook lives in memory. If the matching engine crashes, open orders would
be lost unless the engine can rebuild book state.

## Implemented Recovery Strategy

1. Periodically serialize the open orderbook.
2. Write the snapshot to a temporary file.
3. Atomically rename the temporary file to the market snapshot path.
4. Store metadata:
   - market
   - engine sequence
   - last Redis stream id
   - created time
5. On restart, load the latest snapshot.
6. Replay engine events after the snapshot sequence.

## Snapshot Shape

```json
{
  "market": "BTC-PERP",
  "engineSequence": 100,
  "lastRedisStreamId": "1710000000000-0",
  "createdAt": 1700000000000,
  "orderBook": {
    "market": "BTC-PERP",
    "sequence": 100,
    "bids": [],
    "asks": []
  }
}
```

Each price level stores FIFO order snapshots with enough detail to restore:

```json
{
  "priceTicks": 650000,
  "totalQtyLots": 10,
  "orders": [
    {
      "orderId": "order-1",
      "userId": "user-1",
      "market": "BTC-PERP",
      "side": "buy",
      "type": "limit",
      "qtyLots": 10,
      "remainingQtyLots": 10,
      "priceTicks": 650000,
      "status": "OPEN",
      "timeInForce": "GTC",
      "reduceOnly": false,
      "postOnly": false,
      "createdAt": 1700000000000,
      "sequence": 12
    }
  ]
}
```

## Replay Events

Replay currently mutates book state for:

```text
order.rested
order.cancelled
trade.executed
```

No-op replay events:

```text
order.accepted
order.rejected
order.cancel_rejected
order.expired
```

## Usage

```ts
import {
  createStoredSnapshot,
  FileSnapshotStore,
  recoverOrderBookFromSnapshot,
} from "matching-engine";

const store = new FileSnapshotStore("./snapshots");

await store.write(
  createStoredSnapshot({
    orderBook,
    lastRedisStreamId: "1710000000000-0",
    createdAt: Date.now(),
  }),
);

const snapshot = await store.readLatest("BTC-PERP");

if (snapshot) {
  const recovered = recoverOrderBookFromSnapshot({
    snapshot,
    eventsAfterSnapshot,
  });
}
```

## Redis Worker Responsibility

The implemented recovery helper expects `eventsAfterSnapshot` as input. A future
Redis integration should:

1. Read snapshot metadata.
2. `XREAD` from `lastRedisStreamId`.
3. Decode engine events.
4. Pass them to `recoverOrderBookFromSnapshot`.
5. Start normal command consumption after replay completes.
