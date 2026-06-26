#!/usr/bin/env bun
/**
 * Test script to verify order cancellation works end-to-end
 * Usage: bun run scripts/test-cancel-flow.ts <API_URL> <AUTH_TOKEN>
 * 
 * Example:
 *   bun run scripts/test-cancel-flow.ts https://your-api.railway.app "Bearer eyJ..."
 */

const API_URL = process.argv[2] || "http://localhost:3000";
const AUTH_TOKEN = process.argv[3];

if (!AUTH_TOKEN) {
  console.error("❌ Usage: bun run scripts/test-cancel-flow.ts <API_URL> <AUTH_TOKEN>");
  console.error("   Example: bun run scripts/test-cancel-flow.ts https://api.example.com 'Bearer eyJ...'");
  process.exit(1);
}

interface Order {
  id: string;
  marketId: string;
  side: string;
  type: string;
  quantity: string;
  price?: string;
  status: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCancelFlow() {
  console.log("🧪 Testing Order Cancellation Flow");
  console.log(`API: ${API_URL}`);
  console.log("");

  // Step 1: Create a limit order
  console.log("1️⃣  Creating test order...");
  const createResponse = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": AUTH_TOKEN,
    },
    body: JSON.stringify({
      marketId: "BTC-PERP",
      side: "buy",
      type: "limit",
      quantity: "0.001",
      price: "30000", // Well below current price, won't fill
      timeInForce: "GTC",
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    console.error(`❌ Failed to create order: ${createResponse.status} ${error}`);
    process.exit(1);
  }

  const order: Order = await createResponse.json();
  console.log(`✅ Order created: ${order.id}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   Side: ${order.side}, Qty: ${order.quantity}, Price: ${order.price}`);
  console.log("");

  // Step 2: Wait a bit for order to be processed
  console.log("2️⃣  Waiting 2 seconds for order to be processed...");
  await sleep(2000);

  // Step 3: Verify order exists and is open
  console.log("3️⃣  Checking order status...");
  const getResponse = await fetch(`${API_URL}/orders/${order.id}`, {
    headers: { "Authorization": AUTH_TOKEN },
  });

  if (!getResponse.ok) {
    console.error(`❌ Failed to get order: ${getResponse.status}`);
    process.exit(1);
  }

  const orderBefore: Order = await getResponse.json();
  console.log(`✅ Order status: ${orderBefore.status}`);
  
  if (!["PENDING", "OPEN", "PARTIALLY_FILLED"].includes(orderBefore.status)) {
    console.error(`❌ Order is not cancellable. Status: ${orderBefore.status}`);
    process.exit(1);
  }
  console.log("");

  // Step 4: Cancel the order
  console.log("4️⃣  Cancelling order...");
  const cancelResponse = await fetch(`${API_URL}/orders/${order.id}`, {
    method: "DELETE",
    headers: { "Authorization": AUTH_TOKEN },
  });

  if (!cancelResponse.ok) {
    const error = await cancelResponse.text();
    console.error(`❌ Failed to cancel order: ${cancelResponse.status} ${error}`);
    process.exit(1);
  }

  const cancelResult = await cancelResponse.json();
  console.log(`✅ Cancel request accepted: ${cancelResult.status}`);
  console.log("");

  // Step 5: Wait for cancellation to be processed
  console.log("5️⃣  Waiting 3 seconds for cancellation to be processed...");
  await sleep(3000);

  // Step 6: Verify order is cancelled
  console.log("6️⃣  Verifying order is cancelled...");
  const finalResponse = await fetch(`${API_URL}/orders/${order.id}`, {
    headers: { "Authorization": AUTH_TOKEN },
  });

  if (!finalResponse.ok) {
    console.error(`❌ Failed to get order: ${finalResponse.status}`);
    process.exit(1);
  }

  const finalOrder: Order = await finalResponse.json();
  console.log(`   Order status: ${finalOrder.status}`);
  
  if (finalOrder.status === "CANCELLED") {
    console.log("✅ SUCCESS! Order was cancelled successfully! 🎉");
    console.log("");
    console.log("Summary:");
    console.log(`  Order ID: ${finalOrder.id}`);
    console.log(`  Initial Status: ${orderBefore.status}`);
    console.log(`  Final Status: ${finalOrder.status}`);
    console.log(`  Time taken: ~5 seconds`);
    process.exit(0);
  } else {
    console.error(`❌ FAILED! Order status is ${finalOrder.status}, expected CANCELLED`);
    console.error("");
    console.error("Possible causes:");
    console.error("  1. Workers are not running");
    console.error("  2. Redis PEL is full (run: bun run scripts/cleanup-pel.ts)");
    console.error("  3. OutboxPublisher is not polling");
    console.error("");
    console.error("Check worker logs and run diagnostics:");
    console.error("  cd apps/api && bun run diag.ts");
    process.exit(1);
  }
}

testCancelFlow().catch((error) => {
  console.error("❌ Test failed with error:", error);
  process.exit(1);
});
