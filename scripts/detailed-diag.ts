#!/usr/bin/env bun
/**
 * Detailed diagnostic to understand why cancellations aren't working
 */

import { PrismaClient } from '@prisma/client';
import RedisClient from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!REDIS_URL || !DATABASE_URL) {
  console.error("❌ Required: REDIS_URL and DATABASE_URL");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const redis = new RedisClient(REDIS_URL);

async function detailedDiag() {
  console.log("🔍 Detailed Production Diagnostic");
  console.log("=" .repeat(60));
  
  // 1. Check outbox events
  console.log("\n📦 Outbox Events (last 10):");
  const recentOutbox = await prisma.outboxEvent.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      payload: true,
    },
  });
  
  for (const event of recentOutbox) {
    const payload = event.payload as any;
    console.log(`  ${event.id}: ${event.type} - ${event.status}`);
    console.log(`    Created: ${event.createdAt}`);
    console.log(`    Published: ${event.publishedAt || 'NOT YET'}`);
    if (payload?.command) {
      console.log(`    OrderId: ${payload.command.orderId || 'N/A'}`);
    }
  }
  
  // 2. Check recent orders
  console.log("\n📋 Recent Orders (last 5):");
  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      marketId: true,
      side: true,
      status: true,
      quantity: true,
      price: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  for (const order of recentOrders) {
    console.log(`  ${order.id}:`);
    console.log(`    Market: ${order.marketId}, Side: ${order.side}`);
    console.log(`    Status: ${order.status}, Qty: ${order.quantity}, Price: ${order.price}`);
    console.log(`    Created: ${order.createdAt}, Updated: ${order.updatedAt}`);
  }
  
  // 3. Check Redis streams
  console.log("\n🔴 Redis Streams:");
  
  for (const market of ['BTC-PERP', 'ETH-PERP']) {
    const cmdStream = `engine.commands.${market}`;
    const evtStream = `engine.events.${market}`;
    
    console.log(`\n  ${market}:`);
    
    // Commands
    const cmdLen = await redis.xlen(cmdStream);
    console.log(`    Commands: ${cmdLen} messages`);
    
    if (cmdLen > 0) {
      // Get last 3 commands
      const lastCmds = await redis.xrevrange(cmdStream, '+', '-', 'COUNT', '3');
      console.log(`    Last 3 commands:`);
      for (const [id, fields] of lastCmds) {
        const payload = JSON.parse(fields[1]);
        console.log(`      ${id}: ${payload.type} ${payload.command?.orderId || ''}`);
      }
    }
    
    // Events
    const evtLen = await redis.xlen(evtStream);
    console.log(`    Events: ${evtLen} messages`);
    
    if (evtLen > 0) {
      const lastEvts = await redis.xrevrange(evtStream, '+', '-', 'COUNT', '3');
      console.log(`    Last 3 events:`);
      for (const [id, fields] of lastEvts) {
        const payload = JSON.parse(fields[1]);
        console.log(`      ${id}: ${payload.event?.type || 'unknown'}`);
      }
    } else {
      console.log(`    ⚠️  NO EVENTS - Matching engine not producing events!`);
    }
    
    // Consumer group info
    try {
      const groups = await redis.xinfo('GROUPS', cmdStream);
      console.log(`    Consumer groups:`);
      for (let i = 0; i < groups.length; i += 14) {
        const name = groups[i + 1];
        const consumers = groups[i + 3];
        const pending = groups[i + 5];
        const lastId = groups[i + 7];
        console.log(`      ${name}: ${consumers} consumers, ${pending} pending, last: ${lastId}`);
      }
    } catch (e) {
      console.log(`    ⚠️  No consumer groups created yet`);
    }
  }
  
  // 4. System health summary
  console.log("\n" + "=".repeat(60));
  console.log("🏥 Health Summary:");
  
  const pending = await prisma.outboxEvent.count({ where: { status: 'PENDING' } });
  const failed = await prisma.outboxEvent.count({ where: { status: 'FAILED' } });
  const evtLen = await redis.xlen('engine.events.BTC-PERP');
  
  if (pending > 0) {
    console.log("  ❌ Outbox has PENDING events - OutboxPublisher not running?");
  } else {
    console.log("  ✅ Outbox is clean");
  }
  
  if (failed > 0) {
    console.log(`  ❌ Outbox has ${failed} FAILED events - check errors`);
  }
  
  if (evtLen === 0) {
    console.log("  🚨 CRITICAL: No events in engine.events stream!");
    console.log("     This means the MatchingWorker is NOT RUNNING or NOT PROCESSING");
    console.log("     Action: Check Railway workers logs and restart if needed");
  } else {
    console.log("  ✅ Events stream has messages - matching engine is working");
  }
  
  console.log("\n💡 Recommendation:");
  if (evtLen === 0) {
    console.log("  1. Check if workers are deployed and running on Railway");
    console.log("  2. Check workers logs for errors");
    console.log("  3. Verify RUNTIME_MODE=production is set");
    console.log("  4. Verify DATABASE_URL and REDIS_URL are correct");
    console.log("  5. Restart workers service");
  } else {
    console.log("  System appears healthy. Try creating and cancelling a test order.");
  }
  
  await prisma.$disconnect();
  redis.quit();
}

detailedDiag().catch(console.error);
