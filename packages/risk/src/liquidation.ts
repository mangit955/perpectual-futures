import { calculateMarginSummary } from "./margin";
import { calculateUnrealizedPnl, positionNotional } from "./position-engine";
import type {
  AccountState,
  AdlAction,
  AdlCandidate,
  DeficitSettlement,
  InsuranceFund,
  InsuranceFundUsage,
  LiquidationOrder,
  LiquidationTrigger,
  MarkPrice,
  MarketRiskConfig,
  Position,
  TradeSide,
} from "./types";

export interface CreateLiquidationTriggerInput {
  eventId: string;
  account: AccountState;
  markets: MarketRiskConfig[];
  markPrices: MarkPrice[];
  createdAt: number;
  slippageBufferRate?: number;
}

export interface SettleDeficitInput {
  asset: string;
  deficit: number;
  insuranceFund: InsuranceFund;
  liquidatedPosition: Position;
  markPrice: number;
  adlCandidates: AdlCandidate[];
}

export function createLiquidationTriggers(
  input: CreateLiquidationTriggerInput,
): LiquidationTrigger[] {
  const summary = calculateMarginSummary(
    input.account,
    input.markets,
    input.markPrices,
  );

  if (
    summary.maintenanceMargin === 0 ||
    summary.accountEquity > summary.maintenanceMargin
  ) {
    return [];
  }

  const triggers: LiquidationTrigger[] = [];

  for (const position of input.account.positions) {
    if (position.quantity === 0) {
      continue;
    }

    const market = requireMarket(input.markets, position.marketId);
    const markPrice = requireMarkPrice(input.markPrices, position.marketId);
    const notional = positionNotional(position, markPrice);
    const maintenanceMargin = notional * market.maintenanceMarginRate;

    triggers.push({
      eventId: `${input.eventId}:${position.marketId}`,
      userId: input.account.userId,
      marketId: position.marketId,
      positionQuantity: position.quantity,
      markPrice,
      maintenanceMargin: roundFinancial(maintenanceMargin),
      accountEquity: summary.accountEquity,
      status: "TRIGGERED",
      order: createLiquidationOrder({
        eventId: input.eventId,
        userId: input.account.userId,
        position,
        markPrice,
        slippageBufferRate: input.slippageBufferRate ?? 0.005,
      }),
      createdAt: input.createdAt,
    });
  }

  return triggers;
}

export function createLiquidationOrder(input: {
  eventId: string;
  userId: string;
  position: Position;
  markPrice: number;
  slippageBufferRate: number;
}): LiquidationOrder {
  if (input.position.quantity === 0) {
    throw new Error("cannot liquidate a flat position");
  }

  const side: TradeSide = input.position.quantity > 0 ? "SELL" : "BUY";
  const priceMultiplier =
    side === "SELL"
      ? 1 - input.slippageBufferRate
      : 1 + input.slippageBufferRate;

  return {
    orderId: `${input.eventId}:${input.position.marketId}:liquidation-order`,
    userId: input.userId,
    marketId: input.position.marketId,
    side,
    quantity: Math.abs(input.position.quantity),
    limitPrice: roundFinancial(input.markPrice * priceMultiplier),
    reduceOnly: true,
  };
}

export function useInsuranceFund(
  fund: InsuranceFund,
  requestedDeficit: number,
): InsuranceFundUsage {
  assertNonNegative(requestedDeficit, "requested deficit");

  const used = Math.min(fund.balance, requestedDeficit);
  const remainingDeficit = requestedDeficit - used;

  return {
    asset: fund.asset,
    requested: roundFinancial(requestedDeficit),
    used: roundFinancial(used),
    remainingDeficit: roundFinancial(remainingDeficit),
    nextFundBalance: roundFinancial(fund.balance - used),
  };
}

