import { describe, expect, it } from "bun:test";

describe("order validation", () => {
  it("should reject orders with negative quantity", () => {
    const command = {
      commandId: "cmd-1",
      orderId: "order-1",
      userId: "user-1",
      market: "BTC-PERP",
      side: "buy",
      type: "limit",
      priceTicks: 100_000,
      quantityLots: -10,
      timeInForce: "GTC",
    };

    const events = engine.submitOrder(command);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("INVALID_QUANTITY");
  });

  it("should reject duplicate order ids", () => {
    const firstOrder = {
      commandId: "cmd-1",
      orderId: "order-1",
      userId: "user-1",
      market: "BTC-PERP",
      side: "buy",
      type: "limit",
      priceTicks: 100_000,
      quantityLots: 10,
      timeInForce: "GTC",
    };

    const duplicateOrder = {
      commandId: "cmd-2",
      orderId: "order-1",
      userId: "user-2",
      market: "BTC-PERP",
      side: "sell",
      type: "limit",
      priceTicks: 101_000,
      quantityLots: 5,
      timeInForce: "GTC",
    };

    engine.submitOrder(firstOrder);

    const events = engine.submitOrder(duplicateOrder);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("DUPLICATE_ORDER_ID");
  });

  it("should reject market orders that contain a price", () => {
    const command = {
      commandId: "cmd-1",
      orderId: "order-1",
      userId: "user-1",
      market: "BTC-PERP",
      side: "buy",
      type: "market",
      priceTicks: 100_000,
      quantityLots: 10,
      timeInForce: "IOC",
    };

    const events = engine.submitOrder(command);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("MARKET_ORDER_HAS_PRICE");
  });

  it("should reject limit orders without a price", () => {
    const command = {
      commandId: "cmd-1",
      orderId: "order-1",
      userId: "user-1",
      market: "BTC-PERP",
      side: "buy",
      type: "limit",
      quantityLots: 10,
      timeInForce: "GTC",
    };

    const events = engine.submitOrder(command);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("LIMIT_ORDER_MISSING_PRICE");
  });
});
