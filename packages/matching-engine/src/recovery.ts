import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OrderBook } from "./orderbook";
import type { EngineEvent } from "../types/event";
import type { OrderBookSnapshot } from "../types/order";

export interface StoredOrderBookSnapshot {
  market: string;
  engineSequence: number;
  lastRedisStreamId: string;
  createdAt: number;
  orderBook: OrderBookSnapshot;
}

export interface SnapshotStore {
  write(snapshot: StoredOrderBookSnapshot): Promise<string>;
  readLatest(market: string): Promise<StoredOrderBookSnapshot | null>;
}

export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly snapshotDir: string) {}

  async write(snapshot: StoredOrderBookSnapshot): Promise<string> {
    try {
      await mkdir(this.snapshotDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create snapshot directory ${this.snapshotDir}:`, error);
      throw error;
    }

    const finalPath = this.pathFor(snapshot.market);
    const tempPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
    const payload = `${JSON.stringify(snapshot, null, 2)}\n`;

    try {
      await writeFile(tempPath, payload, "utf8");
      await rename(tempPath, finalPath);
    } catch (error) {
      console.error(`Failed to write snapshot ${finalPath}:`, error);
      // Clean up temp file if it exists
      try {
        await writeFile(tempPath, "", "utf8").catch(() => {});
      } catch {}
      throw error;
    }

    return finalPath;
  }

  async readLatest(market: string): Promise<StoredOrderBookSnapshot | null> {
    try {
      const payload = await readFile(this.pathFor(market), "utf8");
      return JSON.parse(payload) as StoredOrderBookSnapshot;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw error;
    }
  }

  private pathFor(market: string): string {
    return join(this.snapshotDir, `${market}.snapshot.json`);
  }
}

export function createStoredSnapshot(input: {
  orderBook: OrderBook;
  lastRedisStreamId: string;
  createdAt: number;
}): StoredOrderBookSnapshot {
  const snapshot = input.orderBook.snapshot();

  return {
    market: snapshot.market,
    engineSequence: snapshot.sequence,
    lastRedisStreamId: input.lastRedisStreamId,
    createdAt: input.createdAt,
    orderBook: snapshot,
  };
}

export function recoverOrderBookFromSnapshot(input: {
  snapshot: StoredOrderBookSnapshot;
  eventsAfterSnapshot: EngineEvent[];
  clock?: () => number;
}): OrderBook {
  const book = OrderBook.fromSnapshot(
    input.snapshot.orderBook,
    input.clock ?? (() => Date.now()),
  );

  for (const event of input.eventsAfterSnapshot) {
    if (event.sequence > input.snapshot.engineSequence) {
      book.applyReplayEvent(event);
    }
  }

  return book;
}
