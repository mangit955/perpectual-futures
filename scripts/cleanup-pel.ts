#!/usr/bin/env bun
/**
 * Emergency script to clean up stuck messages in Redis PEL (Pending Entry List)
 * This resolves the issue where the matching engine has 5000+ pending messages
 * that prevent new orders/cancellations from being processed.
 */

import { RedisStreamBus } from "../packages/runtime/src/redis-stream-bus";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL environment variable is required");
  process.exit(1);
}

async function cleanupPEL() {
  console.log("🔧 Starting PEL cleanup...");
  console.log(`Redis URL: ${REDIS_URL?.slice(0, 20)}...`);
  
  const bus = new RedisStreamBus({ redisUrl: REDIS_URL });
  
  const markets = ["BTC-PERP", "ETH-PERP"];
  
  for (const market of markets) {
    const stream = `engine.commands.${market}`;
    const group = `matching-engine:${market}`;
    const consumer = "matching-engine-1";
    
    console.log(`\n📊 Cleaning up ${stream}...`);
    
    let totalCleaned = 0;
    let batchCount = 0;
    let batchCleaned = 0;
    
    // Keep claiming and acking until no more pending messages
    do {
      batchCount++;
      batchCleaned = await bus.claimAndAckPending(
        stream,
        group,
        consumer,
        0, // Claim ALL pending messages (0ms idle time)
        1000, // Process up to 1000 at a time (Upstash PEL limit)
      );
      totalCleaned += batchCleaned;
      
      if (batchCleaned > 0) {
        console.log(`  Batch ${batchCount}: Cleaned ${batchCleaned} messages (total: ${totalCleaned})`);
      }
      
      // Add a small delay to avoid hammering Redis
      if (batchCleaned > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (batchCleaned > 0);
    
    if (totalCleaned > 0) {
      console.log(`✅ Cleaned ${totalCleaned} pending messages from ${stream}`);
    } else {
      console.log(`✓ No pending messages found in ${stream}`);
    }
  }
  
  console.log("\n✅ PEL cleanup complete!");
}

cleanupPEL().catch((error) => {
  console.error("❌ Cleanup failed:", error);
  process.exit(1);
});
