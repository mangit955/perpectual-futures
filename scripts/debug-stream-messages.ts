#!/usr/bin/env bun
/**
 * Debug what messages are actually in Redis streams
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

async function debugStreams() {
  console.log("🔍 Debugging Redis Stream Messages\n");
  console.log("═".repeat(60));
  
  const stream = "engine.commands.BTC-PERP";
  const group = "matching-engine:BTC-PERP";
  
  try {
    // Get stream length
    const length = await redis.xlen(stream);
    console.log(`\n📊 Stream: ${stream}`);
    console.log(`   Length: ${length} messages`);
    
    // Get all messages in stream
    console.log(`\n   All messages in stream:`);
    const allMessages = await redis.xrange(stream, "-", "+");
    for (const [id, fields] of allMessages) {
      console.log(`     ${id}:`);
      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key === "data") {
          try {
            const parsed = JSON.parse(value);
            console.log(`       type: ${parsed.type}`);
            if (parsed.command?.orderId) {
              console.log(`       orderId: ${parsed.command.orderId}`);
            }
          } catch {
            console.log(`       data: ${value.substring(0, 80)}...`);
          }
        }
      }
    }
    
    // Check consumer group info
    console.log(`\n   Consumer group: ${group}`);
    const groups = await redis.xinfo("GROUPS", stream);
    
    for (let i = 0; i < groups.length; i += 14) {
      const name = groups[i + 1];
      if (name !== group) continue;
      
      const consumers = groups[i + 3];
      const pending = groups[i + 7];
      const lastId = groups[i + 9];
      
      console.log(`     Consumers: ${consumers}`);
      console.log(`     Pending: ${pending}`);
      console.log(`     Last delivered ID: ${lastId}`);
      
      // Check if last-id is blocking new messages
      console.log(`\n   🔍 Checking if messages are BEFORE last-id...`);
      for (const [id] of allMessages) {
        const isBeforeLastId = compareStreamIds(id, lastId) <= 0;
        console.log(`     ${id}: ${isBeforeLastId ? "❌ BEFORE last-id (will be skipped)" : "✅ AFTER last-id (will be read)"}`);
      }
    }
    
    // Try reading with XREADGROUP
    console.log(`\n   🧪 Testing XREADGROUP...`);
    try {
      const result = await redis.xreadgroup(
        "GROUP",
        group,
        "test-consumer",
        "COUNT",
        "10",
        "STREAMS",
        stream,
        ">"
      );
      
      if (!result || result.length === 0) {
        console.log(`     ❌ No messages returned by XREADGROUP`);
        console.log(`     This means all messages are BEFORE the consumer group's last-id`);
      } else {
        console.log(`     ✅ Found ${result[0][1].length} messages`);
      }
    } catch (error: any) {
      console.log(`     ❌ Error: ${error.message}`);
    }
    
    console.log("\n" + "═".repeat(60));
    console.log("\n💡 Diagnosis:");
    console.log("   If messages are BEFORE last-id, the consumer group needs to be reset.");
    console.log("   Run: bun run scripts/reset-consumer-group.ts");
    
  } catch (error) {
    console.error("\n❌ Failed:", error);
    throw error;
  } finally {
    await redis.quit();
  }
}

function compareStreamIds(id1: string, id2: string): number {
  const [ms1, seq1] = id1.split("-").map(Number);
  const [ms2, seq2] = id2.split("-").map(Number);
  
  if (ms1 !== ms2) {
    return ms1 - ms2;
  }
  return seq1 - seq2;
}

debugStreams();
