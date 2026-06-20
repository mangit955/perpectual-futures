import { describe, expect, it } from "bun:test";
import { OutboxPublisher, type OutboxPublisherClient } from "./outbox-publisher";
import type { StreamBus } from "./stream";

describe("OutboxPublisher", () => {
  it("publishes pending order commands and marks them published", async () => {
    const client = new FakeOutboxClient();
    const bus = new FakeBus();
    const publisher = new OutboxPublisher(client, bus);
    const count = await publisher.publishOnce();

    expect(count).toBe(1);
    expect(bus.stream).toBe("engine.commands.BTC-PERP");
    expect(client.updateData).toMatchObject({
      status: "PUBLISHED",
      lastError: null,
    });
  });

  it("marks failed publishes for retry visibility", async () => {
    const client = new FakeOutboxClient();
    const publisher = new OutboxPublisher(client, new FailingBus());

    expect(await publisher.publishOnce()).toBe(0);
    expect(client.updateData).toMatchObject({
      status: "FAILED",
      attempts: { increment: 1 },
      lastError: "redis down",
    });
  });
});

class FakeOutboxClient implements OutboxPublisherClient {
  updateData: unknown;
  outboxEvent = {
    findMany: async () => [
      {
        id: "outbox-1",
        aggregateType: "order",
        aggregateId: "order-1",
        type: "order.created",
        payload: {
          type: "order.created",
          command: {
            commandId: "cmd-order-1",
            orderId: "order-1",
            userId: "user-1",
            market: "BTC-PERP",
            side: "buy",
            type: "limit",
            qtyLots: 1,
            priceTicks: 100,
            timeInForce: "GTC",
            createdAt: 1,
          },
        },
      },
    ],
    update: async (args: { data: unknown }) => {
      this.updateData = args.data;
    },
  };
}

class FakeBus implements StreamBus {
  stream = "";

  async append<T>(stream: string, payload: T) {
    this.stream = stream;
    return { id: "1-0", stream, payload };
  }

  async readAfter<T>() {
    return [] as T[];
  }
}

class FailingBus extends FakeBus {
  override async append<T>(): Promise<never> {
    throw new Error("redis down");
  }
}
