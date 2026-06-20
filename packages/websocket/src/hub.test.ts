import { describe, expect, it } from "bun:test";
import { WebSocketHub } from "./hub";
import type { ClientConnection } from "./types";

describe("WebSocketHub", () => {
  it("subscribes public market channels and publishes updates", () => {
    const hub = new WebSocketHub();
    const connection = testConnection("conn-1");

    hub.connect(connection);
    const response = hub.subscribe("conn-1", {
      op: "subscribe",
      channel: "trades",
      market: "BTC-PERP",
    });
    const delivered = hub.publish({
      channel: "trades",
      market: "BTC-PERP",
      sequence: 10,
      data: { tradeId: "trade-1" },
    });

    expect(response).toMatchObject({
      type: "subscribed",
      topic: "trades:BTC-PERP",
    });
    expect(delivered).toBe(1);
    expect(parsedMessages(connection)).toEqual([
      {
        type: "subscribed",
        channel: "trades",
        topic: "trades:BTC-PERP",
      },
      {
        type: "update",
        channel: "trades",
        topic: "trades:BTC-PERP",
        sequence: 10,
        data: { tradeId: "trade-1" },
      },
    ]);
  });

  it("requires authentication for private position subscriptions", () => {
    const hub = new WebSocketHub((token) =>
      token === "valid-token"
        ? { ok: true, userId: "user-1" }
        : { ok: false, reason: "bad token" },
    );
    const connection = testConnection("conn-1");

    hub.connect(connection);

    expect(
      hub.subscribe("conn-1", {
        op: "subscribe",
        channel: "positions",
        token: "bad-token",
      }),
    ).toEqual({
      type: "error",
      reason: "bad token",
    });

    const response = hub.subscribe("conn-1", {
      op: "subscribe",
      channel: "positions",
      token: "valid-token",
    });

    expect(response).toMatchObject({
      type: "subscribed",
      topic: "positions:user-1",
    });

    const delivered = hub.publish({
      channel: "positions",
      userId: "user-1",
      data: { position: "private" },
    });

    expect(delivered).toBe(1);
    expect(parsedMessages(connection).at(-1)).toEqual({
      type: "update",
      channel: "positions",
      topic: "positions:user-1",
      data: { position: "private" },
    });
  });

  it("unsubscribes and disconnects cleanly", () => {
    const hub = new WebSocketHub();
    const connection = testConnection("conn-1");

    hub.connect(connection);
    hub.subscribe("conn-1", {
      op: "subscribe",
      channel: "orderbook",
      market: "BTC-PERP",
    });
    hub.unsubscribe("conn-1", {
      op: "unsubscribe",
      channel: "orderbook",
      market: "BTC-PERP",
    });

    expect(
      hub.publish({
        channel: "orderbook",
        market: "BTC-PERP",
        data: { bids: [] },
      }),
    ).toBe(0);

    hub.disconnect("conn-1");
    expect(hub.subscriptions()).toEqual([]);
  });

  it("sends snapshots and resync notices", () => {
    const hub = new WebSocketHub();
    const first = testConnection("conn-1");
    const second = testConnection("conn-2");

    hub.connect(first);
    hub.connect(second);
    hub.subscribe("conn-1", {
      op: "subscribe",
      channel: "orderbook",
      market: "BTC-PERP",
    });
    hub.subscribe("conn-2", {
      op: "subscribe",
      channel: "orderbook",
      market: "BTC-PERP",
    });

    expect(
      hub.sendSnapshot("conn-1", "orderbook:BTC-PERP", { bids: [] }, 5),
    ).toBe(true);
    expect(hub.sendResync("orderbook:BTC-PERP", "sequence gap")).toBe(2);

    expect(parsedMessages(first).at(-2)).toEqual({
      type: "snapshot",
      topic: "orderbook:BTC-PERP",
      sequence: 5,
      data: { bids: [] },
    });
    expect(parsedMessages(first).at(-1)).toEqual({
      type: "resync",
      topic: "orderbook:BTC-PERP",
      reason: "sequence gap",
    });
    expect(parsedMessages(second).at(-1)).toEqual({
      type: "resync",
      topic: "orderbook:BTC-PERP",
      reason: "sequence gap",
    });
  });
});

interface TestConnection extends ClientConnection {
  messages: string[];
}

function testConnection(id: string): TestConnection {
  return {
    id,
    messages: [],
    send(message) {
      this.messages.push(message);
    },
  };
}

function parsedMessages(connection: TestConnection): unknown[] {
  return connection.messages.map((message) => JSON.parse(message));
}
