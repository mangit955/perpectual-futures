import { ProductionMatchingWorker } from "./packages/runtime/src/production-workers";
import { RedisStreamBus } from "./packages/runtime/src/redis-stream-bus";

const bus = new RedisStreamBus({ redisUrl: "redis://localhost:6379" });

const worker = new ProductionMatchingWorker({
  bus,
  markets: () => ["BTC-PERP"],
});

async function run() {
  try {
    console.log("Running worker...");
    const p = await worker.processOnce();
    console.log("Processed:", p);
  } catch (e) {
    console.error("Worker error:", e);
  }
  process.exit(0);
}

run();
