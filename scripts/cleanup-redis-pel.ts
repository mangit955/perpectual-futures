#!/usr/bin/env bun
/**
 * Emergency script to clean up Redis Stream Pending Entries List (PEL)
 * 
 * This script claims and acknowledges all pending messages in the matching engine
 * consumer groups to recover from PEL limit issues.
 * 
 * Usage:
 *   bun run scripts/cleanup-redis-pel.ts
 */

interface RedisCommandExecutor {
  send(command: string, args: string[]): Promise<unknown>;
}

function createBunRedis(redisUrl: string): RedisCommandExecutor {
  const bunWithRedis = Bun as unknown as {
    redis?: RedisCommandExecutor;
    RedisClient?: new (url?: string) => RedisCommandExecutor;
  };

  if (bunWithRedis.RedisClient) {
    return new bunWithRedis.RedisClient(redisUrl);
  }

  if (bunWithRedis.redis) {
    return bunWithRedis.redis;
  }

  throw new Error("Bun Redis client is unavailable in this runtime");
}

async function command(redis: RedisCommandExecutor, cmd: string, args: string[]): Promise<unknown> {
  return redis.send(cmd, args);
}

async function claimAndAckPending(
  redis: RedisCommandExecutor,
  stream: string,
  group: string,
  consumer: string,
  minIdleTimeMs = 5000,
  count = 1000,
): Promise<number> {
  try {
    const result = await command(redis, "XAUTOCLAIM", [
      stream,
      group,
      consumer,
      String(minIdleTimeMs),
      "0-0",
      "COUNT",
      String(count),
    ]);

    if (!Array.isArray(result) || result.length < 2) {
      return 0;
    }

    const messages = result[1];
    if (!Array.isArray(messages) || messages.length === 0) {
      return 0;
    }

    const ids = messages
      .filter((msg) => Array.isArray(msg) && msg[0])
      .map((msg) => String(msg[0]));

    if (ids.length > 0) {
      await command(redis, "XACK", [stream, group, ...ids]);
      console.log(`✓ Claimed and acked ${ids.length} messages from ${stream}`);
    }

    return ids.length;
  } catch (error) {
    console.error(`✗ Error claiming pending messages from ${stream}:`, error);
    return 0;
  }
}

async function main() {
  const redisUrl = Bun.env.REDIS_URL;
  
  if (!redisUrl) {
    console.error("❌ REDIS_URL environment variable is required");
    process.exit(1);
  }

  console.log("🔧 Starting Redis PEL cleanup...");
  console.log(`📡 Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':***@')}`);

  const redis = createBunRedis(redisUrl);

  // Markets to clean up (adjust based on your setup)
  const markets = ["BTC-PERP", "ETH-PERP", "SOL-PERP"];
  const consumerGroups = [
    { stream: (m: string) => `engine.commands.${m}`, group: (m: string) => `matching-engine:${m}`, consumer: "matching-engine-1" },
    { stream: (m: string) => `engine.events.${m}`, group: () => "persistence-worker", consumer: "persistence-worker-1" },
  ];

  let totalCleaned = 0;

  for (const market of markets) {
    console.log(`\n🏪 Processing market: ${market}`);

    for (const config of consumerGroups) {
      const stream = config.stream(market);
      const group = config.group(market);
      const consumer = config.consumer;

      console.log(`  📨 Stream: ${stream}, Group: ${group}`);

      let marketTotal = 0;
      let batchCleaned = 0;

      do {
        batchCleaned = await claimAndAckPending(
          redis,
          stream,
          group,
          consumer,
          5000, // Claim messages idle for 5+ seconds
          1000, // Process up to 1000 at a time
        );
        marketTotal += batchCleaned;
        totalCleaned += batchCleaned;
      } while (batchCleaned > 0);

      if (marketTotal > 0) {
        console.log(`  ✅ Cleaned ${marketTotal} pending entries for ${stream}`);
      } else {
        console.log(`  ✓ No pending entries found`);
      }
    }
  }

  console.log(`\n✅ Cleanup complete! Total messages cleaned: ${totalCleaned}`);
  
  if (totalCleaned > 0) {
    console.log("\n⚠️  Note: These messages were acknowledged without processing.");
    console.log("   If they represented important operations, you may need to replay them.");
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
