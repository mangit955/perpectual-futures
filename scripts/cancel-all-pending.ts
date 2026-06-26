#!/usr/bin/env bun
/**
 * Cancel all PENDING orders to clear the queue
 * This allows the system to start fresh
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

async function cancelAllPending() {
  console.log("🔧 Cancelling All PENDING Orders...\n");
  
  // Get count first
  const pendingCount = await prisma.order.count({
    where: { status: 'PENDING' },
  });
  
  console.log(`Found ${pendingCount} PENDING orders\n`);
  
  if (pendingCount === 0) {
    console.log("✅ No PENDING orders to cancel");
    await prisma.$disconnect();
    return;
  }
  
  // Show some examples
  const examples = await prisma.order.findMany({
    where: { status: 'PENDING' },
    take: 5,
    select: {
      id: true,
      marketId: true,
      side: true,
      type: true,
      quantity: true,
      price: true,
      createdAt: true,
    },
  });
  
  console.log("Examples:");
  for (const order of examples) {
    console.log(`  ${order.id}: ${order.type} ${order.side} ${order.quantity} @ ${order.price || 'MARKET'}`);
  }
  console.log("");
  
  console.log("⚠️  This will cancel all PENDING orders.");
  console.log("    Users can create new orders after this.\n");
  
  // Cancel all PENDING orders
  const result = await prisma.order.updateMany({
    where: { status: 'PENDING' },
    data: {
      status: 'CANCELLED',
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ Cancelled ${result.count} PENDING orders\n`);
  
  // Also cancel any OPEN orders from the recovered orderbook
  const openCount = await prisma.order.count({
    where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
  });
  
  if (openCount > 0) {
    console.log(`⚠️  Found ${openCount} OPEN/PARTIALLY_FILLED orders`);
    console.log("    These were recovered by matching engine but not processing correctly\n");
    
    const openResult = await prisma.order.updateMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Cancelled ${openResult.count} OPEN/PARTIALLY_FILLED orders\n`);
  }
  
  console.log("📊 Final Summary:");
  const pending = await prisma.order.count({ where: { status: 'PENDING' } });
  const open = await prisma.order.count({ where: { status: 'OPEN' } });
  const cancelled = await prisma.order.count({ where: { status: 'CANCELLED' } });
  
  console.log(`  PENDING: ${pending}`);
  console.log(`  OPEN: ${open}`);
  console.log(`  CANCELLED: ${cancelled}`);
  
  console.log("\n✅ System cleared! Next steps:");
  console.log("  1. Restart workers on Railway");
  console.log("  2. Create a new test order");
  console.log("  3. It should process within 1-2 seconds");
  
  await prisma.$disconnect();
}

cancelAllPending().catch((error) => {
  console.error("❌ Failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
