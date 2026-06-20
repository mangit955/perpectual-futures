import { describe, expect, it } from "bun:test";
import { ExchangeRuntime } from "./exchange-runtime";

describe("ExchangeRuntime integration", () => {
  it("submits orders, runs workers, persists fills, and updates positions", async () => {
    const runtime = new ExchangeRuntime({ clock: () => 1 });
    const maker = runtime.register("maker@example.com", "pw", 1);
    const taker = runtime.register("taker@example.com", "pw", 1);

    runtime.deposit(maker.id, "USDC", 10_000);
    runtime.deposit(taker.id, "USDC", 10_000);

    const ask = await runtime.submitOrder({
      userId: maker.id,
      marketId: "BTC-PERP",
      side: "SELL",
      type: "LIMIT",
      quantity: 1,
      price: 100,
      timeInForce: "GTC",
    }, 1);
    const bid = await runtime.submitOrder({
      userId: taker.id,
      marketId: "BTC-PERP",
      side: "BUY",
      type: "LIMIT",
      quantity: 1,
      price: 100,
      timeInForce: "GTC",
    }, 1);

    await runtime.drain();

    expect(runtime.store.orders.get(ask.id)?.status).toBe("FILLED");
    expect(runtime.store.orders.get(bid.id)?.status).toBe("FILLED");
    expect([...runtime.store.fills.values()]).toHaveLength(2);
    expect(runtime.store.getPosition(maker.id, "BTC-PERP")).toMatchObject({
      quantity: -1,
      entryPrice: 100,
    });
    expect(runtime.store.getPosition(taker.id, "BTC-PERP")).toMatchObject({
      quantity: 1,
      entryPrice: 100,
    });
  });
});
