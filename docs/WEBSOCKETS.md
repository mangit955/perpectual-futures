# WebSocket Documentation

Implemented package:

```text
packages/websocket
```

The package provides:

- `WebSocketHub` for subscriptions and fanout.
- `createWebSocketServer()` for a Bun-backed `/ws` endpoint.

## Endpoint

```text
GET /ws
```

## Subscribe

Public channel:

```json
{
  "op": "subscribe",
  "channel": "trades",
  "market": "BTC-PERP"
}
```

Private channel:

```json
{
  "op": "subscribe",
  "channel": "positions",
  "token": "jwt"
}
```

## Unsubscribe

```json
{
  "op": "unsubscribe",
  "channel": "orderbook",
  "market": "BTC-PERP"
}
```

## Channels

```text
trades:{market}
orderbook:{market}
mark_price:{market}
funding:{market}
positions:{userId}
```

`positions` is private and requires successful authentication. The server uses
the authenticated user id; clients cannot subscribe to another user's position
topic by passing a user id.

## Messages

Subscribed:

```json
{
  "type": "subscribed",
  "channel": "trades",
  "topic": "trades:BTC-PERP"
}
```

Update:

```json
{
  "type": "update",
  "channel": "trades",
  "topic": "trades:BTC-PERP",
  "sequence": 123,
  "data": {
    "tradeId": "trade-1"
  }
}
```

Snapshot:

```json
{
  "type": "snapshot",
  "topic": "orderbook:BTC-PERP",
  "sequence": 100,
  "data": {
    "bids": [],
    "asks": []
  }
}
```

Resync:

```json
{
  "type": "resync",
  "topic": "orderbook:BTC-PERP",
  "reason": "sequence gap"
}
```

Error:

```json
{
  "type": "error",
  "reason": "bad token"
}
```

## Orderbook Flow

1. Client subscribes to `orderbook:{market}`.
2. Server sends a current snapshot.
3. Server sends sequence-numbered deltas.
4. If a sequence gap is detected, server sends `resync`.
5. Client discards local book and resubscribes or requests a fresh snapshot.

## Redis Integration

The hub is transport-agnostic. A future Redis consumer should read streams such
as `engine.events.BTC-PERP`, `price.updated`, and `funding.executed`, then call
`hub.publish(...)`.
