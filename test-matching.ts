import { MatchingEngine } from "./packages/matching-engine/index";

const engine = new MatchingEngine();
const payload = {"side":"buy","type":"limit","market":"BTC-PERP","userId":"cmqs75a090000ft147kqjm9hw","orderId":"order_65a4176f-496b-4383-9d2c-1fb55d457f15","qtyLots":12,"postOnly":false,"commandId":"cmd-order_65a4176f-496b-4383-9d2c-1fb55d457f15","createdAt":1782315083172,"priceTicks":87.75,"reduceOnly":false,"timeInForce":"GTC"};

try {
  console.log("Submitting order...");
  const events = engine.submitOrder(payload as any);
  console.log("Events:", events);
} catch (e) {
  console.error("Error:", e);
}
