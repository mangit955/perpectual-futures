import { describe, expect, test, beforeEach } from "bun:test";
import { RedisOrderBookCache, type OrderBookSnapshot } from "./orderbook-cache";

// Mock Redis executor for testing
class MockRedisExecutor {
  private data = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();
  private ttls = new Map<string, number>();

  async send(command: string, args: string[]): Promise<unknown> {
    switch (command) {
      case "HSET": {
        const [key, ...fields] = args;
        if (!this.data.has(key)) {
          this.data.set(key, new Map());
        }
        const hash = this.data.get(key)!;
        for (let i = 0; i < fields.length; i += 2) {
          hash.set(fields[i], fields[i + 1]);
        }
        return "OK";
      }
      case "HGETALL": {
        const [key] = args;
        const hash = this.data.get(key);
        if (!hash) return [];
        const result: string[] = [];
        for (const [k, v] of hash.entries()) {
          result.push(k, v);
        }
        return result;
      }
      case "SADD": {
        const [key, ...members] = args;
        if (!this.sets.has(key)) {
          this.sets.set(key, new Set());
        }
        const set = this.sets.get(key)!;
        for (const member of members) {
          set.add(member);
        }
        return members.length;
      }
      case "SMEMBERS": {
        const [key] = args;
        const set = this.sets.get(key);
        return set ? Array.from(set) : [];
      }
      case "EXPIRE": {
        const [key, seconds] = args;
        this.ttls.set(key, Number(seconds));
        return 1;
      }
      default:
        throw new Error(`Unimplemented command: ${command}`);
    }
  }

  clear() {
    this.data.clear();
    this.sets.clear();
    this.ttls.clear();
  }
}

describe("RedisOrderBookCache", () => {
  let redis: MockRedisExecutor;
  let cache: RedisOrderBookCache;

  beforeEach(() => {
    redis = new MockRedisExecutor();
    cache = new RedisOrderBookCache({ redis });
  });

  test("should store and retrieve orderbook snapshot", async () => {
    const snapshot: OrderBookSnapshot = {
      market: "BTC-PERP",
      sequence: 100,
      bids: [
        { priceTicks: 50000, totalQtyLots: 10 },
        { priceTicks: 49990, totalQtyLots: 5 },
      ],
      asks: [
        { priceTicks: 50010, totalQtyLots: 8 },
        { priceTicks: 50020, totalQtyLots: 12 },
      ],
      timestamp: 1234567890000,
    };

    await cache.set("BTC-PERP", snapshot);
    const retrieved = await cache.get("BTC-PERP");

    expect(retrieved).toEqual(snapshot);
  });

  test("should return null for non-existent market", async () => {
    const retrieved = await cache.get("ETH-PERP");
    expect(retrieved).toBeNull();
  });

  test("should retrieve all cached orderbooks", async () => {
    const btcSnapshot: OrderBookSnapshot = {
      market: "BTC-PERP",
      sequence: 100,
      bids: [{ priceTicks: 50000, totalQtyLots: 10 }],
      asks: [{ priceTicks: 50010, totalQtyLots: 8 }],
      timestamp: 1234567890000,
    };

    const ethSnapshot: OrderBookSnapshot = {
      market: "ETH-PERP",
      sequence: 200,
      bids: [{ priceTicks: 3000, totalQtyLots: 20 }],
      asks: [{ priceTicks: 3010, totalQtyLots: 15 }],
      timestamp: 1234567890000,
    };

    await cache.set("BTC-PERP", btcSnapshot);
    await cache.set("ETH-PERP", ethSnapshot);

    const all = await cache.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(btcSnapshot);
    expect(all).toContainEqual(ethSnapshot);
  });

  test("should handle empty orderbook levels", async () => {
    const snapshot: OrderBookSnapshot = {
      market: "BTC-PERP",
      sequence: 100,
      bids: [],
      asks: [],
      timestamp: 1234567890000,
    };

    await cache.set("BTC-PERP", snapshot);
    const retrieved = await cache.get("BTC-PERP");

    expect(retrieved).toEqual(snapshot);
    expect(retrieved?.bids).toEqual([]);
    expect(retrieved?.asks).toEqual([]);
  });

  test("should update existing orderbook", async () => {
    const snapshot1: OrderBookSnapshot = {
      market: "BTC-PERP",
      sequence: 100,
      bids: [{ priceTicks: 50000, totalQtyLots: 10 }],
      asks: [{ priceTicks: 50010, totalQtyLots: 8 }],
      timestamp: 1234567890000,
    };

    const snapshot2: OrderBookSnapshot = {
      market: "BTC-PERP",
      sequence: 101,
      bids: [{ priceTicks: 50005, totalQtyLots: 15 }],
      asks: [{ priceTicks: 50015, totalQtyLots: 12 }],
      timestamp: 1234567890001,
    };

    await cache.set("BTC-PERP", snapshot1);
    await cache.set("BTC-PERP", snapshot2);

    const retrieved = await cache.get("BTC-PERP");
    expect(retrieved).toEqual(snapshot2);
    expect(retrieved?.sequence).toBe(101);
  });
});
