#!/usr/bin/env bun
/**
 * Claim and process pending messages in Redis streams
 */

import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL required");
  process.exit(1);
}

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const CONSUMER_GROUPS = [
  { stream: "engine.commands.BTC-PERP", group: "matching-engine:BTC-PERP", consumer: "worker-1" },
  { stream: "engine.commands.ETH-PERP", group: "matching-engine:ETH-PERP", consumer: "worker-1" },
  { stream: "engine.events.BTC-PERP", group: "persistence-worker", consumer: "worker-1" },
  { stream: "engine.events.ETH-PERP", group: "persistence-worker", consumer: "worker-1" },
];

async function claimPending() {
  console.log("🔧 Claiming pending messages...\n");
  console.log("═".repeat(60));
  
  try {
    for (const { stream, group, consumer } of CONSUMER_GROUPS) {
      console.log(`\n📊 ${stream} / ${group}`);
      
      // Get pending messages
      const pending = await redis.xpending(stream, group, "-", "+", 100);
      
      if (!pending || pending.length === 0) {
        console.log("   ✓ No pending messages");
        continue;
      }
      
      console.log(`   Found ${pending.length} pending messages`);
      
      for (const entry of pending) {
        if (!Array.isArray(entry) || entry.length < 4) continue;
        
        const [msgId, originalConsumer, idleTime, deliveryCount] = entry;
        console.log(`   - ${msgId}: idle=${idleTime}ms, deliveries=${deliveryCount}, consumer=${originalConsumer}`);
        
        // If message has been idle for more than 1 second or delivered 3+ times, acknowledge it
        if (Number(idleTime) > 1000 || Number(deliveryCount) >= 3) {
          console.log(`     Acknowledging stuck message...`);
          await redis.xack(stream, group, msgId);
          console.log(`     ✓ Acknowledged`);
        } else {
          // Try to claim and reprocess
          console.log(`     Claiming message for ${consumer}...`);
          try {
            const claimed = await redis.xclaim(
              stream,
              group,
              consumer,
              0, // min-idle-time (0 = claim immediately)
              msgId
            );
            
            if (claimed && claimed.length > 0) {
              console.log(`     ✓ Claimed, acknowledging...`);
              await redis.xack(stream, group, msgId);
              console.log(`     ✓ Acknowledged`);
            }
          } catch (error: any) {
            console.log(`     ⚠️  Claim failed: ${error.message}`);
            // Just ack it anyway to unblock
            await redis.xack(stream, group, msgId);
            console.log(`     ✓ Force acknowledged`);
          }
        }
      }
    }
    
    console.log("\n" + "═".repeat(60));
    console.log("\n✅ Pending messages claimed!");
    console.log("\n💡 Now check stream status:");
    console.log("   bun run check:redis");
    
  } catch (error) {
    console.error("\n❌ Failed to claim pending:", error);
    throw error;
  } finally {
    await redis.quit();
  }
}

claimPending();
