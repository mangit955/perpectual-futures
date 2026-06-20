# db

Phase 2 persistence package.

This package owns the durable persistence contracts for the exchange backend:

- Prisma schema lives at `../../prisma/schema.prisma`.
- Initial SQL migration lives under `../../prisma/migrations`.
- Seed data lives at `../../prisma/seed.sql`.
- `PersistenceService` applies matching-engine events inside one transaction.
- `PrismaPersistenceStore` adapts the service to a generated Prisma Client.
- `InMemoryPersistenceStore` keeps unit tests fast and deterministic.

## Local Database

```bash
docker compose up -d postgres redis
```

After Prisma dependencies are installed:

```bash
bun run prisma:generate
bun run prisma:migrate
bun run db:seed
```

## Idempotency

Every engine event is persisted with a `processed_events` row in the same
transaction as the order and fill writes. If Redis redelivers a message after a
worker restart, the persistence service sees the existing `eventId` and skips
the event.

Fills use deterministic IDs:

```text
{tradeId}:maker
{tradeId}:taker
```

That gives the database a second line of defense against duplicate execution
records.
