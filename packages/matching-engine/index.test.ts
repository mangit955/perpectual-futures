import { describe, expect, it } from "bun:test";
import {
  MatchingEngine,
  type EngineEvent,
  type NewOrderCommand,
} from "./index";

const MARKET = "BTC-PERP";

describe("matching engine validation", () => {
  it("rejects orders with invalid quantity", () => {
    const engine = newEngine();

    const events = engine.submitOrder(newOrder({ qtyLots: 0 }));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "order.rejected",
      reason: "INVALID_QUANTITY",
    });
  });

  it("rejects duplicate order ids even after the first order rests", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({ orderId: "order-1", side: "buy", priceTicks: 99 }),
    );
    const events = engine.submitOrder(
      newOrder({ orderId: "order-1", side: "sell", priceTicks: 101 }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "order.rejected",
      reason: "DUPLICATE_ORDER_ID",
    });
  });

  it("rejects market orders that contain a price", () => {
    const engine = newEngine();

    const events = engine.submitOrder(
      newOrder({ type: "market", priceTicks: 100, timeInForce: "IOC" }),
    );

    expect(events[0]).toMatchObject({
      type: "order.rejected",
      reason: "MARKET_ORDER_HAS_PRICE",
    });
  });

  it("rejects limit orders without a price", () => {
    const engine = newEngine();

    const events = engine.submitOrder(
      newOrder({ type: "limit", priceTicks: undefined }),
    );

    expect(events[0]).toMatchObject({
      type: "order.rejected",
      reason: "LIMIT_ORDER_MISSING_PRICE",
    });
  });

  it("rejects post-only orders that would immediately take liquidity", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({
        orderId: "ask-1",
        userId: "maker",
        side: "sell",
        priceTicks: 100,
      }),
    );

    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        userId: "taker",
        side: "buy",
        priceTicks: 100,
        postOnly: true,
      }),
    );

    expect(events[0]).toMatchObject({
      type: "order.rejected",
      reason: "POST_ONLY_WOULD_TAKE",
    });
    expect(engine.getBookSnapshot(MARKET).asks[0]?.totalQtyLots).toBe(1);
  });
});

describe("limit and market matching", () => {
  it("fills an exact crossing limit order", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({
        orderId: "ask-1",
        userId: "maker",
        side: "sell",
        priceTicks: 100,
        qtyLots: 5,
      }),
    );
    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        userId: "taker",
        side: "buy",
        priceTicks: 100,
        qtyLots: 5,
      }),
    );

    const trades = eventsOfType(events, "trade.executed");

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      makerOrderId: "ask-1",
      takerOrderId: "bid-1",
      priceTicks: 100,
      qtyLots: 5,
      makerOrderRemainingQtyLots: 0,
      takerOrderRemainingQtyLots: 0,
    });
    expect(engine.getBookSnapshot(MARKET)).toMatchObject({
      bids: [],
      asks: [],
    });
  });

  it("partially fills a resting maker order", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({
        orderId: "ask-1",
        userId: "maker",
        side: "sell",
        priceTicks: 100,
        qtyLots: 10,
      }),
    );
    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        userId: "taker",
        side: "buy",
        priceTicks: 100,
        qtyLots: 4,
      }),
    );

    const trades = eventsOfType(events, "trade.executed");
    const snapshot = engine.getBookSnapshot(MARKET);

    expect(trades[0]).toMatchObject({
      qtyLots: 4,
      makerOrderRemainingQtyLots: 6,
      takerOrderRemainingQtyLots: 0,
    });
    expect(snapshot.asks).toHaveLength(1);
    expect(snapshot.asks[0]).toMatchObject({
      priceTicks: 100,
      totalQtyLots: 6,
      orders: [{ orderId: "ask-1", remainingQtyLots: 6 }],
    });
  });

  it("fills multiple price levels from best ask upward", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({ orderId: "ask-1", side: "sell", priceTicks: 100, qtyLots: 2 }),
    );
    engine.submitOrder(
      newOrder({ orderId: "ask-2", side: "sell", priceTicks: 101, qtyLots: 3 }),
    );
    const events = engine.submitOrder(
      newOrder({ orderId: "bid-1", side: "buy", priceTicks: 101, qtyLots: 5 }),
    );

    const trades = eventsOfType(events, "trade.executed");

    expect(trades.map((trade) => trade.priceTicks)).toEqual([100, 101]);
    expect(trades.map((trade) => trade.qtyLots)).toEqual([2, 3]);
    expect(engine.getBookSnapshot(MARKET).asks).toEqual([]);
  });

  it("preserves FIFO priority inside a single price level", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({ orderId: "ask-1", side: "sell", priceTicks: 100, qtyLots: 2 }),
    );
    engine.submitOrder(
      newOrder({ orderId: "ask-2", side: "sell", priceTicks: 100, qtyLots: 2 }),
    );
    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        side: "buy",
        type: "market",
        priceTicks: undefined,
        timeInForce: "IOC",
        qtyLots: 3,
      }),
    );

    const trades = eventsOfType(events, "trade.executed");
    const snapshot = engine.getBookSnapshot(MARKET);

    expect(trades.map((trade) => trade.makerOrderId)).toEqual([
      "ask-1",
      "ask-2",
    ]);
    expect(trades.map((trade) => trade.qtyLots)).toEqual([2, 1]);
    expect(snapshot.asks[0]).toMatchObject({
      totalQtyLots: 1,
      orders: [{ orderId: "ask-2", remainingQtyLots: 1 }],
    });
  });

  it("expires unfilled market order quantity when liquidity runs out", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({ orderId: "ask-1", side: "sell", priceTicks: 100, qtyLots: 2 }),
    );
    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        side: "buy",
        type: "market",
        priceTicks: undefined,
        timeInForce: "IOC",
        qtyLots: 5,
      }),
    );

    expect(eventsOfType(events, "trade.executed")).toHaveLength(1);
    expect(eventsOfType(events, "order.expired")[0]).toMatchObject({
      orderId: "bid-1",
      remainingQtyLots: 3,
      reason: "MARKET_LIQUIDITY_EXHAUSTED",
    });
  });

  it("rests post-only orders that do not cross", () => {
    const engine = newEngine();

    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        side: "buy",
        priceTicks: 99,
        postOnly: true,
      }),
    );

    expect(eventsOfType(events, "order.rested")[0]?.order).toMatchObject({
      orderId: "bid-1",
      postOnly: true,
    });
    expect(engine.getBookSnapshot(MARKET).bids[0]).toMatchObject({
      priceTicks: 99,
      totalQtyLots: 1,
    });
  });

  it("stores reduce-only intent for later risk-layer enforcement", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        side: "buy",
        priceTicks: 99,
        reduceOnly: true,
      }),
    );

    expect(engine.getOpenOrder(MARKET, "bid-1")).toMatchObject({
      orderId: "bid-1",
      reduceOnly: true,
    });
  });
});

