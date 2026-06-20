import {
  RedisStreamBus,
} from "../../../packages/runtime/src/index";
import {
  BinanceMarketDataService,
  type MarketSymbolMapping,
} from "./binance";

const PrismaClient = await loadPrismaClient();
const client = new PrismaClient({
  datasources: { db: { url: requiredEnv("DATABASE_URL") } },
});
const mappings = await loadMappings(client);

if (mappings.length === 0) {
  throw new Error("no market-data symbols configured");
}

const service = new BinanceMarketDataService({
  url: requiredEnv("BINANCE_WS_URL"),
  mappings,
  bus: new RedisStreamBus({
    redisUrl: requiredEnv("REDIS_URL"),
  }),
});

console.log(
  `Starting Binance market-data for ${mappings
    .map((mapping) => `${mapping.binanceSymbol}:${mapping.marketId}`)
    .join(", ")}`,
);
service.start();

async function loadMappings(client: {
  market: {
    findMany(args: unknown): Promise<Array<{
      id: string;
      baseAsset: string;
      quoteAsset: string;
    }>>;
  };
}): Promise<MarketSymbolMapping[]> {
  const configured = Bun.env.MARKET_DATA_SYMBOLS;

  if (configured) {
    return configured.split(",").map((entry) => {
      const [symbol, marketId] = entry.split(":");

      if (!symbol || !marketId) {
        throw new Error(`invalid MARKET_DATA_SYMBOLS entry: ${entry}`);
      }

      return {
        binanceSymbol: symbol.toUpperCase(),
        marketId,
      };
    });
  }

  const markets = await client.market.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, baseAsset: true, quoteAsset: true },
  });

  return markets.map((market) => ({
    binanceSymbol: `${market.baseAsset}USDT`.toUpperCase(),
    marketId: market.id,
  }));
}

interface MarketDataPrismaClient {
  market: {
    findMany(args: unknown): Promise<Array<{
      id: string;
      baseAsset: string;
      quoteAsset: string;
    }>>;
  };
}

interface PrismaClientConstructor {
  new (options?: unknown): MarketDataPrismaClient;
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
    throw new Error(`${name} is required`);
  }

  return value;
}
