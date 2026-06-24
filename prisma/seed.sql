INSERT INTO "markets" (
  "id",
  "symbol",
  "baseAsset",
  "quoteAsset",
  "tickSize",
  "lotSize",
  "maxLeverage",
  "initialMarginRate",
  "maintenanceMarginRate",
  "makerFeeRate",
  "takerFeeRate",
  "fundingIntervalHours",
  "fundingRateCap",
  "status",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'BTC-PERP',
    'BTC-PERP',
    'BTC',
    'USDC',
    0.100000000000000000,
    0.001000000000000000,
    20,
    0.050000000000000000,
    0.005000000000000000,
    0.000200000000000000,
    0.000500000000000000,
    8,
    0.003750000000000000,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ETH-PERP',
    'ETH-PERP',
    'ETH',
    'USDC',
    0.010000000000000000,
    0.010000000000000000,
    20,
    0.050000000000000000,
    0.005000000000000000,
    0.000200000000000000,
    0.000500000000000000,
    8,
    0.003750000000000000,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "symbol" = EXCLUDED."symbol",
  "baseAsset" = EXCLUDED."baseAsset",
  "quoteAsset" = EXCLUDED."quoteAsset",
  "tickSize" = EXCLUDED."tickSize",
  "lotSize" = EXCLUDED."lotSize",
  "maxLeverage" = EXCLUDED."maxLeverage",
  "initialMarginRate" = EXCLUDED."initialMarginRate",
  "maintenanceMarginRate" = EXCLUDED."maintenanceMarginRate",
  "makerFeeRate" = EXCLUDED."makerFeeRate",
  "takerFeeRate" = EXCLUDED."takerFeeRate",
  "fundingIntervalHours" = EXCLUDED."fundingIntervalHours",
  "fundingRateCap" = EXCLUDED."fundingRateCap",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "insurance_funds" ("id", "asset", "balance", "updatedAt")
VALUES ('insurance-fund-usdc', 'USDC', 1000000.000000000000000000, CURRENT_TIMESTAMP)
ON CONFLICT ("asset") DO UPDATE SET
  "balance" = EXCLUDED."balance",
  "updatedAt" = CURRENT_TIMESTAMP;


