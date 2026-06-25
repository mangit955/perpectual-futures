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
  const PrismaClient = await loadPrismaClient();
  const client = new PrismaClient({
    datasources: { db: { url: requiredEnv("DATABASE_URL") } },
  });
  const redisUrl = requiredEnv("REDIS_URL");
  const bus = new RedisStreamBus({ redisUrl });
  const orderBookCache = new RedisOrderBookCache({ redisUrl });
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
  const outbox = new OutboxPublisher(client, bus);
  const snapshotDir = Bun.env.SNAPSHOT_DIR ?? "/app/snapshots";
  const matching = new ProductionMatchingWorker({
    bus,
    markets,
    snapshotStore: new FileSnapshotStore(snapshotDir),
    snapshotClient: client,
    snapshotIntervalMs: Number(Bun.env.SNAPSHOT_INTERVAL_MS ?? 60_000),
    orderBookCache,
  });
  const persistence = new ProductionPersistenceWorker(
    bus,
    new PersistenceService(new PrismaPersistenceStore(client)),
    markets,
  );

  await matching.recover();
  console.log(`Production workers started with role=${role}, interval=${intervalMs}ms`);

  setInterval(async () => {
    try {
      if (role === "all" || role === "outbox") {
        await outbox.publishOnce();
      }
      if (role === "all" || role === "matching") {
        await matching.processOnce();
      }
      if (role === "all" || role === "persistence") {
        await persistence.processOnce();
      }
    } catch (error) {
      console.error("worker iteration failed", error);
    }
  }, intervalMs);
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
