# Perpetual Futures Exchange - Detailed Architecture Design

## Executive Summary

This is a production-grade educational backend for a **centralized perpetual futures exchange** built with TypeScript, Bun, PostgreSQL, Redis Streams, and Prisma. The system implements a complete trading lifecycle including order matching, risk management, margin calculations, funding rates, liquidations, and real-time WebSocket updates.

**Tech Stack:**
- **Runtime:** Bun (HTTP server, test runner)
- **Language:** TypeScript 5.9.2
- **Database:** PostgreSQL 16 with Prisma ORM
- **Cache/Messaging:** Redis 7 with Streams
- **Monorepo:** Turborepo with workspace organization
- **Infrastructure:** Docker Compose

**Key Characteristics:**
- Two operational modes: Local in-memory (development) and Production (distributed)
- Event-driven architecture with Redis Streams for inter-service communication
- Deterministic matching engine with snapshot-based recovery
- Cross-margin perpetual futures with up to 20x leverage
- Full accounting trail with double-entry ledger pattern
- Real-time WebSocket subscriptions for public and private data

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Topology](#architecture-topology)
3. [Core Packages](#core-packages)
4. [Service Components](#service-components)
5. [Data Flow Patterns](#data-flow-patterns)
6. [Database Schema](#database-schema)
7. [Redis Streams Design](#redis-streams-design)
8. [Matching Engine Deep Dive](#matching-engine-deep-dive)
9. [Risk Management System](#risk-management-system)
10. [Funding Rate Mechanism](#funding-rate-mechanism)
11. [Liquidation & ADL System](#liquidation--adl-system)
12. [WebSocket Architecture](#websocket-architecture)
13. [Recovery & Disaster Handling](#recovery--disaster-handling)
14. [Deployment Modes](#deployment-modes)
15. [Security Architecture](#security-architecture)
16. [Performance Characteristics](#performance-characteristics)
17. [Testing Strategy](#testing-strategy)

---

## 1. System Overview

### 1.1 Project Structure

```
flux/
├── apps/
│   ├── api/                    # HTTP API service (Bun server)
│   ├── workers/                # Background workers (persistence, outbox)
│   ├── market-data/            # Binance price feed ingestion
│   ├── docs/                   # Documentation site (Next.js)
│   └── web/                    # Future web frontend
├── packages/
│   ├── matching-engine/        # Core orderbook and matching logic
│   ├── risk/                   # Margin, PnL, liquidation calculations
│   ├── db/                     # Prisma client and persistence services
│   ├── websocket/              # WebSocket hub and server factory
│   ├── runtime/                # Runtime orchestration and adapters
│   ├── eslint-config/          # Shared ESLint configuration
│   ├── typescript-config/      # Shared TypeScript configuration
│   └── ui/                     # Shared UI components
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   ├── migrations/             # Database migrations
│   └── seed.sql                # Initial seed data
├── snapshots/                  # Orderbook snapshot files
├── docker-compose.yml          # Infrastructure orchestration
└── turbo.json                  # Turborepo configuration
```

### 1.2 Design Philosophy

**Explicit Over Clever:** The codebase favors clear, explicit TypeScript modules over heavy abstractions and frameworks. Every service boundary is obvious and justified by real runtime differences.

**Deterministic By Default:** The matching engine processes commands sequentially per market, making behavior predictable and testable. All side effects use idempotency keys.

**Integer-Based Precision:** Uses `qtyLots` and `priceTicks` (integers) for orderbook operations to avoid floating-point precision issues. Decimal math (via Prisma Decimal) for financial calculations.

**PostgreSQL as Source of Truth:** Redis Streams are for ordered transport and replay, not permanent storage. All business-critical state persists in PostgreSQL.

**Event-Driven Without Event Sourcing:** Uses event streams for inter-service communication but doesn't event-source every entity. Traditional relational models for balances, positions, and orders.

**Safety Through Constraints:** Database uniqueness constraints, idempotency checks, and transaction boundaries prevent duplicate effects and maintain data integrity.

---

## 2. Architecture Topology

### 2.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Client Applications                             │
│                    (Web UI, Mobile, API Consumers)                       │
└────────────┬─────────────────────────────────────────────┬──────────────┘
             │ REST API                                     │ WebSocket
             ▼                                              ▼
┌──────────────────────┐                              ┌──────────────────────┐
│    API Service       │                              │  WebSocket Service   │
│  (apps/api)          │                              │  (packages/websocket)│
│                      │                              │                      │
│ - Auth & Sessions    │                              │ - Subscription Hub   │
│ - Order Submission   │                              │ - Fanout Engine      │
│ - Query Endpoints    │                              │ - Private Channels   │
│ - Risk Pre-checks    │                              │                      │
└──────────┬───────────┘                              └───────┬──────────────┘
           │                                                  │
           │ Writes                                           │ Reads
           ▼                                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                               │
│                                                                           │
│  - Users, API Keys, Sessions                                              │
│  - Markets Configuration                                                  │
│  - Orders, Fills, Positions                                               │
│  - Balances, Ledger Entries                                               │
│  - Funding Payments, Liquidations                                         │
│  - Outbox Events, Processed Events                                        │
│  - Snapshot Metadata                                                      │
└──────────┬────────────────────────────────────────────────┬──────────────┘
           │                                                │
           │ Outbox Pattern                                 │ Persistence
           ▼                                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Redis Streams                                     │
│                                                                           │
│  - engine.commands.{market}    → Incoming order commands                 │
│  - engine.events.{market}      → Execution events (trades, fills)        │
│  - price.updated               → Mark/index price updates                │
│  - position.updated            → Position change events                  │
│  - funding.executed            → Funding payment events                  │
│  - liquidation.triggered       → Liquidation events                      │
└────┬──────────────┬───────────────┬──────────────┬────────────┬──────────┘
     │              │               │              │            │
     │ Commands     │ Events        │ Prices       │ Funding    │ Liquidations
     ▼              ▼               ▼              ▼            ▼
┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐
│ Matching    │ │ Persistence  │ │ Funding    │ │ Liqui-   │ │ Market Data │
│ Engine      │ │ Worker       │ │ Engine     │ │ dation   │ │ Service     │
│ Worker      │ │              │ │ Worker     │ │ Engine   │ │             │
│             │ │              │ │            │ │ Worker   │ │             │
│ - Orderbook │ │ - Fills      │ │ - 8h       │ │ - Margin │ │ - Binance   │
│ - Matching  │ │ - Positions  │ │   Interval │ │   Check  │ │   WebSocket │
│ - Snapshots │ │ - Balances   │ │ - Premium  │ │ - Force  │ │ - Normalize │
│ - Recovery  │ │ - Ledger     │ │   Index    │ │   Close  │ │   Symbols   │
└─────────────┘ └──────────────┘ └────────────┘ └──────────┘ └─────────────┘
```

### 2.2 Communication Patterns

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| **Request-Response** | API queries (balances, positions, orders) | Direct PostgreSQL reads via Prisma |
| **Command Pattern** | Order submission/cancellation | API → PostgreSQL + Outbox → Redis → Matching Engine |
| **Event Streaming** | Trade execution, position updates | Matching Engine → Redis → Persistence/WebSocket |
| **Pub-Sub** | Real-time market data | Redis Streams → WebSocket Hub → Connected Clients |
| **Polling** | Funding intervals, liquidation checks | Scheduled workers reading price cache |
| **Transactional Outbox** | Guaranteed command delivery | API writes order + outbox row in single transaction |

---

## 3. Core Packages

### 3.1 packages/matching-engine

**Purpose:** In-memory orderbook with deterministic matching logic.

**Key Components:**
- `OrderBook`: Main orderbook class managing bids/asks
- `PriceLevelTree`: Treap-based balanced tree for price levels (O(log n) operations)
- `OrderNode`: Doubly-linked list node for FIFO order at each price level
- `recovery.ts`: Snapshot creation and replay logic
- `FileSnapshotStore`: Snapshot persistence to filesystem

**Data Structures:**
```typescript
OrderBook {
  market: string
  sequence: number  // Monotonically increasing
  bids: PriceLevelTree  // Descending (best bid at top)
  asks: PriceLevelTree  // Ascending (best ask at top)
  ordersById: Map<OrderId, OrderNode>
}

PriceLevel {
  priceTicks: number
  totalQtyLots: number
  head: OrderNode  // First order (oldest)
  tail: OrderNode  // Last order (newest)
}

OrderNode {
  orderId: string
  userId: string
  side: "buy" | "sell"
  type: "limit" | "market"
  qtyLots: number
  remainingQtyLots: number
  priceTicks: number
  reduceOnly: boolean
  postOnly: boolean
  createdAt: number
  sequence: number
  prev: OrderNode | null
  next: OrderNode | null
}
```

**Matching Algorithm:**
1. Price-time priority (best price first, then FIFO at same price)
2. Limit order crosses when: `bestAsk.price <= buyLimit.price` (or vice versa)
3. Market orders match against best available liquidity
4. Self-trade prevention: Cancel taker order if it would match own maker order
5. Post-only: Reject if would immediately execute
6. Reduce-only: Validated at API layer, re-validated at persistence

**Performance:**
- Insert order: O(log n) for price level lookup + O(1) for FIFO append
- Match order: O(log n) per price level + O(k) for k fills
- Cancel order: O(1) lookup via ordersById + O(log n) price level cleanup

### 3.2 packages/risk

**Purpose:** Margin calculations, position tracking, PnL, liquidation detection.

**Key Formulas:**

**Position Notional:**
```
notional = |positionQty| × markPrice
```

**Margin Requirements:**
```
initialMargin = notional / leverage
maintenanceMargin = notional × maintenanceMarginRate
```

**Unrealized PnL:**
```
Long:  (markPrice - entryPrice) × qty
Short: (entryPrice - markPrice) × qty
```

**Account Equity:**
```
equity = walletBalance + totalUnrealizedPnl
```

**Available Margin:**
```
available = equity - totalInitialMargin - openOrderMargin - estimatedFees
```

**Liquidation Condition:**
```
equity <= totalMaintenanceMargin  // Triggers liquidation
```

**Position State Transitions:**
- **Open:** First entry creates position
- **Increase:** Same-side fill increases quantity
- **Reduce:** Opposite-side fill decreases quantity (realizes PnL)
- **Close:** Position quantity reaches zero
- **Reverse:** Close existing + open opposite direction in same fill

**Risk Checks:**
- Pre-submission: API validates sufficient available margin
- Post-fill: Persistence worker updates positions and re-validates
- Continuous: Liquidation worker monitors all positions on price updates

### 3.3 packages/db

**Purpose:** Prisma client, schema management, persistence services.

**Responsibilities:**
- Database schema definition (17 models)
- Type-safe query builders
- Migration management
- Idempotency tracking
- Seed data scripts

**Key Services:**
- `PersistenceService`: Applies fills, updates positions, creates ledger entries
- `BalanceService`: Manages user balances with locking
- `PositionMapper`: Converts domain events to database records
- Idempotency enforcement via `processed_events` table

**Transaction Patterns:**
```typescript
// Example: Atomic fill persistence
await prisma.$transaction(async (tx) => {
  // 1. Check if already processed
  const existing = await tx.processedEvent.findUnique({
    where: { eventId }
  });
  if (existing) return; // Idempotent

  // 2. Insert fill
  await tx.fill.create({ data: fillData });

  // 3. Update order status
  await tx.order.update({ where: { id: orderId }, data: { status } });

  // 4. Update position
  await tx.position.upsert({ where: { userId_marketId }, data: positionData });

  // 5. Create ledger entry
  await tx.ledgerEntry.create({ data: ledgerData });

  // 6. Mark event as processed
  await tx.processedEvent.create({ data: { eventId, eventType, raw } });
});
```

### 3.4 packages/websocket

**Purpose:** Real-time subscription hub and WebSocket server.

**Components:**
- `WebSocketHub`: Topic-based pub-sub with user scoping
- `createWebSocketServer()`: Bun WebSocket server factory
- Subscription management per connection
- Sequence tracking for orderbook deltas

**Supported Channels:**
```typescript
// Public channels
"trades:{marketId}"       // Recent trades
"orderbook:{marketId}"    // Bid/ask depth with deltas
"mark_price:{marketId}"   // Mark and index price updates
"funding:{marketId}"      // Funding rate and payments

// Private channels (require JWT)
"positions:{userId}"      // User position updates
"orders:{userId}"         // User order status changes
"fills:{userId}"          // User fill notifications
```

**Message Types:**
- `subscribed`: Confirmation with initial snapshot
- `update`: Incremental update with sequence number
- `snapshot`: Full state (on subscribe or resync)
- `resync`: Client should resubscribe due to gap
- `error`: Authentication or validation failure

**Sequence Management:**
```typescript
// Server tracks sequence per topic
topicSequences.set(topic, sequence++);

// Client checks for gaps
if (msg.sequence !== expectedSequence) {
  // Request resync
  send({ type: "resync", topic, reason: "sequence gap" });
}
```

### 3.5 packages/runtime

**Purpose:** Runtime orchestration, adapters, and mode switching.

**Key Components:**

**ExchangeRuntime (Local Mode):**
- In-memory order book
- In-memory stream bus
- In-memory user store
- Synchronous worker execution
- No external dependencies

**PrismaApiRuntime (Production Mode):**
- PostgreSQL via Prisma
- JWT authentication
- Outbox publisher
- Redis Streams adapter
- Separate worker processes

**Abstractions:**
```typescript
interface ApiRuntime {
  register(email, password): Promise<{id}>
  login(email, password): Promise<{token, userId}>
  authenticate(token): Promise<User>
  listMarkets(): Promise<Market[]>
  getMarket(id): Promise<Market>
  deposit(userId, asset, amount): Promise<Balance>
  submitOrder(input): Promise<{orderId, status}>
  cancelOrder(orderId, userId): Promise<{status}>
  // ... query methods
}

interface StreamBus {
  append<T>(stream: string, payload: T): Promise<string>
  readAfter<T>(stream: string, lastId: string): Promise<Event<T>[]>
  consume<T>(stream: string, group: string, consumer: string): Promise<Event<T>[]>
  ack(stream: string, group: string, id: string): Promise<void>
}
```

**OutboxPublisher:**
- Polls `outbox_events` table for unpublished events
- Publishes to Redis Streams
- Marks as published or tracks failures
- Retry logic with exponential backoff

---

## 4. Service Components

### 4.1 API Service (apps/api)

**Technology:** Bun HTTP server (no Express dependency)

**Endpoints:**

**Authentication:**
```
POST   /auth/register
POST   /auth/login
GET    /me
```

**Markets:**
```
GET    /markets
GET    /markets/:marketId
```

**Trading:**
```
POST   /orders           # Submit order
DELETE /orders/:orderId  # Cancel order
GET    /orders           # List user orders
GET    /orders/:orderId  # Get order details
GET    /fills            # List user fills
```

**Account:**
```
POST   /deposits
GET    /balances
GET    /positions
```

**Admin (Local Mode):**
```
POST   /admin/drain      # Process in-memory queues
```

**Request Flow (Order Submission):**
1. Parse and validate request body
2. Authenticate user (JWT or local session)
3. Fetch market configuration
4. Run risk pre-check (available margin >= required margin + fees)
5. Begin database transaction:
   - Insert order with status PENDING
   - Insert outbox event with type `order.created`
6. Commit transaction
7. Return 202 Accepted with orderId
8. Outbox publisher later emits to Redis

**Error Handling:**
```typescript
// Standardized error codes
{
  "error": {
    "code": "INSUFFICIENT_MARGIN",
    "message": "Available margin is below required margin",
    "details": {
      "required": "1000.00",
      "available": "500.00"
    }
  }
}
```

**Common Error Codes:**
- `UNAUTHENTICATED`: Missing or invalid token
- `FORBIDDEN`: User not authorized
- `MARKET_NOT_FOUND`: Invalid market ID
- `INVALID_ORDER`: Malformed order parameters
- `INSUFFICIENT_MARGIN`: Not enough collateral
- `DUPLICATE_CLIENT_ORDER_ID`: clientOrderId already used
- `ORDER_NOT_FOUND`: Order doesn't exist
- `ORDER_NOT_OPEN`: Cannot cancel non-open order
- `INTERNAL_ERROR`: Unexpected system error

### 4.2 Matching Engine Worker

**Responsibility:** Consume order commands, execute matching, emit events.

**Consumer Group:** `matching-engine:{market}` (one consumer per market)

**Input Stream:** `engine.commands.{market}`

**Output Stream:** `engine.events.{market}`

**Command Types:**
- `order.created`: New order to process
- `order.cancelled`: Cancellation request

**Event Types Emitted:**
- `order.accepted`: Order passed validation
- `order.rejected`: Order failed validation
- `order.rested`: Limit order added to book
- `order.cancelled`: Order removed from book
- `order.cancel_rejected`: Cancellation failed (already filled/cancelled)
- `trade.executed`: Match occurred (emitted for each fill)

**Matching Logic:**
```typescript
function processOrderCommand(book: OrderBook, command: OrderCommand) {
  // 1. Validate order
  if (!isValid(command)) {
    emitEvent({ type: "order.rejected", reason: "..." });
    return;
  }

  // 2. Check post-only
  if (command.postOnly && wouldCross(book, command)) {
    emitEvent({ type: "order.rejected", reason: "post_only_would_cross" });
    return;
  }

  // 3. Match against opposite side
  const fills: Fill[] = [];
  while (hasRemainingQty(command) && canMatch(book, command)) {
    const maker = book.getBestOpposite(command.side);
    
    // Self-trade prevention
    if (maker.userId === command.userId) {
      emitEvent({ type: "order.expired", reason: "self_trade_prevention" });
      break;
    }

    const fillQty = Math.min(command.remainingQty, maker.remainingQty);
    fills.push({
      tradeId: generateTradeId(),
      makerOrderId: maker.orderId,
      takerOrderId: command.orderId,
      makerUserId: maker.userId,
      takerUserId: command.userId,
      priceTicks: maker.priceTicks,
      qtyLots: fillQty,
      sequence: book.sequence++
    });

    command.remainingQty -= fillQty;
    maker.remainingQty -= fillQty;

    if (maker.remainingQty === 0) {
      book.remove(maker);
    }
  }

  // 4. Emit trade events
  for (const fill of fills) {
    emitEvent({ type: "trade.executed", ...fill });
  }

  // 5. Rest remaining quantity
  if (command.remainingQty > 0 && command.type === "limit") {
    book.add(command);
    emitEvent({ type: "order.rested", orderId: command.orderId });
  }
}
```

**Snapshot Creation:**
- Runs every `SNAPSHOT_INTERVAL_MS` (default: 60000ms = 1 minute)
- Serializes orderbook state to JSON
- Writes to temporary file
- Atomic rename to final path: `snapshots/{market}-{timestamp}.json`
- Updates `snapshot_metadata` table with sequence and Redis stream ID

### 4.3 Persistence Worker

**Responsibility:** Convert execution events into durable database records.

**Consumer Group:** `persistence-worker`

**Input Stream:** `engine.events.{market}` (all markets)

**Processing Logic:**
```typescript
async function handleTradeExecuted(event: TradeExecutedEvent) {
  await prisma.$transaction(async (tx) => {
    // Idempotency check
    const existing = await tx.processedEvent.findUnique({
      where: { eventId: event.eventId }
    });
    if (existing) {
      console.log("Already processed", event.eventId);
      return;
    }

    // Calculate fees
    const makerFee = event.notional * market.makerFeeRate;
    const takerFee = event.notional * market.takerFeeRate;

    // Insert fills
    await tx.fill.createMany({
      data: [
        { ...event, userId: event.makerUserId, liquidityRole: "MAKER", fee: makerFee },
        { ...event, userId: event.takerUserId, liquidityRole: "TAKER", fee: takerFee }
      ]
    });

    // Update orders
    await updateOrderStatus(tx, event.makerOrderId, event.makerRemainingQty);
    await updateOrderStatus(tx, event.takerOrderId, event.takerRemainingQty);

    // Update positions
    await updatePosition(tx, event.makerUserId, event.marketId, ...);
    await updatePosition(tx, event.takerUserId, event.marketId, ...);

    // Create ledger entries for fees
    await tx.ledgerEntry.createMany({
      data: [
        { userId: event.makerUserId, type: "TRADING_FEE", amount: -makerFee },
        { userId: event.takerUserId, type: "TRADING_FEE", amount: -takerFee }
      ]
    });

    // Mark as processed
    await tx.processedEvent.create({
      data: { eventId: event.eventId, eventType: "trade.executed", raw: event }
    });
  });

  // ACK to Redis (outside transaction to avoid holding lock)
  await redis.ack(event.streamId);
}
```

### 4.4 Market Data Service (apps/market-data)

**Responsibility:** Ingest external price feeds and normalize to internal format.

**Source:** Binance WebSocket API (`BINANCE_WS_URL`)

**Subscriptions:**
- Mark price stream: `markPrice@1s`
- Index price stream: `indexPrice@1s`

**Processing:**
```typescript
// Connect to Binance
const ws = new WebSocket("wss://fstream.binance.com/ws");

ws.on("message", async (data) => {
  const update = JSON.parse(data);
  
  // Normalize symbol (e.g., BTCUSDT → BTC-PERP)
  const marketId = normalizeSymbol(update.symbol);
  
  // Store in price cache (Redis or in-memory)
  await priceCache.set(marketId, {
    markPrice: update.markPrice,
    indexPrice: update.indexPrice,
    timestamp: update.eventTime
  });
  
  // Publish to price stream
  await redis.xadd("price.updated", "*", {
    type: "price.updated",
    marketId,
    markPrice: update.markPrice,
    indexPrice: update.indexPrice,
    timestamp: Date.now()
  });
});
```

**Trigger Points:**
- Funding interval checks (every 8 hours by default)
- Liquidation margin checks (on every price update)
- WebSocket price subscriptions

### 4.5 Funding Engine Worker

**Responsibility:** Execute periodic funding payments.

**Interval:** Configurable per market (default: 8 hours)

**Algorithm:**
```typescript
async function executeFunding(marketId: string) {
  // 1. Get current prices
  const prices = await priceCache.get(marketId);
  const { markPrice, indexPrice } = prices;

  // 2. Calculate premium index
  const premiumIndex = (markPrice - indexPrice) / indexPrice;

  // 3. Apply funding rate cap
  const fundingRate = clamp(premiumIndex, -market.fundingRateCap, market.fundingRateCap);

  // 4. Get all open positions
  const positions = await prisma.position.findMany({
    where: { marketId, quantity: { not: 0 } }
  });

  // 5. Calculate and apply payments
  await prisma.$transaction(async (tx) => {
    for (const position of positions) {
      const notional = Math.abs(position.quantity) * markPrice;
      const payment = notional * fundingRate;
      
      // Positive funding: longs pay shorts
      // Negative funding: shorts pay longs
      const paymentAmount = position.side === "LONG" ? -payment : payment;

      // Update balance
      await tx.ledgerEntry.create({
        data: {
          userId: position.userId,
          asset: market.quoteAsset,
          type: "FUNDING_PAYMENT",
          amount: paymentAmount,
          referenceId: `funding-${marketId}-${Date.now()}`
        }
      });

      // Record funding payment
      await tx.fundingPayment.create({
        data: {
          userId: position.userId,
          marketId,
          positionQuantity: position.quantity,
          markPrice,
          indexPrice,
          fundingRate,
          paymentAmount,
          fundingTime: new Date(),
          eventId: generateEventId()
        }
      });
    }
  });

  // 6. Publish funding event
  await redis.xadd("funding.executed", "*", {
    type: "funding.executed",
    marketId,
    fundingRate,
    markPrice,
    indexPrice,
    timestamp: Date.now()
  });
}
```

**Funding Rate Examples:**
- Premium Index: +0.5% → Longs pay 0.5% of position value to shorts
- Premium Index: -0.3% → Shorts pay 0.3% of position value to longs
- Cap: ±0.375% (default) prevents extreme funding in volatile conditions

### 4.6 Liquidation Engine Worker

**Trigger:** Price updates from `price.updated` stream

**Margin Check Flow:**
```typescript
async function checkLiquidations(priceUpdate: PriceUpdate) {
  // 1. Get all positions for this market
  const positions = await prisma.position.findMany({
    where: { marketId: priceUpdate.marketId, quantity: { not: 0 } },
    include: { user: { include: { balances: true, positions: true } } }
  });

  for (const position of positions) {
    // 2. Calculate unrealized PnL
    const unrealizedPnl = calculateUnrealizedPnl(
      position,
      priceUpdate.markPrice
    );

    // 3. Calculate total account equity
    const walletBalance = getBalance(position.user, market.quoteAsset);
    const totalUnrealizedPnl = sumUnrealizedPnl(position.user.positions, prices);
    const accountEquity = walletBalance + totalUnrealizedPnl;

    // 4. Calculate total maintenance margin
    const totalMaintenanceMargin = sumMaintenanceMargin(
      position.user.positions,
      prices
    );

    // 5. Check liquidation condition
    if (accountEquity <= totalMaintenanceMargin) {
      await triggerLiquidation({
        userId: position.userId,
        marketId: position.marketId,
        positionQuantity: position.quantity,
        markPrice: priceUpdate.markPrice,
        maintenanceMargin: totalMaintenanceMargin,
        accountEquity
      });
    }
  }
}
```

**Liquidation Process:**
```typescript
async function triggerLiquidation(details: LiquidationDetails) {
  // 1. Create liquidation record
  const liquidation = await prisma.liquidation.create({
    data: {
      ...details,
      status: "TRIGGERED",
      eventId: generateEventId()
    }
  });

  // 2. Submit reduce-only liquidation order
  const side = details.positionQuantity > 0 ? "SELL" : "BUY";
  const quantity = Math.abs(details.positionQuantity);
  
  await submitSystemOrder({
    userId: details.userId,
    marketId: details.marketId,
    side,
    type: "MARKET",
    quantity,
    reduceOnly: true,
    source: "LIQUIDATION",
    liquidationId: liquidation.id
  });

  // 3. Update liquidation status
  await prisma.liquidation.update({
    where: { id: liquidation.id },
    data: { status: "LIQUIDATING" }
  });

  // 4. After fills, check for deficit
  const deficit = accountEquity - totalMaintenanceMargin;
  if (deficit < 0) {
    await handleDeficit(liquidation.id, Math.abs(deficit));
  }
}
```

**Deficit Handling:**
1. **Insurance Fund:** Absorb loss from pooled fund
2. **ADL (Auto-Deleveraging):** Force-close profitable opposite positions
3. **Socialized Loss:** Last resort (not implemented in this reference)

---

## 5. Data Flow Patterns

### 5.1 Order Submission Flow (Production Mode)

```
┌─────────┐
│ Client  │
└────┬────┘
     │ POST /orders
     ▼
┌─────────────────────────────────────────────────────┐
│              API Service                             │
│                                                      │
│ 1. Parse request                                     │
│ 2. Authenticate (JWT)                                │
│ 3. Validate (market exists, valid params)           │
│ 4. Risk pre-check (margin calculation)              │
│                                                      │
│ 5. BEGIN TRANSACTION                                 │
│    ├─ INSERT orders (status=PENDING)                │
│    └─ INSERT outbox_events (type=order.created)     │
│ 6. COMMIT                                            │
│                                                      │
│ 7. Return 202 Accepted {orderId, status: PENDING}   │
└──────────────────────┬──────────────────────────────┘
                       │
     ┌─────────────────┴─────────────────┐
     │                                   │
     ▼                                   ▼
┌─────────────────┐            ┌──────────────────┐
│ PostgreSQL      │            │ Client receives  │
│                 │            │ orderId          │
│ ✓ orders        │            └──────────────────┘
│ ✓ outbox_events │
└────┬────────────┘
     │
     │ Polled by OutboxPublisher (every 100ms)
     ▼
┌─────────────────────────┐
│ OutboxPublisher Worker  │
│                         │
│ 1. SELECT unpublished   │
│ 2. XADD to Redis        │
│ 3. UPDATE status        │
└────┬────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Redis: engine.commands.BTC-PERP  │
│                                  │
│ {                                │
│   type: "order.created",         │
│   orderId: "...",                │
│   userId: "...",                 │
│   side: "BUY",                   │
│   ...                            │
│ }                                │
└────┬─────────────────────────────┘
     │
     │ XREADGROUP by Matching Engine
     ▼
┌──────────────────────────────┐
│ Matching Engine Worker       │
│                              │
│ 1. Validate order            │
│ 2. Check post-only           │
│ 3. Match against book        │
│ 4. Generate fills            │
│ 5. Update book state         │
│ 6. Increment sequence        │
└────┬─────────────────────────┘
     │
     │ XADD events
     ▼
┌────────────────────────────────────────┐
│ Redis: engine.events.BTC-PERP          │
│                                        │
│ [                                      │
│   {type: "order.accepted", ...},       │
│   {type: "trade.executed", ...},       │
│   {type: "order.rested", ...}          │
│ ]                                      │
└────┬──────────────┬────────────────────┘
     │              │
     │              └──────────────────┐
     ▼                                 ▼
┌──────────────────┐         ┌─────────────────┐
│ Persistence      │         │ WebSocket       │
│ Worker           │         │ Fanout          │
│                  │         │                 │
│ XREADGROUP       │         │ XREAD events    │
│ ↓                │         │ ↓               │
│ $transaction {   │         │ Publish to      │
│   ✓ fills        │         │ subscribed      │
│   ✓ positions    │         │ clients         │
│   ✓ balances     │         └────────┬────────┘
│   ✓ ledger       │                  │
│   ✓ orders       │                  ▼
│   ✓ processed    │         ┌─────────────────┐
│ }                │         │ Connected       │
│ ↓                │         │ WebSocket       │
│ XACK to Redis    │         │ Clients         │
└────┬─────────────┘         │                 │
     │                       │ Receive:        │
     ▼                       │ - trades        │
┌──────────────────┐         │ - positions     │
│ PostgreSQL       │         │ - orderbook     │
│                  │         └─────────────────┘
│ ✓ Final state    │
└──────────────────┘
```

### 5.2 Price Update to Liquidation Flow

```
Binance        Market Data      Redis         Liquidation      Matching
WebSocket      Service          Streams       Worker           Engine
   │              │                │              │               │
   │─price────────▶               │              │               │
   │              │─normalize─────▶              │               │
   │              │  XADD          │              │               │
   │              │  price.updated │              │               │
   │              │                │◀─XREAD───────┤               │
   │              │                │              │               │
   │              │                │         check margins        │
   │              │                │         ↓                    │
   │              │                │         found violation      │
   │              │                │         ↓                    │
   │              │                │         create liquidation   │
   │              │                │         ↓                    │
   │              │                │         submit market order  │
   │              │                │         (reduce-only)        │
   │              │                │              │               │
   │              │                │◀─────XADD────┤               │
   │              │                │  order.created               │
   │              │                │              │               │
   │              │                │──────────────────────XREAD──▶│
   │              │                │              │          match│
   │              │                │              │          ↓    │
   │              │                │◀─────────────────XADD───────┤│
   │              │                │  trade.executed              │
   │              │                │              │               │
```

---

## 6. Database Schema

### 6.1 Schema Overview

**17 Core Tables:**

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `users` | User accounts | → balances, orders, positions |
| `api_keys` | API authentication | → users |
| `markets` | Market configuration | → orders, fills, positions |
| `balances` | User asset holdings | → users |
| `ledger_entries` | Audit trail | → users |
| `orders` | Order requests | → users, markets, fills |
| `fills` | Trade executions | → orders, users, markets |
| `positions` | Open positions | → users, markets |
| `funding_payments` | Funding history | → users, markets |
| `liquidations` | Liquidation events | → users, markets |
| `insurance_funds` | Insurance pool | (standalone) |
| `processed_events` | Idempotency tracking | (standalone) |
| `outbox_events` | Transactional outbox | (standalone) |
| `snapshot_metadata` | Recovery metadata | → markets |

### 6.2 Critical Constraints

**Uniqueness Constraints:**
```sql
-- Prevent duplicate user emails
UNIQUE(users.email)

-- Prevent duplicate API keys
UNIQUE(api_keys.keyHash)

-- Prevent duplicate market symbols
UNIQUE(markets.symbol)

-- One balance record per user per asset
UNIQUE(balances.userId, balances.asset)

-- Prevent duplicate client order IDs per user
UNIQUE(orders.userId, orders.clientOrderId)

-- Prevent duplicate fills for same trade
UNIQUE(fills.tradeId, fills.orderId)

-- One position per user per market
UNIQUE(positions.userId, positions.marketId)

-- Prevent duplicate funding payments
UNIQUE(funding_payments.eventId)

-- Prevent duplicate liquidations
UNIQUE(liquidations.eventId)

-- Prevent duplicate event processing
UNIQUE(processed_events.eventId)
```

**Indexes for Performance:**
```sql
-- Fast user lookups
INDEX(api_keys.userId)

-- Fast order queries
INDEX(orders.userId, orders.marketId, orders.createdAt)
INDEX(orders.marketId, orders.status)

-- Fast fill queries
INDEX(fills.userId, fills.marketId, fills.createdAt)
INDEX(fills.eventId)

-- Fast ledger queries
INDEX(ledger_entries.userId, ledger_entries.createdAt)
INDEX(ledger_entries.referenceId)

-- Fast outbox processing
INDEX(outbox_events.status, outbox_events.createdAt)
INDEX(outbox_events.aggregateType, outbox_events.aggregateId)

-- Fast snapshot lookups
INDEX(snapshot_metadata.marketId, snapshot_metadata.createdAt)
```

### 6.3 Ledger Entry Types

```typescript
enum LedgerEntryType {
  DEPOSIT                   // User deposits collateral
  TRADING_FEE              // Maker/taker fees charged
  REALIZED_PNL             // Profit/loss from position reduction
  FUNDING_PAYMENT          // Periodic funding payment
  LIQUIDATION_LOSS         // Loss from liquidation
  INSURANCE_FUND_TRANSFER  // Transfer to insurance fund
  INSURANCE_FUND_CREDIT    // Credit from insurance fund
  ADL_SETTLEMENT           // Auto-deleveraging settlement
}
```

**Ledger Entry Flow Example:**
```
User fills a position-reducing order:

1. Fill created: 
   - Quantity: 0.5 BTC
   - Entry price: $60,000
   - Exit price: $65,000
   - Side: LONG

2. Ledger entries:
   a. TRADING_FEE: -$16.25 (0.5 × $65,000 × 0.0005)
   b. REALIZED_PNL: +$2,500 ((65,000 - 60,000) × 0.5)

3. Balance update:
   - Previous: $10,000
   - After: $12,483.75 ($10,000 + $2,500 - $16.25)
```

---

## 7. Redis Streams Design

### 7.1 Stream Naming Convention

```
engine.commands.{marketId}    // Per-market command queue
engine.events.{marketId}      // Per-market event log
price.updated                 // Global price feed
position.updated              // Position change notifications
funding.executed              // Funding payment notifications
liquidation.triggered         // Liquidation notifications
```

### 7.2 Consumer Groups

```
Group: matching-engine:BTC-PERP
  Consumer: matching-worker-1
  Reads: engine.commands.BTC-PERP
  Purpose: Single consumer for deterministic matching

Group: persistence-worker
  Consumer: persistence-worker-1 (can scale horizontally)
  Reads: engine.events.* (all markets)
  Purpose: Persist fills, positions, balances

Group: websocket-public
  Consumer: ws-fanout-1 (can scale horizontally)
  Reads: engine.events.*, price.updated, funding.executed
  Purpose: Fan out to WebSocket subscribers

Group: market-risk
  Consumer: risk-worker-1
  Reads: price.updated, position.updated
  Purpose: Check margins and trigger liquidations
```

### 7.3 Message Structure

**Command Message:**
```json
{
  "type": "order.created",
  "commandId": "cmd-uuid-1234",
  "timestamp": 1710000000000,
  "orderId": "order-xyz",
  "userId": "user-abc",
  "marketId": "BTC-PERP",
  "side": "BUY",
  "orderType": "LIMIT",
  "quantity": "1.5",
  "price": "65000",
  "timeInForce": "GTC",
  "reduceOnly": false,
  "postOnly": false
}
```

**Event Message:**
```json
{
  "type": "trade.executed",
  "eventId": "evt-uuid-5678",
  "sequence": 12345,
  "timestamp": 1710000001000,
  "tradeId": "trade-abc",
  "marketId": "BTC-PERP",
  "makerOrderId": "order-123",
  "takerOrderId": "order-456",
  "makerUserId": "user-aaa",
  "takerUserId": "user-bbb",
  "priceTicks": 6500000,
  "qtyLots": 150,
  "notional": "97500.00",
  "makerFee": "19.50",
  "takerFee": "48.75"
}
```

### 7.4 Idempotency Strategy

**Three-Level Idempotency:**

1. **Command Level:**
   - Each command has unique `commandId`
   - Matching engine checks if already processed
   - Prevents duplicate order submissions

2. **Event Level:**
   - Each event has unique `eventId`
   - Persistence worker checks `processed_events` table
   - Prevents duplicate database writes

3. **Database Level:**
   - Unique constraints on critical fields
   - Database will reject duplicates even if checks fail

**Crash Scenarios:**

| Scenario | Recovery |
|----------|----------|
| API crashes after DB write, before outbox publish | Outbox publisher picks up unpublished events |
| Matching engine crashes after emitting event | Event persisted in Redis, re-consumed on restart |
| Persistence worker crashes after DB write | Event marked processed, XACK not sent → re-consumed but idempotency prevents duplicate |
| Redis crashes | Rebuild orderbook from latest snapshot + PostgreSQL orders |

---

## 8. Matching Engine Deep Dive

### 8.1 Data Structure Design

**Why Treap for Price Levels:**
- Self-balancing (no manual rotations like AVL/Red-Black)
- Randomized priority maintains O(log n) expected height
- Simpler implementation than deterministic BSTs
- Fast best-price access: O(log n) or O(1) with cached pointer

**Price-Time Priority Implementation:**
```
OrderBook
  ├─ bids (descending treap)
  │   ├─ $65,100 [order-1 → order-2 → order-3]
  │   ├─ $65,000 [order-4 → order-5]
  │   └─ $64,900 [order-6]
  │
  └─ asks (ascending treap)
      ├─ $65,200 [order-7 → order-8]
      ├─ $65,300 [order-9]
      └─ $65,400 [order-10 → order-11]
```

**Order Lifecycle States:**
```
PENDING     → Order submitted to API, awaiting matching
  ↓
OPEN        → Order accepted by matching engine, on book
  ↓
PARTIALLY_FILLED → Some quantity filled, remainder still on book
  ↓
FILLED      → Fully executed
CANCELLED   → User cancelled or system cancelled
REJECTED    → Failed validation
EXPIRED     → IOC/FOK expired
```

### 8.2 Self-Trade Prevention

**Strategy: Expire Taker**

```typescript
function matchOrder(book: OrderBook, incomingOrder: Order) {
  while (incomingOrder.remainingQty > 0 && book.canMatch(incomingOrder)) {
    const makerOrder = book.getBestOpposite(incomingOrder.side);
    
    // Self-trade check
    if (makerOrder.userId === incomingOrder.userId) {
      // Cancel the incoming (taker) order
      emitEvent({
        type: "order.expired",
        orderId: incomingOrder.orderId,
        reason: "self_trade_prevention"
      });
      return;
    }
    
    // Normal matching continues...
  }
}
```

**Why Expire Taker:**
- Simple and deterministic
- Maker order was first, gets priority
- Prevents wash trading
- Easy to explain in documentation

**Alternative Strategies (not implemented):**
- Cancel maker: Remove maker order instead
- Cancel both: Remove both orders
- Decrement and cancel: Reduce quantities of both

### 8.3 Post-Only Orders

**Rule:** Reject if would immediately execute

```typescript
function wouldCross(book: OrderBook, order: LimitOrder): boolean {
  if (order.side === "BUY") {
    const bestAsk = book.getBestAsk();
    return bestAsk && bestAsk.priceTicks <= order.priceTicks;
  } else {
    const bestBid = book.getBestBid();
    return bestBid && bestBid.priceTicks >= order.priceTicks;
  }
}

// In matching logic
if (order.postOnly && wouldCross(book, order)) {
  emitEvent({
    type: "order.rejected",
    orderId: order.orderId,
    reason: "post_only_would_cross"
  });
  return;
}
```

### 8.4 Reduce-Only Orders

**Purpose:** Close or reduce positions without increasing exposure

**Implementation:**
- API performs pre-check using current position
- Matching engine allows order through (doesn't know positions)
- Persistence worker validates fill didn't increase position
- If violation detected, reverse the fill (compensating transaction)

**Example:**
```
User has: LONG 1.0 BTC
User submits: SELL 2.0 BTC (reduce-only)

Expected:
- First 1.0 BTC: Closes position (allowed)
- Next 1.0 BTC: Would open SHORT (violation)

Action:
- Allow only 1.0 BTC fill
- Cancel remaining 1.0 BTC
```

---

## 9. Risk Management System

### 9.1 Cross-Margin Model

**Single Collateral Asset:** USDC (quote asset)

**Account-Level Calculations:**
```typescript
// For each market position
positions.forEach(position => {
  const notional = Math.abs(position.quantity) * markPrice;
  const initialMargin = notional / position.leverage;
  const maintenanceMargin = notional * market.maintenanceMarginRate;
  const unrealizedPnl = calculateUnrealizedPnl(position, markPrice);
  
  totalNotional += notional;
  totalInitialMargin += initialMargin;
  totalMaintenanceMargin += maintenanceMargin;
  totalUnrealizedPnl += unrealizedPnl;
});

// Account equity
const walletBalance = getBalance(userId, "USDC");
const accountEquity = walletBalance + totalUnrealizedPnl;

// Available for new orders
const availableMargin = accountEquity - totalInitialMargin - openOrderMargin;
```

### 9.2 Leverage Configuration

**Per-Market Leverage:**
```typescript
// BTC-PERP example
{
  maxLeverage: 20,
  initialMarginRate: 0.05,      // 5% = 20x leverage
  maintenanceMarginRate: 0.025   // 2.5% = 40x effective
}
```

**Leverage Choice:**
- User selects leverage when opening position (1x to maxLeverage)
- Higher leverage = lower initial margin required
- But maintenance margin stays fixed (based on notional, not leverage)
- This means high-leverage positions liquidate faster

### 9.3 Position State Machine

```
          ┌──────────┐
          │   FLAT   │ (quantity = 0)
          └────┬─────┘
               │
       ┌───────┴───────┐
       │               │
  BUY order       SELL order
       │               │
       ▼               ▼
  ┌────────┐      ┌────────┐
  │  LONG  │      │ SHORT  │
  └───┬────┘      └────┬───┘
      │                │
      │  Increase      │  Increase
      │  (same side)   │  (same side)
      │                │
      ├──────────┐     ├──────────┐
      │          │     │          │
      │  Reduce  │     │  Reduce  │
      │  (opp)   │     │  (opp)   │
      │          │     │          │
      └────┬─────┘     └─────┬────┘
           │                 │
       Close or           Close or
       Reverse            Reverse
           │                 │
           └────────┬────────┘
                    │
                    ▼
               ┌──────────┐
               │   FLAT   │
               │    or    │
               │ Reversed │
               └──────────┘
```

**Realized PnL Calculation:**
```typescript
function calculateRealizedPnl(
  currentPosition: Position,
  fill: Fill,
  markPrice: number
): number {
  // Only realize PnL when reducing position
  if (!isReducing(currentPosition, fill)) {
    return 0;
  }

  const closeQty = Math.min(
    Math.abs(currentPosition.quantity),
    fill.quantity
  );

  if (currentPosition.side === "LONG") {
    // Long: profit when price goes up
    return (fill.price - currentPosition.entryPrice) * closeQty;
  } else {
    // Short: profit when price goes down
    return (currentPosition.entryPrice - fill.price) * closeQty;
  }
}
```

### 9.4 Liquidation Price Calculation

```typescript
function calculateLiquidationPrice(
  position: Position,
  walletBalance: number,
  openOrderMargin: number
): number | null {
  if (position.quantity === 0) return null;

  const notional = Math.abs(position.quantity) * position.entryPrice;
  const maintenanceMargin = notional * market.maintenanceMarginRate;
  
  // Liquidation occurs when:
  // walletBalance + unrealizedPnl = maintenanceMargin
  
  if (position.side === "LONG") {
    // unrealizedPnl = (liquidationPrice - entryPrice) * quantity
    // walletBalance + (liquidationPrice - entryPrice) * quantity = maintenanceMargin
    // liquidationPrice = (maintenanceMargin - walletBalance) / quantity + entryPrice
    return (maintenanceMargin - walletBalance) / position.quantity + position.entryPrice;
  } else {
    // unrealizedPnl = (entryPrice - liquidationPrice) * quantity
    // walletBalance + (entryPrice - liquidationPrice) * quantity = maintenanceMargin
    // liquidationPrice = entryPrice - (maintenanceMargin - walletBalance) / quantity
    return position.entryPrice - (maintenanceMargin - walletBalance) / Math.abs(position.quantity);
  }
}
```

**Example:**
```
Position: LONG 1.0 BTC @ $60,000
Wallet: $3,000
Maintenance margin rate: 2.5%
Maintenance margin: $60,000 × 0.025 = $1,500

Liquidation price:
= ($1,500 - $3,000) / 1.0 + $60,000
= -$1,500 + $60,000
= $58,500

If BTC drops to $58,500, position gets liquidated.
```

---

## 10. Funding Rate Mechanism

### 10.1 Purpose

Keeps perpetual futures price anchored to spot price by incentivizing arbitrage.

- **Positive Funding:** Perp > Spot → Longs pay shorts → Incentivizes shorting
- **Negative Funding:** Perp < Spot → Shorts pay longs → Incentivizes longing

### 10.2 Calculation Formula

```typescript
// 1. Premium Index
const premiumIndex = (markPrice - indexPrice) / indexPrice;

// 2. Funding Rate (capped)
const fundingRate = clamp(
  premiumIndex,
  -market.fundingRateCap,   // e.g., -0.00375 (-0.375%)
  market.fundingRateCap     // e.g., +0.00375 (+0.375%)
);

// 3. Payment per position
const notional = Math.abs(position.quantity) * markPrice;
const payment = notional * fundingRate;

// 4. Direction
if (position.side === "LONG") {
  // Longs pay if funding is positive
  paymentAmount = -payment;
} else {
  // Shorts receive if funding is positive
  paymentAmount = payment;
}
```

### 10.3 Funding Interval

**Default:** Every 8 hours (00:00, 08:00, 16:00 UTC)

**Worker Logic:**
```typescript
setInterval(async () => {
  const now = new Date();
  const markets = await getActiveMarkets();
  
  for (const market of markets) {
    const lastFunding = await getLastFundingTime(market.id);
    const intervalMs = market.fundingIntervalHours * 3600 * 1000;
    
    if (now.getTime() - lastFunding.getTime() >= intervalMs) {
      await executeFunding(market.id);
    }
  }
}, 60000); // Check every minute
```

**Impact on Balances:**
```
User A (Long 1.0 BTC):
  Funding rate: +0.1%
  Mark price: $65,000
  Payment: -$65 (pays shorts)

User B (Short 0.5 BTC):
  Funding rate: +0.1%
  Mark price: $65,000
  Payment: +$32.50 (receives from longs)
```

---

## 11. Liquidation & ADL System

### 11.1 Liquidation Trigger

**Condition:**
```
accountEquity <= totalMaintenanceMargin
```

**Detection:**
- Triggered by price updates from `price.updated` stream
- Liquidation worker recalculates all position margins
- Identifies accounts in liquidation zone

### 11.2 Liquidation Process

**Phase 1: Market Liquidation**
```typescript
// 1. Mark account as liquidating
await prisma.liquidation.create({
  data: { userId, marketId, status: "TRIGGERED", ... }
});

// 2. Submit system market order (reduce-only)
const side = position.quantity > 0 ? "SELL" : "BUY";
await submitOrder({
  userId,
  marketId,
  side,
  type: "MARKET",
  quantity: Math.abs(position.quantity),
  reduceOnly: true,
  source: "LIQUIDATION"
});

// 3. Order matches against orderbook liquidity
// 4. Position closes at available prices
```

**Phase 2: Deficit Handling**

If account equity after liquidation is still negative:

```typescript
async function handleDeficit(liquidationId: string, deficit: number) {
  // Step 1: Try insurance fund
  const insuranceFund = await prisma.insuranceFund.findUnique({
    where: { asset: "USDC" }
  });

  if (insuranceFund.balance >= deficit) {
    // Insurance fund covers loss
    await prisma.$transaction([
      prisma.insuranceFund.update({
        where: { asset: "USDC" },
        data: { balance: insuranceFund.balance - deficit }
      }),
      prisma.ledgerEntry.create({
        data: {
          type: "INSURANCE_FUND_TRANSFER",
          asset: "USDC",
          amount: -deficit,
          referenceId: liquidationId
        }
      }),
      prisma.liquidation.update({
        where: { id: liquidationId },
        data: { 
          status: "INSURANCE_FUND_USED",
          insuranceFundUsed: deficit
        }
      })
    ]);
    return;
  }

  // Step 2: Insurance fund insufficient, trigger ADL
  await executeADL(liquidationId, deficit);
}
```

### 11.3 Auto-Deleveraging (ADL)

**Purpose:** Socialize losses when insurance fund depleted

**Selection Algorithm:**
```typescript
async function executeADL(liquidationId: string, deficit: number) {
  // 1. Find opposite positions in same market
  const oppositePositions = await prisma.position.findMany({
    where: {
      marketId: liquidation.marketId,
      side: liquidation.position.side === "LONG" ? "SHORT" : "LONG",
      quantity: { not: 0 }
    },
    include: { user: true }
  });

  // 2. Calculate ADL score for ranking
  const scored = oppositePositions.map(pos => {
    const unrealizedPnl = calculateUnrealizedPnl(pos, markPrice);
    const pnlPercent = unrealizedPnl / (pos.entryPrice * Math.abs(pos.quantity));
    const notional = Math.abs(pos.quantity) * markPrice;
    const effectiveLeverage = notional / (user.walletBalance + unrealizedPnl);
    
    return {
      position: pos,
      score: pnlPercent * effectiveLeverage  // Higher score = more profitable + levered
    };
  });

  // 3. Sort by ADL score (highest first)
  scored.sort((a, b) => b.score - a.score);

  // 4. Force-close positions until deficit covered
  let remainingDeficit = deficit;
  for (const { position } of scored) {
    if (remainingDeficit <= 0) break;

    const closeQty = Math.min(
      Math.abs(position.quantity),
      remainingDeficit / markPrice
    );

    await forceClosePosition({
      userId: position.userId,
      marketId: position.marketId,
      quantity: closeQty,
      price: markPrice,
      reason: "ADL",
      liquidationId
    });

    remainingDeficit -= closeQty * markPrice;
  }

  // 5. Update liquidation record
  await prisma.liquidation.update({
    where: { id: liquidationId },
    data: {
      status: "ADL_USED",
      adlUsed: deficit - remainingDeficit
    }
  });
}
```

**ADL Example:**
```
Liquidated: User A loses $10,000 beyond insurance fund capacity

Opposite positions (sorted by ADL score):
1. User B: SHORT 1 BTC, 300% PnL, 15x leverage → Score: 45
2. User C: SHORT 2 BTC, 200% PnL, 10x leverage → Score: 20
3. User D: SHORT 0.5 BTC, 100% PnL, 5x leverage → Score: 5

ADL executes:
- User B's 1 BTC closed at mark price → Covers $65,000 of deficit
- Remaining deficit cleared or continues down the list
```

### 11.4 Insurance Fund

**Funding Sources:**
- Liquidation fees (configurable percentage)
- Exchange revenue allocation
- Initial seed capital

**Purpose:**
- Absorb losses from underwater liquidations
- Prevent ADL in most cases
- Build buffer during profitable periods

```typescript
// Liquidation fee example
const liquidationFee = notional * 0.005; // 0.5%

await prisma.$transaction([
  prisma.insuranceFund.update({
    where: { asset: "USDC" },
    data: { balance: { increment: liquidationFee } }
  }),
  prisma.ledgerEntry.create({
    data: {
      type: "INSURANCE_FUND_CREDIT",
      asset: "USDC",
      amount: liquidationFee
    }
  })
]);
```

---

## 12. WebSocket Architecture

### 12.1 Connection Flow

```
Client                    WebSocket Server              Hub
  │                             │                        │
  │───── GET /ws ──────────────▶│                        │
  │◀──── 101 Switching ─────────│                        │
  │                             │                        │
  │──{ op: "subscribe",         │                        │
  │    channel: "trades",       │                        │
  │    market: "BTC-PERP" }────▶│                        │
  │                             │─── subscribe() ───────▶│
  │                             │                        │ (store subscription)
  │                             │◀─── snapshot ──────────│
  │◀──{ type: "snapshot",       │                        │
  │     data: [...] }───────────│                        │
  │                             │                        │
  │◀──{ type: "subscribed" }────│                        │
  │                             │                        │
  │                         [matching engine emits trade]│
  │                             │                        │
  │                             │◀─── publish() ─────────│
  │◀──{ type: "update",         │                        │ (fanout to all subscribers)
  │     sequence: 123,          │                        │
  │     data: {...} }───────────│                        │
```

### 12.2 Subscription Message Format

**Subscribe:**
```json
{
  "op": "subscribe",
  "channel": "orderbook",
  "market": "BTC-PERP",
  "depth": 20
}
```

**Subscribe (Private):**
```json
{
  "op": "subscribe",
  "channel": "positions",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Unsubscribe:**
```json
{
  "op": "unsubscribe",
  "channel": "trades",
  "market": "BTC-PERP"
}
```

### 12.3 Channel Data Formats

**Trades Update:**
```json
{
  "type": "update",
  "channel": "trades",
  "topic": "trades:BTC-PERP",
  "sequence": 45123,
  "data": {
    "tradeId": "trade-abc-123",
    "price": "65100.00",
    "quantity": "1.5",
    "side": "BUY",
    "timestamp": 1710000000000
  }
}
```

**Orderbook Snapshot:**
```json
{
  "type": "snapshot",
  "channel": "orderbook",
  "topic": "orderbook:BTC-PERP",
  "sequence": 45100,
  "data": {
    "bids": [
      ["65100.00", "2.5"],
      ["65090.00", "1.2"],
      ["65080.00", "3.7"]
    ],
    "asks": [
      ["65110.00", "1.8"],
      ["65120.00", "2.1"],
      ["65130.00", "0.9"]
    ]
  }
}
```

**Orderbook Delta:**
```json
{
  "type": "update",
  "channel": "orderbook",
  "topic": "orderbook:BTC-PERP",
  "sequence": 45101,
  "data": {
    "bids": [
      ["65095.00", "1.5"]  // New level
    ],
    "asks": [
      ["65110.00", "0.8"]  // Updated quantity
    ]
  }
}
```

**Position Update:**
```json
{
  "type": "update",
  "channel": "positions",
  "topic": "positions:user-abc-123",
  "sequence": 892,
  "data": {
    "marketId": "BTC-PERP",
    "side": "LONG",
    "quantity": "2.5",
    "entryPrice": "64000.00",
    "unrealizedPnl": "2750.00",
    "liquidationPrice": "62100.00",
    "leverage": 10
  }
}
```

### 12.4 Sequence Gap Handling

**Client-Side Logic:**
```typescript
let expectedSequence = snapshot.sequence + 1;

ws.on("message", (msg) => {
  const update = JSON.parse(msg);
  
  if (update.sequence !== expectedSequence) {
    console.warn(`Sequence gap detected: expected ${expectedSequence}, got ${update.sequence}`);
    
    // Request resync
    ws.send(JSON.stringify({
      op: "subscribe",
      channel: update.channel,
      market: update.market
    }));
    
    return;
  }
  
  expectedSequence++;
  applyUpdate(update.data);
});
```

**Server-Side Resync:**
```typescript
if (detectedGap) {
  ws.send(JSON.stringify({
    type: "resync",
    topic: `orderbook:${marketId}`,
    reason: "sequence gap detected"
  }));
}
```

---

## 13. Recovery & Disaster Handling

### 13.1 Snapshot Format

**File Structure:**
```json
{
  "market": "BTC-PERP",
  "engineSequence": 45123,
  "lastRedisStreamId": "1710000000000-0",
  "createdAt": 1710000000000,
  "orderBook": {
    "market": "BTC-PERP",
    "sequence": 45123,
    "bids": [
      {
        "priceTicks": 6510000,
        "totalQtyLots": 250,
        "orders": [
          {
            "orderId": "order-abc-123",
            "userId": "user-xyz",
            "side": "buy",
            "type": "limit",
            "qtyLots": 100,
            "remainingQtyLots": 100,
            "priceTicks": 6510000,
            "status": "OPEN",
            "timeInForce": "GTC",
            "reduceOnly": false,
            "postOnly": false,
            "createdAt": 1709999990000,
            "sequence": 45100
          }
        ]
      }
    ],
    "asks": [ /* similar structure */ ]
  }
}
```

### 13.2 Recovery Process

**Step-by-Step:**

1. **Load Latest Snapshot:**
```typescript
const snapshotMeta = await prisma.snapshotMetadata.findFirst({
  where: { marketId },
  orderBy: { createdAt: "desc" }
});

const snapshot = await fs.readFile(snapshotMeta.snapshotPath, "utf-8");
const data = JSON.parse(snapshot);
```

2. **Restore Orderbook State:**
```typescript
const orderBook = new OrderBook(data.orderBook.market);
orderBook.sequence = data.orderBook.sequence;

// Rebuild price levels
for (const bidLevel of data.orderBook.bids) {
  for (const order of bidLevel.orders) {
    orderBook.restoreOrder(order);
  }
}
```

3. **Replay Events from Redis:**
```typescript
const events = await redis.xrange(
  `engine.events.${marketId}`,
  data.lastRedisStreamId,
  "+"  // Read to end
);

for (const event of events) {
  applyEventToOrderBook(orderBook, event);
}
```

4. **Resume Normal Operation:**
```typescript
console.log(`Recovered ${marketId} to sequence ${orderBook.sequence}`);
startCommandConsumer(marketId, orderBook);
```

### 13.3 Event Replay Logic

**Replayable Events:**
```typescript
function applyEventToOrderBook(book: OrderBook, event: Event) {
  switch (event.type) {
    case "order.rested":
      // Re-add order to book
      book.restoreOrder(event.order);
      break;

    case "trade.executed":
      // Update maker/taker remaining quantities
      const maker = book.getOrder(event.makerOrderId);
      const taker = book.getOrder(event.takerOrderId);
      
      if (maker) {
        maker.remainingQtyLots -= event.qtyLots;
        if (maker.remainingQtyLots === 0) {
          book.remove(maker);
        }
      }
      
      if (taker) {
        taker.remainingQtyLots -= event.qtyLots;
        if (taker.remainingQtyLots === 0) {
          book.remove(taker);
        }
      }
      break;

    case "order.cancelled":
      const order = book.getOrder(event.orderId);
      if (order) {
        book.remove(order);
      }
      break;

    // No-op events (already reflected in fills)
    case "order.accepted":
    case "order.rejected":
    case "order.expired":
      break;
  }
  
  book.sequence = Math.max(book.sequence, event.sequence);
}
```

### 13.4 Disaster Scenarios

| Scenario | Recovery Strategy | Data Loss |
|----------|-------------------|-----------|
| **Matching engine crash** | Load snapshot + replay Redis events | None (events in Redis) |
| **Redis crash** | Rebuild from PostgreSQL + snapshots | Open orders may need resubmission |
| **PostgreSQL crash** | Restore from backup | Depends on backup frequency |
| **Full system crash** | Restore PG backup → Load snapshots → Replay available Redis events | Minimal if recent backup |
| **Snapshot corruption** | Use previous snapshot + longer replay | None if Redis has full history |
| **Network partition** | Matching engine continues → Persistence catches up after | None (at-least-once + idempotency) |

**Redis Stream Retention:**
```bash
# Configure stream trimming
XTRIM engine.events.BTC-PERP MAXLEN ~ 100000

# Or use time-based retention
XTRIM engine.events.BTC-PERP MINID $(date -d '7 days ago' +%s)000-0
```

**Snapshot Rotation:**
```typescript
// Keep last N snapshots
const snapshotsToKeep = 10;
const snapshots = await prisma.snapshotMetadata.findMany({
  where: { marketId },
  orderBy: { createdAt: "desc" }
});

if (snapshots.length > snapshotsToKeep) {
  const toDelete = snapshots.slice(snapshotsToKeep);
  for (const snapshot of toDelete) {
    await fs.unlink(snapshot.snapshotPath);
    await prisma.snapshotMetadata.delete({ where: { id: snapshot.id } });
  }
}
```

---

## 14. Deployment Modes

### 14.1 Local Development Mode

**Configuration:**
```bash
RUNTIME_MODE=local
# No DATABASE_URL required
# No REDIS_URL required
```

**Characteristics:**
- In-memory orderbook, stream bus, user store
- Workers run in-process with API server
- Synchronous execution (no async delays)
- Perfect for tests and learning
- Single `bun run apps/api/src/index.ts` starts everything

**Use Cases:**
- Unit tests
- Integration tests
- Local development
- Educational exploration
- CI/CD pipelines

### 14.2 Production Mode

**Configuration:**
```bash
RUNTIME_MODE=production
DATABASE_URL=postgresql://perp:perp@localhost:5432/perp_v3
REDIS_URL=redis://localhost:6379
JWT_SECRET=<strong-secret>
SNAPSHOT_DIR=./snapshots
BINANCE_WS_URL=wss://fstream.binance.com
```

**Process Topology:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   API Server    │     │  Worker Process  │     │ Market Data     │
│  (apps/api)     │     │  (apps/workers)  │     │ (apps/market-   │
│                 │     │                  │     │  data)          │
│ - HTTP routes   │     │ - Outbox pub     │     │                 │
│ - Auth          │     │ - Matching       │     │ - Binance WS    │
│ - Validation    │     │ - Persistence    │     │ - Price publish │
│ - Risk checks   │     │ - Snapshots      │     │                 │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
           ┌────────▼────────┐       ┌───────▼────────┐
           │   PostgreSQL     │       │     Redis      │
           │                  │       │    Streams     │
           └──────────────────┘       └────────────────┘
```

**Scaling Strategies:**

| Component | Scaling Approach | Bottleneck |
|-----------|------------------|------------|
| **API** | Horizontal (load balancer) | Database connections |
| **Matching Engine** | One per market (vertical) | CPU, memory |
| **Persistence Worker** | Horizontal (consumer group) | Database write throughput |
| **WebSocket** | Horizontal (sticky sessions) | Network bandwidth |
| **Market Data** | Single instance (or failover) | Upstream API limits |

**High-Availability Setup:**
```yaml
# docker-compose.prod.yml
services:
  api:
    replicas: 3
    deploy:
      resources:
        limits: { cpus: "2", memory: "4G" }
  
  matching-btc:
    command: ["bun", "run", "matching-worker", "--market", "BTC-PERP"]
    deploy:
      resources:
        limits: { cpus: "4", memory: "8G" }
  
  matching-eth:
    command: ["bun", "run", "matching-worker", "--market", "ETH-PERP"]
  
  persistence:
    replicas: 2
  
  websocket:
    replicas: 3
  
  postgres:
    volumes:
      - type: volume
        source: pg_data
        target: /var/lib/postgresql/data
    deploy:
      placement:
        constraints: [node.role == manager]
  
  redis:
    volumes:
      - type: volume
        source: redis_data
        target: /data
```

---

## 15. Security Architecture

### 15.1 Authentication Flow

**JWT-Based Authentication:**
```typescript
// Login
POST /auth/login
{
  "email": "trader@example.com",
  "password": "secure-password"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-abc-123"
}

// Subsequent requests
GET /positions
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Validation:**
```typescript
async function authenticate(token: string | undefined): Promise<User> {
  if (!token) {
    throw new AuthError("Missing authorization token");
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  
  try {
    const { payload } = await jwtVerify(token, secret);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    });
    
    if (!user || user.status !== "ACTIVE") {
      throw new AuthError("Invalid or inactive user");
    }
    
    return user;
  } catch (error) {
    throw new AuthError("Invalid token");
  }
}
```

### 15.2 Password Security

**Hashing with Bun.password:**
```typescript
// Registration
async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10
  });
}

// Login verification
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
```

**Password Policy (Recommended):**
- Minimum 12 characters
- Must include uppercase, lowercase, number, special character
- Check against common password lists
- Rate limit login attempts

### 15.3 API Key Authentication

**Alternative to JWT:**
```typescript
// Generate API key
const apiKey = generateSecureRandomString(32);
const keyHash = await hashApiKey(apiKey);

await prisma.apiKey.create({
  data: {
    userId,
    keyHash,
    name: "Trading Bot Key"
  }
});

// Return raw key ONCE (never stored)
return { apiKey };  // e.g., "apk_live_abc123..."

// Validate API key
async function authenticateApiKey(key: string): Promise<User> {
  const keyHash = await hashApiKey(key);
  
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true }
  });
  
  if (!apiKey || apiKey.disabledAt) {
    throw new AuthError("Invalid API key");
  }
  
  return apiKey.user;
}
```

### 15.4 Authorization Checks

**Resource Ownership:**
```typescript
// Cancel order
async function cancelOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  if (!order) {
    throw new NotFoundError("Order not found");
  }
  
  if (order.userId !== userId) {
    throw new ForbiddenError("Not authorized to cancel this order");
  }
  
  // Proceed with cancellation...
}
```

**Private WebSocket Topics:**
```typescript
// positions:{userId} requires authentication
if (channel === "positions") {
  if (!token) {
    ws.send(JSON.stringify({ type: "error", reason: "authentication required" }));
    ws.close();
    return;
  }
  
  const user = await authenticate(token);
  const topic = `positions:${user.id}`;  // Use authenticated user ID
  
  hub.subscribe(ws, topic);
}
```

### 15.5 Rate Limiting

**Per-User Limits:**
```typescript
// Example using Redis
const rateLimitKey = `ratelimit:${userId}:orders`;
const count = await redis.incr(rateLimitKey);

if (count === 1) {
  await redis.expire(rateLimitKey, 60);  // 60 second window
}

if (count > 100) {  // Max 100 orders per minute
  throw new RateLimitError("Order rate limit exceeded");
}
```

**Recommended Limits:**
| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /orders | 100 | 1 minute |
| DELETE /orders/:id | 100 | 1 minute |
| GET /positions | 300 | 1 minute |
| GET /fills | 300 | 1 minute |
| POST /auth/login | 5 | 15 minutes |
| WebSocket connections | 10 | 1 minute |

### 15.6 Input Validation

**Order Validation Example:**
```typescript
function validateOrderRequest(req: any) {
  const errors: string[] = [];

  // Market ID
  if (!req.marketId || typeof req.marketId !== "string") {
    errors.push("marketId is required");
  }

  // Side
  if (!["BUY", "SELL"].includes(req.side)) {
    errors.push("side must be BUY or SELL");
  }

  // Type
  if (!["MARKET", "LIMIT"].includes(req.type)) {
    errors.push("type must be MARKET or LIMIT");
  }

  // Quantity
  const qty = parseDecimal(req.quantity);
  if (qty.isNaN() || qty.lte(0)) {
    errors.push("quantity must be positive");
  }

  // Price (required for limit orders)
  if (req.type === "LIMIT") {
    const price = parseDecimal(req.price);
    if (price.isNaN() || price.lte(0)) {
      errors.push("price must be positive for limit orders");
    }
  }

  // Leverage
  if (req.leverage !== undefined) {
    const leverage = parseInt(req.leverage);
    if (isNaN(leverage) || leverage < 1 || leverage > 20) {
      errors.push("leverage must be between 1 and 20");
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(", "));
  }
}
```

---

## 16. Performance Characteristics

### 16.1 Orderbook Operations

| Operation | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Insert order | O(log n) | O(1) |
| Cancel order | O(1) lookup + O(log n) tree | O(1) |
| Match order | O(log n × k) | O(k) fills |
| Get best bid/ask | O(log n) or O(1) cached | O(1) |
| Snapshot orderbook | O(n) all orders | O(n) |
| Recover from snapshot | O(n) restore + O(m) replay | O(n + m) |

Where:
- n = number of price levels
- k = number of fills generated
- m = number of events to replay

### 16.2 Database Query Performance

**Critical Indexes:**
```sql
-- Fast order lookups (< 10ms)
CREATE INDEX idx_orders_user_market ON orders(userId, marketId, createdAt);

-- Fast fill queries (< 10ms)
CREATE INDEX idx_fills_user_market ON fills(userId, marketId, createdAt);

-- Efficient position lookups (< 5ms)
CREATE UNIQUE INDEX idx_positions_user_market ON positions(userId, marketId);

-- Outbox processing (< 5ms)
CREATE INDEX idx_outbox_status ON outbox_events(status, createdAt);
```

**Expected Throughput:**
- Order submission: 1,000 orders/sec (API limited by validation + DB writes)
- Matching: 10,000 commands/sec per market (in-memory orderbook)
- Persistence: 5,000 events/sec (PostgreSQL write throughput)
- WebSocket fanout: 100,000 messages/sec (network limited)

### 16.3 Memory Usage

**Per Market Orderbook:**
```
Assuming:
- 1,000 open orders per market
- 100 price levels
- ~500 bytes per order node

Memory per market: ~0.5 MB

For 10 markets: ~5 MB orderbook data
```

**Redis Stream Memory:**
```
Per event: ~1 KB
Retention: 100,000 events per market

Memory per market: ~100 MB
For 10 markets: ~1 GB
```

### 16.4 Latency Benchmarks

**Target Latencies (p99):**
- Order submission (API → PostgreSQL): < 50ms
- Matching engine processing: < 5ms
- Persistence worker: < 100ms
- WebSocket message delivery: < 10ms
- End-to-end (submit → fill → WebSocket): < 200ms

**Bottlenecks:**
1. **PostgreSQL writes** (outbox + persistence)
   - Solution: Connection pooling, batch writes, read replicas
2. **Redis network latency** (multi-region)
   - Solution: Regional Redis clusters, local caching
3. **WebSocket fanout** (many subscribers)
   - Solution: Horizontal scaling, topic sharding

---

## 17. Testing Strategy

### 17.1 Test Coverage by Layer

**Unit Tests (Packages):**
```
packages/matching-engine/
  ✓ Price-time priority
  ✓ Partial fills
  ✓ Self-trade prevention
  ✓ Post-only rejection
  ✓ Market order exhaustion
  ✓ Cancel order
  ✓ Snapshot + recovery

packages/risk/
  ✓ Margin calculations
  ✓ Position updates (open/increase/reduce/close/reverse)
  ✓ Unrealized PnL
  ✓ Liquidation price
  ✓ ADL scoring

packages/db/
  ✓ Idempotency enforcement
  ✓ Concurrent updates
  ✓ Transaction rollbacks
```

**Integration Tests (Apps):**
```
apps/api/
  ✓ Order submission → matching → persistence
  ✓ Deposit → order → fill → balance update
  ✓ WebSocket subscription → event delivery
  ✓ Funding execution → balance changes
  ✓ Liquidation trigger → position closure
  ✓ Outbox reliability (crash recovery)

apps/workers/
  ✓ Outbox publisher retry logic
  ✓ Persistence worker idempotency
  ✓ Snapshot creation + restoration
```

### 17.2 Test Scenarios

**Matching Engine:**
```typescript
describe("Matching Engine", () => {
  test("exact fill removes both orders", () => {
    const book = new OrderBook("BTC-PERP");
    
    book.processCommand({
      type: "order.created",
      orderId: "buy-1",
      side: "BUY",
      price: 65000,
      quantity: 1.0
    });
    
    book.processCommand({
      type: "order.created",
      orderId: "sell-1",
      side: "SELL",
      price: 65000,
      quantity: 1.0
    });
    
    expect(book.getBestBid()).toBeNull();
    expect(book.getBestAsk()).toBeNull();
    expect(book.events).toContainEqual({
      type: "trade.executed",
      makerOrderId: "buy-1",
      takerOrderId: "sell-1",
      price: 65000,
      quantity: 1.0
    });
  });

  test("self-trade prevention cancels taker", () => {
    const book = new OrderBook("BTC-PERP");
    
    book.processCommand({
      orderId: "buy-1",
      userId: "user-A",
      side: "BUY",
      price: 65000
    });
    
    book.processCommand({
      orderId: "sell-1",
      userId: "user-A",  // Same user
      side: "SELL",
      price: 65000
    });
    
    expect(book.events).toContainEqual({
      type: "order.expired",
      orderId: "sell-1",
      reason: "self_trade_prevention"
    });
    
    expect(book.getOrder("buy-1")).toBeDefined();  // Maker remains
  });
});
```

**Risk Management:**
```typescript
describe("Position Management", () => {
  test("reverse position realizes PnL correctly", () => {
    let position = {
      side: "LONG",
      quantity: 1.0,
      entryPrice: 60000
    };
    
    // Close and reverse: SELL 2.0 @ 65000
    const fill = {
      side: "SELL",
      quantity: 2.0,
      price: 65000
    };
    
    const result = applyFillToPosition(position, fill);
    
    expect(result.realizedPnl).toBe(5000);  // (65000 - 60000) × 1.0
    expect(result.newPosition).toEqual({
      side: "SHORT",
      quantity: 1.0,
      entryPrice: 65000
    });
  });

  test("liquidation triggers when equity below maintenance", () => {
    const position = {
      quantity: 1.0,
      entryPrice: 60000,
      leverage: 10
    };
    
    const walletBalance = 3000;
    const markPrice = 57000;
    
    const equity = walletBalance + (markPrice - 60000);  // 3000 - 3000 = 0
    const maintenanceMargin = 57000 * 0.025;  // 1425
    
    expect(equity).toBeLessThan(maintenanceMargin);
    expect(shouldLiquidate(position, markPrice, walletBalance)).toBe(true);
  });
});
```

**Idempotency:**
```typescript
describe("Persistence Idempotency", () => {
  test("duplicate event processing is no-op", async () => {
    const event = {
      eventId: "evt-123",
      type: "trade.executed",
      tradeId: "trade-abc",
      // ...
    };
    
    // First processing
    await persistenceWorker.handleEvent(event);
    
    const fill1 = await prisma.fill.findUnique({
      where: { tradeId_orderId: { tradeId: "trade-abc", orderId: "order-1" } }
    });
    expect(fill1).toBeDefined();
    
    // Duplicate processing (simulating retry)
    await persistenceWorker.handleEvent(event);
    
    const fills = await prisma.fill.findMany({
      where: { tradeId: "trade-abc" }
    });
    
    expect(fills.length).toBe(2);  // Maker + taker, not 4
  });
});
```

### 17.3 Load Testing

**Artillery Configuration:**
```yaml
# load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
    - duration: 60
      arrivalRate: 200
      name: "Peak load"

scenarios:
  - name: "Order lifecycle"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomEmail() }}"
            password: "test123"
          capture:
            - json: "$.token"
              as: "token"
      
      - post:
          url: "/orders"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            marketId: "BTC-PERP"
            side: "{{ $randomChoice(['BUY', 'SELL']) }}"
            type: "LIMIT"
            quantity: "{{ $randomNumber(1, 10) }}"
            price: "{{ $randomNumber(60000, 70000) }}"
          capture:
            - json: "$.orderId"
              as: "orderId"
      
      - think: 2
      
      - delete:
          url: "/orders/{{ orderId }}"
          headers:
            Authorization: "Bearer {{ token }}"
```

Run:
```bash
artillery run load-test.yml
```

---

## Conclusion

This architecture provides a **production-grade educational reference** for building centralized perpetual futures exchanges. Key strengths:

✅ **Clear Service Boundaries:** Each component has well-defined responsibilities
✅ **Event-Driven Reliability:** Transactional outbox + idempotency prevents data loss
✅ **Deterministic Matching:** Sequential command processing ensures reproducible results
✅ **Complete Risk Management:** Cross-margin, funding, liquidation, and ADL fully implemented
✅ **Disaster Recovery:** Snapshot + replay enables fast orderbook restoration
✅ **Dual Runtime Modes:** Local mode for development, production mode for deployment
✅ **TypeScript Throughout:** Type safety from API to database

**Next Steps for Production Hardening:**
1. Add comprehensive monitoring (Prometheus, Grafana)
2. Implement distributed tracing (OpenTelemetry)
3. Set up alerting for critical events (liquidations, ADL, system errors)
4. Add circuit breakers for external dependencies
5. Implement graceful shutdown for all services
6. Set up blue-green deployments
7. Add chaos engineering tests (network partitions, random crashes)
8. Implement audit logging for compliance

**Learning Path:**
1. Start with `packages/matching-engine` tests to understand core matching
2. Explore `packages/risk` for margin and position calculations
3. Run local API to see the full flow end-to-end
4. Set up production infrastructure (PostgreSQL + Redis)
5. Deploy workers and observe event streams
6. Connect WebSocket client to see real-time updates
7. Simulate liquidations by manipulating mark prices
8. Test recovery by crashing and restarting matching engine

This system demonstrates that complex financial infrastructure can be built with clarity, testability, and modern TypeScript patterns.
