#!/usr/bin/env bun
/**
 * Test if production workers can actually run and process messages
 */

import { PrismaClient } from "@prisma/client";
import {
  ProductionMatchingWorker,
  ProductionPersistenceWorker,
  RedisStreamBus,
  RedisOrderBookCache,
  OutboxPublisher,
} from "../packages/runtime/src/index";
import { PersistenceService, PrismaPersistenceStore } from "../packages/db/src/index";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

if (!DATABASE_URL || !REDIS_URL) {
  console.error("❌ DATABASE_URL and REDIS_URL required");
  process.exit(1);
}

console.log("🧪 Testing Production Workers Locally\n");
console.log("═".repeat(60));

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const bus = new RedisStreamBus({ redisUrl: REDIS_URL });
const orderBookCache = new RedisOrderBookCache({ redisUrl: REDIS_URL });

const markets = async () => {
  const rows = await prisma.market.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map((row) => row.id);
};

async function testWorkers() {
  try {
    // Get active markets
    const activeMarkets = await markets();
    console.log(`\n✅ Found ${activeMarkets.length} active markets:`, activeMarkets);
    
    // Create workers
    const outbox = new OutboxPublisher(prisma, bus);
    console.log("✅ Outbox publisher created");
    
    const matching = new ProductionMatchingWorker({
      bus,
      markets,
      orderBookCache,
      orderRecoveryClient: prisma,
    });
    console.log("✅ Matching worker created");
    
    const persistence = new ProductionPersistenceWorker(
      bus,
      new PersistenceService(new PrismaPersistenceStore(prisma)),
      markets,
    );
    console.log("✅ Persistence worker created");
    
    // Recover matching engine state
    console.log("\n🔄 Recovering matching engine...");
    await matching.recover();
    console.log("✅ Recovery complete");
    
    // Test processing continuously
    console.log("\n🔄 Running workers continuously...");
    console.log("Press Ctrl+C to stop\n");
    
    let iteration = 0;
    let consecutiveEmpty = 0;
    
    const poll = async () => {
      iteration++;
      let totalProcessed = 0;
      
      try {
        const outboxCount = await outbox.publishOnce();
        totalProcessed += outboxCount;
        if (outboxCount > 0) {
          console.log(`  [${iteration}] Outbox: published ${outboxCount} events`);
        }
        
        const matchingCount = await matching.processOnce();
        totalProcessed += matchingCount;
        if (matchingCount > 0) {
          console.log(`  [${iteration}] Matching: processed ${matchingCount} commands`);
        }
        
        const persistenceCount = await persistence.processOnce();
        totalProcessed += persistenceCount;
        if (persistenceCount > 0) {
          console.log(`  [${iteration}] Persistence: processed ${persistenceCount} events`);
        }
        
        if (totalProcessed === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty === 1) {
            console.log(`  [${iteration}] No messages to process, waiting...`);
          }
        } else {
          consecutiveEmpty = 0;
        }
        
      } catch (error) {
        console.error(`  [${iteration}] Error:`, error);
      }
      
      // Schedule next iteration
      setTimeout(poll, 100);
    };
    
    // Start polling
    poll();
    
  } catch (error) {
    console.error("\n❌ Worker test failed:", error);
    process.exit(1);
  }
}

testWorkers();
