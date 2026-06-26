#!/usr/bin/env bun
/**
 * Initialize Redis consumer groups for production workers
 */

import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL required");
  process.exit(1);
}

console.log("🔧 Initializing Redis consumer groups...\n");

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const STREAMS = [
  // Matching engine command streams
  { stream: "engine.commands.BTC-PERP", group: "matching-engine:BTC-PERP" },
  { stream: "engine.commands.ETH-PERP", group: "matching-engine:ETH-PERP" },
  
  // Matching engine event streams (for persistence worker)
  { stream: "engine.events.BTC-PERP", group: "persistence:BTC-PERP" },
  { stream: "engine.events.ETH-PERP", group: "persistence:ETH-PERP" },
  
  // Order outbox stream (from DB to matching)
  { stream: "order.outbox", group: "matching-engine" },
];

async function initGroups() {
  try {
    for (const { stream, group } of STREAMS) {
      try {
        // Try to create the group (will fail if already exists)
        await redis.xgroup("CREATE", stream, group, "0", "MKSTREAM");
        console.log(`✅ Created group '${group}' for stream '${stream}'`);
      } catch (error: any) {
        if (error.message.includes("BUSYGROUP")) {
          console.log(`ℹ️  Group '${group}' already exists for stream '${stream}'`);
        } else {
          console.error(`❌ Failed to create group '${group}' for stream '${stream}':`, error.message);
        }
      }
    }
    
    console.log("\n✅ Redis consumer groups initialized!");
    
    // Show stream info
    console.log("\n📊 Stream Status:");
    for (const { stream, group } of STREAMS) {
      try {
        const info = await redis.xinfo("GROUPS", stream);
        console.log(`\n  ${stream}:`);
        for (let i = 0; i < info.length; i++) {
          const groupInfo = info[i];
          if (Array.isArray(groupInfo)) {
            const name = groupInfo[1];
            const pending = groupInfo[3];
            const lastId = groupInfo[5];
            console.log(`    - ${name}: ${pending} pending, last-id=${lastId}`);
          }
        }
      } catch (error: any) {
        console.log(`    No groups yet for ${stream}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Failed to initialize groups:", error);
    throw error;
  } finally {
    await redis.quit();
  }
}

initGroups();
