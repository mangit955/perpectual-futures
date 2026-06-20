import { createApiApp } from "./app";
import { createProductionApiApp } from "./production";

const port = Number(Bun.env.PORT ?? 3000);
const productionMode = Bun.env.RUNTIME_MODE === "production";
const app = productionMode ? await createProductionApiApp() : createApiApp();
const workerIntervalMs = Number(Bun.env.WORKER_INTERVAL_MS ?? 50);

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`API listening on http://localhost:${port}`);

if (productionMode) {
  console.log("Production mode enabled; run apps/workers for Redis workers");
} else {
  console.log(`In-process workers polling every ${workerIntervalMs}ms`);
  setInterval(async () => {
    try {
      await app.runtime.drain(1);
    } catch (error) {
      console.error("worker iteration failed", error);
    }
  }, workerIntervalMs);
}
