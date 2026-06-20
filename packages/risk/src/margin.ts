import { calculateUnrealizedPnl, positionNotional } from "./position-engine";
import type {
  AccountState,
  MarkPrice,
  MarginSummary,
  MarketRiskConfig,
  OpenOrderRisk,
  OrderMarginCheck,
  Position,
} from "./types";

export function calculateMarginSummary(
  account: AccountState,
  markets: MarketRiskConfig[],
  markPrices: MarkPrice[],
): MarginSummary {
  const marketById = indexMarkets(markets);
  const markPriceByMarket = indexMarkPrices(markPrices);

  let unrealizedPnl = 0;
  let initialMargin = 0;
  let maintenanceMargin = 0;

  for (const position of account.positions) {
    if (position.quantity === 0) {
      continue;
    }

    const market = requireMarket(marketById, position.marketId);
    const markPrice = requireMarkPrice(markPriceByMarket, position.marketId);
    const notional = positionNotional(position, markPrice);

    unrealizedPnl += calculateUnrealizedPnl(position, markPrice);
    initialMargin += notional / position.leverage;
    maintenanceMargin += notional * market.maintenanceMarginRate;
  }

  const openOrderInitialMargin = account.openOrders.reduce(
    (sum, order) => sum + initialMarginForOpenOrder(order, marketById),
    0,
  );
  const openOrderFees = account.openOrders.reduce(
    (sum, order) => sum + estimatedFeeForOpenOrder(order),
    0,
  );
  const accountEquity = account.walletBalance + unrealizedPnl;
  const availableMargin =
    accountEquity - initialMargin - openOrderInitialMargin - openOrderFees;

  return {
    userId: account.userId,
    collateralAsset: account.collateralAsset,
    walletBalance: roundFinancial(account.walletBalance),
    unrealizedPnl: roundFinancial(unrealizedPnl),
    accountEquity: roundFinancial(accountEquity),
    initialMargin: roundFinancial(initialMargin),
    maintenanceMargin: roundFinancial(maintenanceMargin),
    openOrderInitialMargin: roundFinancial(openOrderInitialMargin),
    openOrderFees: roundFinancial(openOrderFees),
    availableMargin: roundFinancial(availableMargin),
    marginRatio:
      maintenanceMargin === 0
        ? null
        : roundFinancial(accountEquity / maintenanceMargin),
  };
}

export function checkOrderMargin(
  account: AccountState,
  order: OpenOrderRisk,
  markets: MarketRiskConfig[],
  markPrices: MarkPrice[],
): OrderMarginCheck {
  const market = markets.find((candidate) => candidate.marketId === order.marketId);

  if (!market) {
    return {
      ok: false,
      requiredInitialMargin: 0,
      requiredFee: 0,
      availableMargin: 0,
      reason: "UNKNOWN_MARKET",
    };
  }

  if (
    !Number.isInteger(order.leverage) ||
    order.leverage < 1 ||
    order.leverage > market.maxLeverage
  ) {
    return {
      ok: false,
      requiredInitialMargin: 0,
      requiredFee: 0,
      availableMargin: calculateMarginSummary(account, markets, markPrices)
        .availableMargin,
      reason: "INVALID_LEVERAGE",
    };
  }

  const summary = calculateMarginSummary(account, markets, markPrices);
  const requiredInitialMargin = initialMarginForOpenOrder(order, new Map([[market.marketId, market]]));
  const requiredFee = estimatedFeeForOpenOrder(order);
  const required = requiredInitialMargin + requiredFee;
  const ok = order.reduceOnly || summary.availableMargin >= required;

  return {
    ok,
    requiredInitialMargin: roundFinancial(requiredInitialMargin),
    requiredFee: roundFinancial(requiredFee),
    availableMargin: summary.availableMargin,
    reason: ok ? undefined : "INSUFFICIENT_MARGIN",
  };
}

export function isMaintenanceMarginViolated(
  account: AccountState,
  markets: MarketRiskConfig[],
  markPrices: MarkPrice[],
): boolean {
  const summary = calculateMarginSummary(account, markets, markPrices);

  return (
    summary.maintenanceMargin > 0 &&
    summary.accountEquity <= summary.maintenanceMargin
  );
}

function initialMarginForOpenOrder(
  order: OpenOrderRisk,
  marketById: Map<string, MarketRiskConfig>,
): number {
  if (order.reduceOnly) {
    return 0;
  }

  const market = requireMarket(marketById, order.marketId);
  const leverage = Math.min(order.leverage, market.maxLeverage);

  return (order.price * order.quantity) / leverage;
}

function estimatedFeeForOpenOrder(order: OpenOrderRisk): number {
  if (order.reduceOnly) {
    return 0;
  }

  return order.price * order.quantity * order.estimatedFeeRate;
}

function requireMarket(
  marketById: Map<string, MarketRiskConfig>,
  marketId: string,
): MarketRiskConfig {
  const market = marketById.get(marketId);

  if (!market) {
    throw new Error(`Unknown market: ${marketId}`);
  }

  return market;
}

function requireMarkPrice(
  markPriceByMarket: Map<string, number>,
  marketId: string,
): number {
  const price = markPriceByMarket.get(marketId);

  if (price == null) {
    throw new Error(`Missing mark price for market: ${marketId}`);
  }

  return price;
}

function indexMarkets(markets: MarketRiskConfig[]): Map<string, MarketRiskConfig> {
  return new Map(markets.map((market) => [market.marketId, market]));
}

function indexMarkPrices(markPrices: MarkPrice[]): Map<string, number> {
  return new Map(markPrices.map((markPrice) => [markPrice.marketId, markPrice.price]));
}

function roundFinancial(value: number): number {
  return Number(value.toFixed(12));
}
