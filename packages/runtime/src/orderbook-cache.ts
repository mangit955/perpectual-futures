/**
 * OrderBook cache backed by Redis hashes.
 *
 * Stores the latest orderbook snapshot for each market in a Redis hash key
 * (`orderbook:latest:{marketId}`), and maintains a set of known market IDs
 * in `orderbook:markets` for fast enumeration.
 */

export interface OrderBookLevel {
  priceTicks: number;
  totalQtyLots: number;
}

export interface OrderBookSnapshot {
  market: string;
  sequence: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp?: number;
}

export interface OrderBookCache {
  set(marketId: string, snapshot: OrderBookSnapshot): Promise<void>;
  get(marketId: string): Promise<OrderBookSnapshot | null>;
  getAll(): Promise<OrderBookSnapshot[]>;
}

interface RedisExecutor {
  send(command: string, args: string[]): Promise<unknown>;
}

const ORDERBOOK_KEY_PREFIX = "orderbook:latest:";
const ORDERBOOK_MARKETS_KEY = "orderbook:markets";

export class RedisOrderBookCache implements OrderBookCache {
  private readonly redis: RedisExecutor;

  constructor(options: { redis?: RedisExecutor; redisUrl?: string }) {
    this.redis = options.redis ?? createBunRedis(options.redisUrl);
  }

  async set(marketId: string, snapshot: OrderBookSnapshot): Promise<void> {
    const key = `${ORDERBOOK_KEY_PREFIX}${marketId}`;

    // Store the orderbook as JSON in a Redis hash
    await this.redis.send("HSET", [
      key,
      "market",
      snapshot.market,
      "sequence",
      String(snapshot.sequence),
      "bids",
      JSON.stringify(snapshot.bids),
      "asks",
      JSON.stringify(snapshot.asks),
      "timestamp",
      String(snapshot.timestamp ?? Date.now()),
    ]);

    // Add market to the set of known markets
    await this.redis.send("SADD", [ORDERBOOK_MARKETS_KEY, marketId]);
    
    // Set expiration to 60 seconds - if worker stops updating, cache becomes stale
    await this.redis.send("EXPIRE", [key, "60"]);
  }

  async get(marketId: string): Promise<OrderBookSnapshot | null> {
    const key = `${ORDERBOOK_KEY_PREFIX}${marketId}`;
    const result = await this.redis.send("HGETALL", [key]);

    return decodeHashResult(result);
  }

  async getAll(): Promise<OrderBookSnapshot[]> {
    const members = await this.redis.send("SMEMBERS", [ORDERBOOK_MARKETS_KEY]);

    if (!Array.isArray(members) || members.length === 0) {
      return [];
    }

    const results: OrderBookSnapshot[] = [];

    for (const marketId of members) {
      const snapshot = await this.get(String(marketId));

      if (snapshot) {
        results.push(snapshot);
      }
    }

    return results;
  }
}

function decodeHashResult(result: unknown): OrderBookSnapshot | null {
  if (!result) {
    return null;
  }

  // Bun's Redis HGETALL returns an array of alternating [key, value, key, value, ...]
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return null;
    }

    const map = new Map<string, string>();

    for (let i = 0; i < result.length; i += 2) {
      map.set(String(result[i]), String(result[i + 1]));
    }

    const market = map.get("market");

    if (!market) {
      return null;
    }

    return {
      market,
      sequence: Number(map.get("sequence") ?? 0),
      bids: JSON.parse(map.get("bids") ?? "[]") as OrderBookLevel[],
      asks: JSON.parse(map.get("asks") ?? "[]") as OrderBookLevel[],
      timestamp: Number(map.get("timestamp") ?? 0),
    };
  }

  // Some Redis clients return an object directly
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, string>;
    const market = obj["market"];

    if (!market) {
      return null;
    }

    return {
      market,
      sequence: Number(obj["sequence"] ?? 0),
      bids: JSON.parse(obj["bids"] ?? "[]") as OrderBookLevel[],
      asks: JSON.parse(obj["asks"] ?? "[]") as OrderBookLevel[],
      timestamp: Number(obj["timestamp"] ?? 0),
    };
  }

  return null;
}

function createBunRedis(redisUrl: string | undefined): RedisExecutor {
  const bunWithRedis = Bun as unknown as {
    redis?: RedisExecutor;
    RedisClient?: new (url?: string) => RedisExecutor;
  };

  if (bunWithRedis.RedisClient) {
    return new bunWithRedis.RedisClient(redisUrl);
  }

  if (bunWithRedis.redis) {
    return bunWithRedis.redis;
  }

  throw new Error("Bun Redis client is unavailable in this runtime");
}
