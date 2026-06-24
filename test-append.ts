import { RedisStreamBus } from "./packages/runtime/src/redis-stream-bus";
const bus = new RedisStreamBus({ redisUrl: "redis://localhost:6379" });

async function test() {
  try {
    const written = await bus.append("engine.events.BTC-PERP", {
      type: "engine.event",
      event: { market: "BTC-PERP", type: "test" },
    });
    console.log("Appended:", written);
  } catch (e) {
    console.error("Append error:", e);
  }
  process.exit(0);
}
test();
