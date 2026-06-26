import {
  ExchangeRuntime,
  OutboxPublisher,
  ProductionMatchingWorker,
  ProductionPersistenceWorker,
  RedisStreamBus,
  RedisOrderBookCache,
  type OutboxPublisherClient,
} from "../../../packages/runtime/src/index";
import { PersistenceService, PrismaPersistenceStore } from "../../../packages/db/src/index";
import type { PrismaClientLike } from "../../../packages/db/src/index";
import { FileSnapshotStore } from "../../../packages/matching-engine/index";

if (Bun.env.RUNTIME_MODE === "production") {
  await runProductionWorkers();
} else {
  runLocalWorker();
}

function runLocalWorker(): void {
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
}

async function runProductionWorkers(): Promise<void> {
  console.log("🚀 Starting production workers...");
  console.log(`Environment: RUNTIME_MODE=${Bun.env.RUNTIME_MODE}`);
  console.log(`Database URL: ${Bun.env.DATABASE_URL ? 'Set' : 'Missing'}`);
  console.log(`Redis URL: ${Bun.env.REDIS_URL ? 'Set' : 'Missing'}`);
  
  try {
    const PrismaClient = await loadPrismaClient();
    console.log("✓ Prisma Client loaded");
    
    const client = new PrismaClient({
      datasources: { db: { url: requiredEnv("DATABASE_URL") } },
    });
    console.log("✓ Database client created");
    
    const redisUrl = requiredEnv("REDIS_URL");
    const bus = new RedisStreamBus({ redisUrl });
    console.log("✓ Redis stream bus created");
    
    const orderBookCache = new RedisOrderBookCache({ redisUrl });
    console.log("✓ OrderBook cache created");
    
    const role = Bun.env.WORKER_ROLE ?? "all";
    const intervalMs = Number(Bun.env.WORKER_INTERVAL_MS ?? 100);
    
    const markets = async () => {
      const rows = await client.market.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      return rows.map((row: { id: string }) => row.id);
    };
    
    // Test database connection
    const activeMarkets = await markets();
    console.log(`✓ Database connected, found ${activeMarkets.length} active markets:`, activeMarkets);
    
    const outbox = new OutboxPublisher(client, bus);
    const matching = new ProductionMatchingWorker({
      bus,
      markets,
      snapshotStore: undefined, // Disable file snapshots in production - not needed with Redis cache
      snapshotClient: undefined,
      snapshotIntervalMs: undefined,
      orderBookCache,
    });
    console.log("✓ Matching worker created");
    
    const persistence = new ProductionPersistenceWorker(
      bus,
      new PersistenceService(new PrismaPersistenceStore(client)),
      markets,
    );
    console.log("✓ Persistence worker created");

    console.log("🔄 Recovering matching engine state...");
    await matching.recover();
    console.log("✓ Recovery complete");
    
    console.log(`✅ Production workers started with role=${role}, interval=${intervalMs}ms`);

    setInterval(async () => {
      try {
        let processed = 0;
        if (role === "all" || role === "outbox") {
          const count = await outbox.publishOnce();
          processed += count;
        }
        if (role === "all" || role === "matching") {
          const count = await matching.processOnce();
          processed += count;
        }
        if (role === "all" || role === "persistence") {
          const count = await persistence.processOnce();
          processed += count;
        }
        
        if (processed > 0) {
          console.log(`[${new Date().toISOString()}] Processed ${processed} items`);
        }
      } catch (error) {
        console.error("[ERROR] Worker iteration failed:", error);
      }
    }, intervalMs);
  } catch (error) {
    console.error("❌ Failed to start production workers:", error);
    throw error;
  }
}

type WorkerPrismaClient = PrismaClientLike &
  OutboxPublisherClient & {
    market: {
      findMany(args: unknown): Promise<Array<{ id: string }>>;
    };
    snapshotMetadata: {
      create(args: unknown): Promise<unknown>;
    };
  };

interface PrismaClientConstructor {
  new (options?: unknown): WorkerPrismaClient;
}

async function loadPrismaClient(): Promise<PrismaClientConstructor> {
  const importer = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{ PrismaClient: PrismaClientConstructor }>;
  const mod = await importer("@prisma/client");
  return mod.PrismaClient;
}

function requiredEnv(name: string): string {
  const value = Bun.env[name];

  if (!value) {
    throw new Error(`${name} is required in production worker mode`);
  }

  return value;
}