describe("cancellation and self-trade prevention", () => {
  it("cancels an open order in O(1) after order-id lookup", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({ orderId: "bid-1", side: "buy", priceTicks: 99, qtyLots: 7 }),
    );
    const events = engine.cancelOrder({
      commandId: "cancel-1",
      userId: "user-bid-1",
      market: MARKET,
      orderId: "bid-1",
    });

    expect(events[0]).toMatchObject({
      type: "order.cancelled",
      orderId: "bid-1",
      remainingQtyLots: 7,
    });
    expect(engine.getBookSnapshot(MARKET).bids).toEqual([]);
  });

  it("rejects cancellation after an order is fully filled", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({ orderId: "ask-1", side: "sell", priceTicks: 100, qtyLots: 1 }),
    );
    engine.submitOrder(
      newOrder({ orderId: "bid-1", side: "buy", priceTicks: 100, qtyLots: 1 }),
    );
    const events = engine.cancelOrder({
      commandId: "cancel-1",
      userId: "user-ask-1",
      market: MARKET,
      orderId: "ask-1",
    });

    expect(events[0]).toMatchObject({
      type: "order.cancel_rejected",
      reason: "ORDER_NOT_OPEN",
    });
  });

  it("expires the taker on self-trade prevention", () => {
    const engine = newEngine();

    engine.submitOrder(
      newOrder({
        orderId: "ask-1",
        userId: "user-1",
        side: "sell",
        priceTicks: 100,
      }),
    );
    const events = engine.submitOrder(
      newOrder({
        orderId: "bid-1",
        userId: "user-1",
        side: "buy",
        priceTicks: 100,
      }),
    );

    expect(eventsOfType(events, "trade.executed")).toEqual([]);
    expect(eventsOfType(events, "order.expired")[0]).toMatchObject({
      orderId: "bid-1",
      remainingQtyLots: 1,
      reason: "SELF_TRADE_PREVENTION",
    });
    expect(engine.getBookSnapshot(MARKET).asks[0]).toMatchObject({
      totalQtyLots: 1,
      orders: [{ orderId: "ask-1" }],
    });
  });
});

describe("sequencing", () => {
  it("processes simultaneous command batches deterministically in input order", () => {
    const engine = newEngine();

    const events = engine.submitOrders([
      newOrder({ orderId: "ask-1", side: "sell", priceTicks: 100, qtyLots: 1 }),
      newOrder({ orderId: "ask-2", side: "sell", priceTicks: 100, qtyLots: 1 }),
      newOrder({
        orderId: "bid-1",
        side: "buy",
        type: "market",
        priceTicks: undefined,
        timeInForce: "IOC",
        qtyLots: 2,
      }),
    ]);

    const trades = eventsOfType(events, "trade.executed");

    expect(trades.map((trade) => trade.makerOrderId)).toEqual([
      "ask-1",
      "ask-2",
    ]);
    expect(events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
  });
});

function newEngine(): MatchingEngine {
  return new MatchingEngine({ clock: () => 1_700_000_000_000 });
}

function newOrder(overrides: Partial<NewOrderCommand> = {}): NewOrderCommand {
  const orderId = overrides.orderId ?? "order-1";
  const hasPriceOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    "priceTicks",
  );

  return {
    commandId: overrides.commandId ?? `cmd-${orderId}`,
    orderId,
    userId: overrides.userId ?? `user-${orderId}`,
    market: overrides.market ?? MARKET,
    side: overrides.side ?? "buy",
    type: overrides.type ?? "limit",
    qtyLots: overrides.qtyLots ?? 1,
    priceTicks: hasPriceOverride ? overrides.priceTicks : 100,
    timeInForce: overrides.timeInForce ?? "GTC",
    reduceOnly: overrides.reduceOnly,
    postOnly: overrides.postOnly,
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
  };
}

function eventsOfType<T extends EngineEvent["type"]>(
  events: EngineEvent[],
  type: T,
): Array<Extract<EngineEvent, { type: T }>> {
  return events.filter(
    (event): event is Extract<EngineEvent, { type: T }> =>
      event.type === type,
  );
}
