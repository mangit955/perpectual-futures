#!/usr/bin/env bun
/**
 * Check Redis streams and consumer groups status
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

const STREAMS = [
  "order.outbox",
  "engine.commands.BTC-PERP",
  "engine.commands.ETH-PERP",
  "engine.events.BTC-PERP",
  "engine.events.ETH-PERP",
];

async function checkStreams() {
  console.log("🔍 Checking Redis Streams\n");
  console.log("═".repeat(60));
  
  try {
    for (const stream of STREAMS) {
      console.log(`\n📊 Stream: ${stream}`);
      
      // Get stream length
      const length = await redis.xlen(stream);
      console.log(`   Length: ${length} messages`);
      
      if (length === 0) {
        console.log("   (empty)");
        continue;
      }
      
      // Get latest messages
      const messages = await redis.xrevrange(stream, "+", "-", "COUNT", "5");
      console.log(`   Latest ${messages.length} messages:`);
      
      for (const [id, fields] of messages) {
        console.log(`     - ID: ${id}`);
        // Parse the message fields
        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          if (key === "data") {
            try {
              const parsed = JSON.parse(value);
              console.log(`       ${key}: ${parsed.type || parsed.eventType || "unknown"}`);
            } catch {
              console.log(`       ${key}: ${value.substring(0, 50)}...`);
            }
          }
        }
      }
      
      // Check consumer groups
      try {
        const groups = await redis.xinfo("GROUPS", stream);
        console.log(`   Consumer groups: ${groups.length / 7}`);
        
        for (let i = 0; i < groups.length; i += 14) {
          const groupName = groups[i + 1];
          const pending = groups[i + 3];
          const lastDeliveredId = groups[i + 5];
          
          console.log(`     - ${groupName}:`);
          console.log(`       Pending: ${pending}`);
          console.log(`       Last ID: ${lastDeliveredId}`);
          
          // Check pending entries
          if (pending > 0) {
            const pendings = await redis.xpending(stream, groupName, "-", "+", 10);
            console.log(`       Pending entries:`);
            for (const entry of pendings) {
              if (Array.isArray(entry) && entry.length >= 4) {
                const [msgId, consumer, idle, deliveryCount] = entry;
                console.log(`         * ${msgId}: consumer=${consumer}, idle=${idle}ms, deliveries=${deliveryCount}`);
              }
            }
          }
        }
      } catch (error: any) {
        if (!error.message.includes("no such key")) {
          console.log(`   Error checking groups: ${error.message}`);
        }
      }
    }
    
    console.log("\n" + "═".repeat(60));
    console.log("\n✅ Stream check complete!");
    
  } catch (error) {
    console.error("\n❌ Failed to check streams:", error);
    throw error;
  } finally {
    await redis.quit();
  }
}

checkStreams();
