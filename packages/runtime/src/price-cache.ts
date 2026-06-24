/**
 * Price cache backed by Redis hashes.
 *
 * Stores the latest mark price, index price, and funding rate for each market
 * in a Redis hash key (`price:latest:{marketId}`), and maintains a set of
 * known market IDs in `price:markets` for fast enumeration.
 */

export interface PriceData {
  marketId: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime?: number;
  timestamp: number;
}

export interface PriceCache {
  set(marketId: string, data: PriceData): Promise<void>;
  get(marketId: string): Promise<PriceData | null>;
  getAll(): Promise<PriceData[]>;
}

interface RedisExecutor {
  send(command: string, args: string[]): Promise<unknown>;
}

const PRICE_KEY_PREFIX = "price:latest:";
const PRICE_MARKETS_KEY = "price:markets";

export class RedisPriceCache implements PriceCache {
  private readonly redis: RedisExecutor;

  constructor(options: { redis?: RedisExecutor; redisUrl?: string }) {
    this.redis = options.redis ?? createBunRedis(options.redisUrl);
  }

  async set(marketId: string, data: PriceData): Promise<void> {
    const key = `${PRICE_KEY_PREFIX}${marketId}`;

    await this.redis.send("HSET", [
      key,
      "marketId",
      data.marketId,
      "markPrice",
      String(data.markPrice),
      "indexPrice",
      String(data.indexPrice),
      "fundingRate",
      String(data.fundingRate),
      "nextFundingTime",
      String(data.nextFundingTime ?? 0),
      "timestamp",
      String(data.timestamp),
    ]);

    await this.redis.send("SADD", [PRICE_MARKETS_KEY, marketId]);
  }

  async get(marketId: string): Promise<PriceData | null> {
    const key = `${PRICE_KEY_PREFIX}${marketId}`;
    const result = await this.redis.send("HGETALL", [key]);

    return decodeHashResult(result);
  }

  async getAll(): Promise<PriceData[]> {
    const members = await this.redis.send("SMEMBERS", [PRICE_MARKETS_KEY]);

    if (!Array.isArray(members) || members.length === 0) {
      return [];
    }

    const results: PriceData[] = [];

    for (const marketId of members) {
      const data = await this.get(String(marketId));

      if (data) {
        results.push(data);
      }
    }

    return results;
  }
}

function decodeHashResult(result: unknown): PriceData | null {
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

    const marketId = map.get("marketId");

    if (!marketId) {
      return null;
    }

    return {
      marketId,
      markPrice: Number(map.get("markPrice") ?? 0),
      indexPrice: Number(map.get("indexPrice") ?? 0),
      fundingRate: Number(map.get("fundingRate") ?? 0),
      nextFundingTime: Number(map.get("nextFundingTime") ?? 0) || undefined,
      timestamp: Number(map.get("timestamp") ?? 0),
    };
  }

  // Some Redis clients return an object directly
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, string>;
    const marketId = obj["marketId"];

    if (!marketId) {
      return null;
    }

    return {
      marketId,
      markPrice: Number(obj["markPrice"] ?? 0),
      indexPrice: Number(obj["indexPrice"] ?? 0),
      fundingRate: Number(obj["fundingRate"] ?? 0),
      nextFundingTime: Number(obj["nextFundingTime"] ?? 0) || undefined,
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
