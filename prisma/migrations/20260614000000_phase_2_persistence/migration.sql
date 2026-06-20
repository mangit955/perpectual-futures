CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "MarketStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SETTLEMENT_ONLY');
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');
CREATE TYPE "TimeInForce" AS ENUM ('GTC', 'IOC');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED');
CREATE TYPE "LiquidityRole" AS ENUM ('MAKER', 'TAKER');
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT', 'FLAT');
CREATE TYPE "LedgerEntryType" AS ENUM (
  'DEPOSIT',
  'TRADING_FEE',
  'REALIZED_PNL',
  'FUNDING_PAYMENT',
  'LIQUIDATION_LOSS',
  'INSURANCE_FUND_TRANSFER',
  'INSURANCE_FUND_CREDIT',
  'ADL_SETTLEMENT'
);
CREATE TYPE "LiquidationStatus" AS ENUM ('TRIGGERED', 'LIQUIDATING', 'CLOSED', 'INSURANCE_FUND_USED', 'ADL_USED', 'FAILED');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "markets" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "baseAsset" TEXT NOT NULL,
  "quoteAsset" TEXT NOT NULL,
  "tickSize" DECIMAL(36, 18) NOT NULL,
  "lotSize" DECIMAL(36, 18) NOT NULL,
  "maxLeverage" INTEGER NOT NULL,
  "initialMarginRate" DECIMAL(36, 18) NOT NULL,
  "maintenanceMarginRate" DECIMAL(36, 18) NOT NULL,
  "makerFeeRate" DECIMAL(36, 18) NOT NULL,
  "takerFeeRate" DECIMAL(36, 18) NOT NULL,
  "fundingIntervalHours" INTEGER NOT NULL DEFAULT 8,
  "fundingRateCap" DECIMAL(36, 18) NOT NULL,
  "status" "MarketStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "balances" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "total" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "locked" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "asset" TEXT NOT NULL,
  "type" "LedgerEntryType" NOT NULL,
  "amount" DECIMAL(36, 18) NOT NULL,
  "balanceAfter" DECIMAL(36, 18),
  "referenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "clientOrderId" TEXT,
  "userId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "side" "OrderSide" NOT NULL,
  "type" "OrderType" NOT NULL,
  "timeInForce" "TimeInForce" NOT NULL,
  "price" DECIMAL(36, 18),
  "quantity" DECIMAL(36, 18) NOT NULL,
  "remainingQuantity" DECIMAL(36, 18) NOT NULL,
  "reduceOnly" BOOLEAN NOT NULL DEFAULT false,
  "postOnly" BOOLEAN NOT NULL DEFAULT false,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fills" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "side" "OrderSide" NOT NULL,
  "liquidityRole" "LiquidityRole" NOT NULL,
  "price" DECIMAL(36, 18) NOT NULL,
  "quantity" DECIMAL(36, 18) NOT NULL,
  "notional" DECIMAL(36, 18) NOT NULL,
  "fee" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "realizedPnl" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "positions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "side" "PositionSide" NOT NULL DEFAULT 'FLAT',
  "quantity" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "entryPrice" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "realizedPnl" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "unrealizedPnl" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "leverage" INTEGER NOT NULL DEFAULT 1,
  "liquidationPrice" DECIMAL(36, 18),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "funding_payments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "positionQuantity" DECIMAL(36, 18) NOT NULL,
  "markPrice" DECIMAL(36, 18) NOT NULL,
  "indexPrice" DECIMAL(36, 18) NOT NULL,
  "fundingRate" DECIMAL(36, 18) NOT NULL,
  "paymentAmount" DECIMAL(36, 18) NOT NULL,
  "fundingTime" TIMESTAMP(3) NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funding_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "liquidations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "positionQuantity" DECIMAL(36, 18) NOT NULL,
  "markPrice" DECIMAL(36, 18) NOT NULL,
  "maintenanceMargin" DECIMAL(36, 18) NOT NULL,
  "accountEquity" DECIMAL(36, 18) NOT NULL,
  "status" "LiquidationStatus" NOT NULL,
  "insuranceFundUsed" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "adlUsed" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "liquidations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insurance_funds" (
  "id" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "balance" DECIMAL(36, 18) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insurance_funds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processed_events" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "stream" TEXT,
  "streamId" TEXT,
  "marketId" TEXT,
  "raw" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_events_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "snapshot_metadata" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "snapshotPath" TEXT NOT NULL,
  "engineSequence" BIGINT NOT NULL,
  "lastRedisStreamId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "snapshot_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");
CREATE UNIQUE INDEX "markets_symbol_key" ON "markets"("symbol");
CREATE UNIQUE INDEX "balances_userId_asset_key" ON "balances"("userId", "asset");
CREATE INDEX "ledger_entries_userId_createdAt_idx" ON "ledger_entries"("userId", "createdAt");
CREATE INDEX "ledger_entries_referenceId_idx" ON "ledger_entries"("referenceId");
CREATE UNIQUE INDEX "orders_userId_clientOrderId_key" ON "orders"("userId", "clientOrderId");
CREATE INDEX "orders_userId_marketId_createdAt_idx" ON "orders"("userId", "marketId", "createdAt");
CREATE INDEX "orders_marketId_status_idx" ON "orders"("marketId", "status");
CREATE UNIQUE INDEX "fills_tradeId_orderId_key" ON "fills"("tradeId", "orderId");
CREATE INDEX "fills_userId_marketId_createdAt_idx" ON "fills"("userId", "marketId", "createdAt");
CREATE INDEX "fills_eventId_idx" ON "fills"("eventId");
CREATE UNIQUE INDEX "positions_userId_marketId_key" ON "positions"("userId", "marketId");
CREATE UNIQUE INDEX "funding_payments_eventId_key" ON "funding_payments"("eventId");
CREATE INDEX "funding_payments_marketId_fundingTime_idx" ON "funding_payments"("marketId", "fundingTime");
CREATE UNIQUE INDEX "liquidations_eventId_key" ON "liquidations"("eventId");
CREATE INDEX "liquidations_userId_createdAt_idx" ON "liquidations"("userId", "createdAt");
CREATE UNIQUE INDEX "insurance_funds_asset_key" ON "insurance_funds"("asset");
CREATE INDEX "processed_events_marketId_processedAt_idx" ON "processed_events"("marketId", "processedAt");
CREATE INDEX "outbox_events_status_createdAt_idx" ON "outbox_events"("status", "createdAt");
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");
CREATE INDEX "snapshot_metadata_marketId_createdAt_idx" ON "snapshot_metadata"("marketId", "createdAt");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "balances" ADD CONSTRAINT "balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fills" ADD CONSTRAINT "fills_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fills" ADD CONSTRAINT "fills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fills" ADD CONSTRAINT "fills_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "funding_payments" ADD CONSTRAINT "funding_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "funding_payments" ADD CONSTRAINT "funding_payments_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snapshot_metadata" ADD CONSTRAINT "snapshot_metadata_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
