import { PrismaApiRuntime } from "../../../packages/runtime/src/index";
import type { PrismaApiClient } from "../../../packages/runtime/src/index";
import { createApiApp } from "./app";

export async function createProductionApiApp() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const jwtSecret = requiredEnv("JWT_SECRET");
  const PrismaClient = await loadPrismaClient();
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  return createApiApp({
    apiRuntime: new PrismaApiRuntime({
      client,
      jwtSecret,
    }),
  });
}

interface PrismaClientConstructor {
  new (options?: unknown): PrismaApiClient;
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
    throw new Error(`${name} is required for production API mode`);
  }

  return value;
}
