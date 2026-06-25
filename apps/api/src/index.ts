import { createApiApp } from "./app";
import { createProductionApiApp } from "./production";
import { getWebSocketHandlers } from "../../../packages/websocket/src/index";

const port = Number(Bun.env.PORT ?? 3000);
const productionMode = Bun.env.RUNTIME_MODE === "production";
const app = productionMode ? await createProductionApiApp() : createApiApp();
const workerIntervalMs = Number(Bun.env.WORKER_INTERVAL_MS ?? 50);

// Get WebSocket handlers for the hub
const wsHandlers = getWebSocketHandlers(app.hub);

interface ServerData {
  connectionId: string;
}

const server = Bun.serve<ServerData>({
  port,
  fetch(request, server) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(request, {
        data: { connectionId: crypto.randomUUID() },
      });
      
      if (upgraded) {
        return undefined; // Upgrade successful
      }
      
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    
    // Regular HTTP requests
    return app.fetch(request);
  },
  websocket: wsHandlers,
});

console.log(`API listening on http://localhost:${port}`);
console.log(`WebSocket available at ws://localhost:${port}/ws`);

if (productionMode) {
  console.log("Production mode enabled; run apps/workers for Redis workers");
} else {
  console.log(`In-process workers polling every ${workerIntervalMs}ms`);
  console.log(`[DEBUG] Worker debug logging enabled`);
  
  setInterval(async () => {
    try {
      const processed = await app.runtime.drain(1);
      
      if (processed > 0) {
        console.log(`[DEBUG] Processed ${processed} items at ${new Date().toISOString()}`);
        
        // Check orderbook to see if orders are there
        try {
          const ob = await app.runtime.getOrderBook("BTC-PERP", 5);
          console.log(`[DEBUG] BTC-PERP orderbook: ${JSON.stringify(ob).substring(0, 200)}...`);
        } catch (err) {
          console.error("[DEBUG] Error getting orderbook:", err);
        }
      }
    } catch (error) {
      console.error("worker iteration failed", error);
    }
  }, workerIntervalMs);
}
