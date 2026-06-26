#!/usr/bin/env bun
/**
 * Reset consumer group to reprocess all messages
 * This forces the matching engine to re-read and re-process all commands
 */

import RedisClient from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL required");
  process.exit(1);
}

const redis = new RedisClient(REDIS_URL);

async function resetConsumerGroup() {
  console.log("🔄 Resetting Consumer Group...\n");
  console.log("⚠️  This will cause all commands to be reprocessed\n");
  
  const markets = ['BTC-PERP', 'ETH-PERP'];
  
  for (const market of markets) {
    const cmdStream = `engine.commands.${market}`;
    const group = `matching-engine:${market}`;
    
    console.log(`📊 ${market}:`);
    
    // Get current state
    const len = await redis.xlen(cmdStream);
    console.log(`  Stream length: ${len} messages`);
    
    if (len === 0) {
      console.log(`  ✓ No messages, skipping\n`);
      continue;
    }
    
    try {
      // Delete the consumer group
      await redis.xgroup('DESTROY', cmdStream, group);
      console.log(`  ✅ Destroyed consumer group: ${group}`);
      
      // Recreate from beginning
      await redis.xgroup('CREATE', cmdStream, group, '0', 'MKSTREAM');
      console.log(`  ✅ Recreated consumer group from beginning`);
      
      const info = await redis.xinfo('GROUPS', cmdStream);
      console.log(`  ✓ New state:`, info);
      
    } catch (error: any) {
      console.error(`  ❌ Error:`, error.message);
    }
    
    console.log('');
  }
  
  console.log("✅ Consumer groups reset!\n");
  console.log("⚠️  IMPORTANT: Now restart the workers on Railway");
  console.log("   The workers will reprocess all commands and generate events\n");
  
  redis.quit();
}

resetConsumerGroup().catch((error) => {
  console.error("❌ Failed:", error);
  redis.quit();
  process.exit(1);
});
