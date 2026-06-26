import {
  MatchingEngine,
  recoverOrderBookFromSnapshot,
  type EngineEvent,
  type SnapshotStore,
  type StoredOrderBookSnapshot,
} from "../../matching-engine/index";
import { PersistenceService } from "../../db/src/index";
import type { AckingStreamBus } from "./stream";
import { commandStream, eventStream } from "./stream";
import type { RuntimeCommand } from "./types";
import type { OrderBookCache } from "./orderbook-cache";

export interface SnapshotMetadataClient {
  snapshotMetadata: {
    create(args: {
      data: {
        marketId: string;
        snapshotPath: string;
        engineSequence: bigint;
        lastRedisStreamId: string;
        createdAt: Date;
      };
    }): Promise<unknown>;
  };
}

export interface ProductionMatchingWorkerOptions {
  bus: AckingStreamBus;
  engine?: MatchingEngine;
  markets: () => string[] | Promise<string[]>;
  snapshotStore?: SnapshotStore;
  snapshotClient?: SnapshotMetadataClient;
  snapshotIntervalMs?: number;
  consumerName?: string;
  clock?: () => number;
  orderBookCache?: OrderBookCache;
}

export class ProductionMatchingWorker {
  readonly engine: MatchingEngine;
  private readonly lastEventIds = new Map<string, string>();
  private readonly lastSnapshotAt = new Map<string, number>();

  constructor(private readonly options: ProductionMatchingWorkerOptions) {
    this.engine = options.engine ?? new MatchingEngine({ clock: options.clock });
  }

  async recover(): Promise<void> {
    if (!this.options.snapshotStore) {
      return;
    }

    for (const market of await this.markets()) {
      const snapshot = await this.options.snapshotStore.readLatest(market);

      if (!snapshot) {
        continue;
      }

      const messages = await this.options.bus.readAfter<{ type: "engine.event"; event: EngineEvent }>(
        eventStream(market),
        snapshot.lastRedisStreamId,
      );
      const orderBook = recoverOrderBookFromSnapshot({
        snapshot,
        eventsAfterSnapshot: messages.map((message) => message.payload.event),
        clock: this.options.clock,
      });

      this.engine.restoreBook(market, orderBook);
      this.lastEventIds.set(market, messages.at(-1)?.id ?? snapshot.lastRedisStreamId);
      
      // Publish initial orderbook to Redis cache after recovery
      if (this.options.orderBookCache) {
        await this.publishOrderBookToCache(market);
      }
    }
  }

  async processOnce(): Promise<number> {
    let processed = 0;

    for (const market of await this.markets()) {
      const stream = commandStream(market);
      const group = `matching-engine:${market}`;
      const messages = await this.options.bus.readGroup<RuntimeCommand>(
        stream,
        group,
        this.options.consumerName ?? "matching-engine-1",
      );
      const acked: string[] = [];

      for (const message of messages) {
        const events =
          message.payload.type === "order.created"
            ? this.engine.submitOrder(message.payload.command)
            : this.engine.cancelOrder(message.payload.command);

        for (const event of events) {
          const written = await this.options.bus.append(eventStream(event.market), {
            type: "engine.event",
            event,
          });
          this.lastEventIds.set(event.market, written.id);
        }

        acked.push(message.id);
        processed += 1;
      }

      await this.options.bus.ack(stream, group, acked);
      await this.maybeSnapshot(market);
      
      // Always publish orderbook to Redis cache (not just when processing new orders)
      // This ensures existing orders in the book are visible even if no new orders come in
      if (this.options.orderBookCache) {
        await this.publishOrderBookToCache(market);
      }
    }

    return processed;
  }

  private async publishOrderBookToCache(market: string): Promise<void> {
    if (!this.options.orderBookCache) {
      return;
    }

    try {
      const snapshot = this.engine.getBookSnapshot(market, 20);
      await this.options.orderBookCache.set(market, {
        market: snapshot.market,
        sequence: snapshot.sequence,
        bids: snapshot.bids,
        asks: snapshot.asks,
        timestamp: this.options.clock?.() ?? Date.now(),
      });
    } catch (error) {
      console.error(`Failed to publish orderbook to Redis cache for ${market}:`, error);
    }
  }

  private async maybeSnapshot(market: string): Promise<void> {
    const intervalMs = this.options.snapshotIntervalMs;

    if (!intervalMs || !this.options.snapshotStore) {
      return;
    }

    const now = this.options.clock?.() ?? Date.now();
    const previous = this.lastSnapshotAt.get(market) ?? 0;

    if (now - previous < intervalMs) {
      return;
    }

    const snapshot: StoredOrderBookSnapshot = {
      market,
      engineSequence: this.engine.getBookSnapshot(market).sequence,
      lastRedisStreamId: this.lastEventIds.get(market) ?? "0-0",
      createdAt: now,
      orderBook: this.engine.getBookSnapshot(market),
    };
    const snapshotPath = await this.options.snapshotStore.write(snapshot);
    this.lastSnapshotAt.set(market, now);

    await this.options.snapshotClient?.snapshotMetadata.create({
      data: {
        marketId: market,
        snapshotPath,
        engineSequence: BigInt(snapshot.engineSequence),
        lastRedisStreamId: snapshot.lastRedisStreamId,
        createdAt: new Date(snapshot.createdAt),
      },
    });
  }

  private async markets(): Promise<string[]> {
    return this.options.markets();
  }
}

export class ProductionPersistenceWorker {
  constructor(
    private readonly bus: AckingStreamBus,
    private readonly service: PersistenceService,
    private readonly markets: () => string[] | Promise<string[]>,
    private readonly consumerName = "persistence-worker-1",
  ) {}

  async processOnce(): Promise<number> {
    let processed = 0;

    for (const market of await this.markets()) {
      const stream = eventStream(market);
      const messages = await this.bus.readGroup<{ type: "engine.event"; event: EngineEvent }>(
        stream,
        "persistence-worker",
        this.consumerName,
      );
      const acked: string[] = [];

      for (const message of messages) {
        await this.service.persistEvent(message.payload.event, {
          stream,
          streamId: message.id,
        });
        acked.push(message.id);
        processed += 1;
      }

      await this.bus.ack(stream, "persistence-worker", acked);
    }

    return processed;
  }
}
