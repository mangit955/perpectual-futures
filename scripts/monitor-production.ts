#!/usr/bin/env bun
/**
 * Production monitoring script
 * Shows real-time status of outbox, Redis streams, and PEL
 * Usage: REDIS_URL="..." DATABASE_URL="..." bun run scripts/monitor-production.ts
 */

import { PrismaClient } from '@prisma/client';
import RedisClient from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!REDIS_URL || !DATABASE_URL) {
  console.error("❌ Required environment variables:");
  console.error("   REDIS_URL - Redis connection URL");
  console.error("   DATABASE_URL - PostgreSQL connection URL");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const redis = new RedisClient(REDIS_URL);

async function getStreamInfo(stream: string) {
  try {
    const length = await redis.xlen(stream);
    const groups = await redis.xinfo('GROUPS', stream);
    
    return {
      length,
      groups: groups.map((group: any) => ({
        name: group[1],
        consumers: group[3],
        pending: group[5],
        lag: group[11],
      })),
    };
  } catch (error: any) {
    if (error.message?.includes('no such key')) {
      return { length: 0, groups: [] };
    }
    throw error;
  }
}

async function monitor() {
  console.clear();
  console.log("🔍 Production System Monitor");
  console.log("=" .repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  // Outbox Status
  console.log("📦 Outbox Status");
  console.log("-".repeat(60));
  const pending = await prisma.outboxEvent.count({ where: { status: 'PENDING' } });
  const failed = await prisma.outboxEvent.count({ where: { status: 'FAILED' } });
  const published = await prisma.outboxEvent.count({ where: { status: 'PUBLISHED' } });
  
  console.log(`  PENDING:   ${pending.toString().padStart(6)} ${pending > 10 ? '⚠️  High!' : pending > 0 ? '⚡' : '✅'}`);
  console.log(`  FAILED:    ${failed.toString().padStart(6)} ${failed > 0 ? '❌ Check logs!' : '✅'}`);
  console.log(`  PUBLISHED: ${published.toString().padStart(6)} ${published > 0 ? '✅' : ''}`);
  console.log("");

  // Redis Streams Status
  console.log("🔴 Redis Streams");
  console.log("-".repeat(60));
  
  const markets = ['BTC-PERP', 'ETH-PERP'];
  
  for (const market of markets) {
    console.log(`\n  ${market}:`);
    
    // Command Stream
    const cmdStream = `engine.commands.${market}`;
    const cmdInfo = await getStreamInfo(cmdStream);
    console.log(`    Commands: ${cmdInfo.length} messages`);
    
    for (const group of cmdInfo.groups) {
      const status = group.pending === 0 ? '✅' : 
                     group.pending < 100 ? '⚡' : 
                     group.pending < 500 ? '⚠️' : '🚨';
      console.log(`      Group: ${group.name}`);
      console.log(`        Consumers: ${group.consumers}`);
      console.log(`        Pending:   ${group.pending} ${status}`);
      console.log(`        Lag:       ${group.lag}`);
      
      if (group.pending > 100) {
        console.log(`        ⚠️  WARNING: High PEL count! Consider running cleanup.`);
      }
      if (group.pending > 800) {
        console.log(`        🚨 CRITICAL: Near PEL limit (1000)! Run cleanup NOW!`);
      }
    }
    
    // Event Stream
    const evtStream = `engine.events.${market}`;
    const evtInfo = await getStreamInfo(evtStream);
    console.log(`    Events: ${evtInfo.length} messages`);
    
    for (const group of evtInfo.groups) {
      const status = group.pending === 0 ? '✅' : group.pending < 100 ? '⚡' : '⚠️';
      console.log(`      Group: ${group.name}`);
      console.log(`        Pending: ${group.pending} ${status}`);
    }
  }
  
  console.log("");
  console.log("=" .repeat(60));
  
  // Health Summary
  const totalPending = (await getStreamInfo('engine.commands.BTC-PERP')).groups
    .reduce((sum, g) => sum + g.pending, 0) +
    (await getStreamInfo('engine.commands.ETH-PERP')).groups
    .reduce((sum, g) => sum + g.pending, 0);
  
  if (pending === 0 && failed === 0 && totalPending === 0) {
    console.log("✅ System Health: EXCELLENT - All systems operational");
  } else if (pending < 10 && failed === 0 && totalPending < 100) {
    console.log("⚡ System Health: GOOD - Minor backlog, should clear soon");
  } else if (pending < 50 && failed < 5 && totalPending < 500) {
    console.log("⚠️  System Health: DEGRADED - Check worker logs");
  } else {
    console.log("🚨 System Health: CRITICAL - Immediate action required!");
    console.log("");
    console.log("   Recommended actions:");
    if (totalPending > 500) {
      console.log("   1. Run PEL cleanup: bun run scripts/cleanup-pel.ts");
    }
    if (pending > 50) {
      console.log("   2. Restart workers to process outbox backlog");
    }
    if (failed > 5) {
      console.log("   3. Check worker error logs for root cause");
    }
  }
  
  console.log("");
  console.log("Press Ctrl+C to exit");
}

async function monitorLoop() {
  while (true) {
    try {
      await monitor();
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("❌ Monitor error:", error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

monitorLoop()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    redis.quit();
  });