export function settleLiquidationDeficit(
  input: SettleDeficitInput,
): DeficitSettlement {
  if (input.asset !== input.insuranceFund.asset) {
    throw new Error(
      `insurance fund asset ${input.insuranceFund.asset} does not match ${input.asset}`,
    );
  }

  const insuranceFund = useInsuranceFund(input.insuranceFund, input.deficit);

  if (insuranceFund.remainingDeficit === 0) {
    return {
      insuranceFund,
      adlActions: [],
      unresolvedDeficit: 0,
      status: "INSURANCE_FUND_USED",
    };
  }

  const adlQuantity = insuranceFund.remainingDeficit / input.markPrice;
  const adlActions = createAdlActions({
    liquidatedPosition: input.liquidatedPosition,
    markPrice: input.markPrice,
    quantityToReduce: adlQuantity,
    candidates: input.adlCandidates,
  });
  const coveredByAdl = adlActions.reduce(
    (sum, action) => sum + action.quantity * action.price,
    0,
  );
  const unresolvedDeficit = Math.max(
    0,
    insuranceFund.remainingDeficit - coveredByAdl,
  );

  return {
    insuranceFund,
    adlActions,
    unresolvedDeficit: roundFinancial(unresolvedDeficit),
    status: unresolvedDeficit === 0 ? "ADL_USED" : "FAILED",
  };
}

export function createAdlActions(input: {
  liquidatedPosition: Position;
  markPrice: number;
  quantityToReduce: number;
  candidates: AdlCandidate[];
}): AdlAction[] {
  assertNonNegative(input.quantityToReduce, "ADL quantity");

  if (input.liquidatedPosition.quantity === 0 || input.quantityToReduce === 0) {
    return [];
  }

  const requiredOppositeSign = -Math.sign(input.liquidatedPosition.quantity);
  const rankedCandidates = input.candidates
    .filter(
      (candidate) =>
        candidate.position.marketId === input.liquidatedPosition.marketId &&
        Math.sign(candidate.position.quantity) === requiredOppositeSign,
    )
    .map((candidate) => ({
      candidate,
      score: calculateAdlScore(candidate),
    }))
    .sort((a, b) => b.score - a.score);

  const actions: AdlAction[] = [];
  let remainingQuantity = input.quantityToReduce;

  for (const ranked of rankedCandidates) {
    if (remainingQuantity <= 0) {
      break;
    }

    const reducibleQuantity = Math.min(
      Math.abs(ranked.candidate.position.quantity),
      remainingQuantity,
    );

    if (reducibleQuantity <= 0) {
      continue;
    }

    actions.push({
      userId: ranked.candidate.userId,
      marketId: ranked.candidate.position.marketId,
      side: ranked.candidate.position.quantity > 0 ? "SELL" : "BUY",
      quantity: roundFinancial(reducibleQuantity),
      price: input.markPrice,
      score: roundFinancial(ranked.score),
    });

    remainingQuantity -= reducibleQuantity;
  }

  return actions;
}

export function calculateAdlScore(candidate: AdlCandidate): number {
  const notional = positionNotional(candidate.position, candidate.markPrice);

  if (notional === 0) {
    return 0;
  }

  const unrealizedPnl = calculateUnrealizedPnl(
    candidate.position,
    candidate.markPrice,
  );
  const pnlPercent = unrealizedPnl / Math.abs(
    candidate.position.entryPrice * candidate.position.quantity,
  );
  const equityFloor = Math.max(candidate.accountEquity, 1e-9);
  const effectiveLeverage = notional / equityFloor;

  return roundFinancial(pnlPercent * effectiveLeverage);
}

function requireMarket(
  markets: MarketRiskConfig[],
  marketId: string,
): MarketRiskConfig {
  const market = markets.find((candidate) => candidate.marketId === marketId);

  if (!market) {
    throw new Error(`Unknown market: ${marketId}`);
  }

  return market;
}

function requireMarkPrice(markPrices: MarkPrice[], marketId: string): number {
  const markPrice = markPrices.find(
    (candidate) => candidate.marketId === marketId,
  );

  if (!markPrice) {
    throw new Error(`Missing mark price for market: ${marketId}`);
  }

  return markPrice.price;
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
}

function roundFinancial(value: number): number {
  return Number(value.toFixed(12));
}
