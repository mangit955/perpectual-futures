#!/usr/bin/env bun
/**
 * Test Redis connection and consumer group operations
 */

import RedisClient from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL required");
  process.exit(1);
}

async function testRedis() {
  console.log("🧪 Testing Redis Connection...\n");
  
  const redis = new RedisClient(REDIS_URL);
  
  try {
    // Test basic connectivity
    console.log("1️⃣ Testing PING...");
    const pong = await redis.ping();
    console.log(`   ✅ PING: ${pong}\n`);
    
    // Test XINFO
    console.log("2️⃣ Testing XINFO GROUPS...");
    const stream = 'engine.commands.BTC-PERP';
    const groups = await redis.xinfo('GROUPS', stream);
    console.log(`   ✅ Groups found: ${groups.length / 14}`);
    console.log(`   Raw:`, groups.slice(0, 28), '\n');
    
    // Test XREADGROUP
    console.log("3️⃣ Testing XREADGROUP...");
    const messages = await redis.xreadgroup(
      'GROUP', 'matching-engine:BTC-PERP', 
      'test-consumer',
      'COUNT', '1',
      'STREAMS', stream, '>'
    );
    
    if (!messages || messages === null) {
      console.log(`   ℹ️  No new messages (this is OK if queue is empty)`);
    } else {
      console.log(`   ✅ Got messages:`, messages);
    }
    console.log('');
    
    // Test with Bun.RedisClient if available
    console.log("4️⃣ Testing Bun.RedisClient...");
    const bunWithRedis = Bun as any;
    if (bunWithRedis.RedisClient) {
      console.log(`   ✅ Bun.RedisClient is available`);
      try {
        const bunRedis = new bunWithRedis.RedisClient(REDIS_URL);
        const result = await bunRedis.send('PING', []);
        console.log(`   ✅ Bun Redis PING: ${result}`);
      } catch (e: any) {
        console.log(`   ❌ Bun Redis error:`, e.message);
      }
    } else {
      console.log(`   ⚠️  Bun.RedisClient is NOT available (using ioredis)`);
    }
    console.log('');
    
    // Check current stream state
    console.log("5️⃣ Current Stream State:");
    const cmdLen = await redis.xlen('engine.commands.BTC-PERP');
    const evtLen = await redis.xlen('engine.events.BTC-PERP');
    console.log(`   Commands: ${cmdLen} messages`);
    console.log(`   Events: ${evtLen} messages`);
    
    if (cmdLen > 0 && evtLen === 0) {
      console.log(`   🚨 PROBLEM: Commands exist but no events!`);
      console.log(`   This means matching worker is not processing.`);
    }
    console.log('');
    
    console.log("✅ Redis connectivity test passed!");
    
  } catch (error: any) {
    console.error("❌ Redis test failed:", error.message);
    console.error("Full error:", error);
  } finally {
    redis.quit();
  }
}

testRedis();
