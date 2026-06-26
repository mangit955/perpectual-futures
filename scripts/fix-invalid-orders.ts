#!/usr/bin/env bun
/**
 * Fix invalid orders that are causing matching engine to crash
 * - LIMIT orders with null prices
 * - Orders with invalid quantities
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL required");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function fixInvalidOrders() {
  console.log("🔧 Fixing Invalid Orders...\n");
  
  // Find LIMIT orders with null prices
  const invalidLimitOrders = await prisma.order.findMany({
    where: {
      type: 'LIMIT',
      price: null,
      status: { in: ['PENDING', 'OPEN'] },
    },
    select: {
      id: true,
      marketId: true,
      side: true,
      quantity: true,
      status: true,
    },
  });
  
  console.log(`Found ${invalidLimitOrders.length} LIMIT orders with null price\n`);
  
  if (invalidLimitOrders.length > 0) {
    console.log("❌ These orders will cause matching engine to crash:");
    for (const order of invalidLimitOrders) {
      console.log(`  ${order.id}: ${order.side} ${order.quantity} @ null`);
    }
    
    console.log("\n🔧 Cancelling invalid orders...");
    
    const result = await prisma.order.updateMany({
      where: {
        type: 'LIMIT',
        price: null,
        status: { in: ['PENDING', 'OPEN'] },
      },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Cancelled ${result.count} invalid orders\n`);
  }
  
  // Find MARKET orders (should have been filled immediately)
  const stuckMarketOrders = await prisma.order.findMany({
    where: {
      type: 'MARKET',
      status: 'PENDING',
      createdAt: {
        lt: new Date(Date.now() - 60000), // Older than 1 minute
      },
    },
    select: {
      id: true,
      marketId: true,
      side: true,
      quantity: true,
    },
  });
  
  if (stuckMarketOrders.length > 0) {
    console.log(`Found ${stuckMarketOrders.length} stuck MARKET orders\n`);
    console.log("🔧 Cancelling stuck market orders...");
    
    await prisma.order.updateMany({
      where: {
        type: 'MARKET',
        status: 'PENDING',
        createdAt: {
          lt: new Date(Date.now() - 60000),
        },
      },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Cancelled ${stuckMarketOrders.length} stuck market orders\n`);
  }
  
  // Summary
  console.log("📊 Summary:");
  const pending = await prisma.order.count({ where: { status: 'PENDING' } });
  const open = await prisma.order.count({ where: { status: 'OPEN' } });
  const cancelled = await prisma.order.count({ where: { status: 'CANCELLED' } });
  
  console.log(`  PENDING: ${pending}`);
  console.log(`  OPEN: ${open}`);
  console.log(`  CANCELLED: ${cancelled}`);
  
  if (pending > 0) {
    console.log("\n⚠️  Still have PENDING orders. After fixing:");
    console.log("  1. Reset consumer group: bun run reset:consumers");
    console.log("  2. Restart workers on Railway");
  } else {
    console.log("\n✅ All invalid orders fixed!");
    console.log("  Next: Reset consumers and restart workers");
  }
  
  await prisma.$disconnect();
}

fixInvalidOrders().catch((error) => {
  console.error("❌ Failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
