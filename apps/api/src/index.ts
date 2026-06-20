import { createApiApp } from "./app";

const port = Number(Bun.env.PORT ?? 3000);
const app = createApiApp();
const workerIntervalMs = Number(Bun.env.WORKER_INTERVAL_MS ?? 50);

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`API listening on http://localhost:${port}`);
console.log(`In-process workers polling every ${workerIntervalMs}ms`);

setInterval(async () => {
  try {
    await app.runtime.drain(1);
  } catch (error) {
    console.error("worker iteration failed", error);
  }
}, workerIntervalMs);
