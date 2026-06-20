# Perpetual Futures Exchange Backend

Educational backend reference for a centralized perpetual futures exchange.

The implementation favors explicit TypeScript modules, deterministic tests, and
simple service boundaries over heavy abstractions.

## Implemented Packages

```text
packages/matching-engine   In-memory orderbook, matching, snapshots, recovery
packages/db                Prisma schema contracts, persistence service, mappers
packages/risk              Positions, margin, funding, liquidation, ADL
packages/websocket         Subscription hub and websocket server factory
packages/runtime           API/worker orchestration and stream bus
apps/api                   Runnable backend API with in-process workers
apps/workers               Worker loop entrypoint for adapter deployments
```

## Infrastructure

```bash
docker compose up -d postgres redis
```

Environment defaults are documented in `.env.example`.

## Prisma

Schema:

```text
prisma/schema.prisma
```

Initial migration:

```text
prisma/migrations/20260614000000_phase_2_persistence/migration.sql
```

Seed data:

```text
prisma/seed.sql
```

Prisma dependencies are not vendored in this workspace. After installing
`prisma` and `@prisma/client`, run package scripts from `packages/db`.

## Verification

```bash
bun test
bunx tsc --noEmit -p packages/matching-engine/tsconfig.json
bunx tsc --noEmit -p packages/db/tsconfig.json
bunx tsc --noEmit -p packages/risk/tsconfig.json
bunx tsc --noEmit -p packages/websocket/tsconfig.json
bunx tsc --noEmit -p packages/runtime/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p apps/workers/tsconfig.json
docker compose config
git diff --check
```

## Run Local Backend

```bash
bun run apps/api/src/index.ts
```

The API process runs the matching and persistence workers in-process by default
so the local backend is functional without extra services. This keeps the
learning setup simple. The stream abstraction mirrors Redis Streams closely
enough that a Redis adapter can replace the in-memory stream bus for a
multi-process deployment.

## Documentation

```text
docs/ARCHITECTURE.md
docs/API.md
docs/WEBSOCKETS.md
docs/RECOVERY.md
docs/TESTING.md
```

## Phase Status

- Phase 1: Core matching engine implemented.
- Phase 2: Persistence schema and event persistence contracts implemented.
- Phase 3: Positions and cross-margin implemented.
- Phase 4: Funding implemented.
- Phase 5: Liquidation, insurance fund, and simplified ADL implemented.
- Phase 6: WebSocket subscriptions and fanout implemented.
- Phase 7: Snapshots and recovery implemented.
- Phase 8: Documentation, runtime wiring, and verification pass implemented.
