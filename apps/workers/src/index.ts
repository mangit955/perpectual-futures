import { ExchangeRuntime } from "../../../packages/runtime/src/index";

const runtime = new ExchangeRuntime();
const intervalMs = Number(Bun.env.WORKER_INTERVAL_MS ?? 100);

console.log(`Workers polling every ${intervalMs}ms`);

setInterval(async () => {
  try {
    await runtime.drain(1);
  } catch (error) {
    console.error("worker iteration failed", error);
  }
}, intervalMs);
