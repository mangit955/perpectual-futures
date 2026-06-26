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
import { RedisStreamBus } from "./redis-stream-bus";

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
  private pendingCleanupComplete = false;

  constructor(private readonly options: ProductionMatchingWorkerOptions) {
    this.engine = options.engine ?? new MatchingEngine({ clock: options.clock });
  }

  async recover(): Promise<void> {
    // First, clean up any existing pending entries to recover from PEL limit
    await this.cleanupPendingEntries();

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

  /**
   * Clean up old pending entries that may have accumulated due to errors.
   * This prevents PEL limit issues by claiming and acknowledging stale messages.
   */
  private async cleanupPendingEntries(): Promise<void> {
    if (this.pendingCleanupComplete) {
      return;
    }

    console.log("[MATCHING] Starting pending entries cleanup...");
    
    const isBusWithCleanup = 'claimAndAckPending' in this.options.bus;
    if (!isBusWithCleanup) {
      console.log("[MATCHING] Bus doesn't support cleanup, skipping");
      this.pendingCleanupComplete = true;
      return;
    }

    for (const market of await this.markets()) {
      const stream = commandStream(market);
      const group = `matching-engine:${market}`;
      const consumer = this.options.consumerName ?? "matching-engine-1";

      let totalCleaned = 0;
      let batchCleaned = 0;

      // Keep claiming and acking until no more pending messages
      do {
        batchCleaned = await (this.options.bus as any).claimAndAckPending(
          stream,
          group,
          consumer,
          5000, // Claim messages idle for 5+ seconds
          1000, // Process up to 1000 at a time
        );
        totalCleaned += batchCleaned;
      } while (batchCleaned > 0);

      if (totalCleaned > 0) {
        console.log(`[MATCHING] Cleaned ${totalCleaned} pending entries for ${market}`);
      }
    }

    this.pendingCleanupComplete = true;
    console.log("[MATCHING] Pending entries cleanup complete");
  }

  async processOnce(): Promise<number> {
    let processed = 0;

    for (const market of await this.markets()) {
      const stream = commandStream(market);
      const group = `matching-engine:${market}`;
      const consumer = this.options.consumerName ?? "matching-engine-1";
      
      try {
        const messages = await this.options.bus.readGroup<RuntimeCommand>(
          stream,
          group,
          consumer,
          { count: 10 },
        );

        for (const message of messages) {
          try {
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

            processed += 1;
          } catch (error) {
            // Log error but still ack the message to prevent PEL buildup
            console.error(`[MATCHING] Error processing message ${message.id}:`, error);
          }

          // ACK immediately after each message to keep PEL as small as possible.
          // Upstash enforces a 1000 PEL limit per consumer; batching acks risks
          // hitting that limit under load.
          await this.options.bus.ack(stream, group, [message.id]);
        }

        await this.maybeSnapshot(market);
        
        // Always publish orderbook to Redis cache
        if (this.options.orderBookCache) {
          await this.publishOrderBookToCache(market);
        }

        // Trim the command stream to prevent unbounded growth
        if ('trimStream' in this.options.bus) {
          await (this.options.bus as any).trimStream(stream, 1000);
        }
      } catch (error) {
        // If this is a PEL limit error, try to recover by cleaning up pending entries
        if (RedisStreamBus.isPelLimitError(error)) {
          console.warn(`[MATCHING] PEL limit hit for ${market}, running emergency cleanup...`);
          this.pendingCleanupComplete = false;
          await this.cleanupPendingEntries();
        } else {
          console.error(`[MATCHING] Error processing market ${market}:`, error);
        }
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
      
      try {
        const messages = await this.bus.readGroup<{ type: "engine.event"; event: EngineEvent }>(
          stream,
          "persistence-worker",
          this.consumerName,
          { count: 10 },
        );

        for (const message of messages) {
          try {
            await this.service.persistEvent(message.payload.event, {
              stream,
              streamId: message.id,
            });
            processed += 1;
          } catch (error) {
            // Log error but still ack the message to prevent PEL buildup
            console.error(`[PERSISTENCE] Error processing message ${message.id}:`, error);
          }

          // ACK immediately per message — same rationale as matching worker
          await this.bus.ack(stream, "persistence-worker", [message.id]);
        }

        // Trim the event stream to prevent unbounded growth
        if ('trimStream' in this.bus) {
          await (this.bus as any).trimStream(stream, 1000);
        }
      } catch (error) {
        if (RedisStreamBus.isPelLimitError(error)) {
          console.warn(`[PERSISTENCE] PEL limit hit for ${market}, attempting cleanup...`);
          // Try to claim and ack pending messages
          if ('claimAndAckPending' in this.bus) {
            await (this.bus as any).claimAndAckPending(
              stream, "persistence-worker", this.consumerName, 5000, 500,
            );
          }
        } else {
          console.error(`[PERSISTENCE] Error processing market ${market}:`, error);
        }
      }
    }

    return processed;
  }
}
