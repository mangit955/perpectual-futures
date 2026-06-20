import type {
  Balance,
  FundingExecution,
  FundingMarketConfig,
  FundingPayment,
  FundingPriceInput,
  LedgerEntry,
  Position,
} from "./types";
import { applyLedgerEntry } from "./ledger";

export interface CreateFundingExecutionInput {
  market: FundingMarketConfig;
  price: FundingPriceInput;
  positions: Position[];
  eventId: string;
}

export interface ApplyFundingPaymentsInput {
  collateralAsset: string;
  balances: Balance[];
  payments: FundingPayment[];
  createdAt: number;
}

export interface ApplyFundingPaymentsResult {
  balances: Balance[];
  ledgerEntries: LedgerEntry[];
}

export function calculatePremiumIndex(
  markPrice: number,
  indexPrice: number,
): number {
  assertPositive(markPrice, "mark price");
  assertPositive(indexPrice, "index price");

  return roundFinancial((markPrice - indexPrice) / indexPrice);
}

export function calculateFundingRate(
  premiumIndex: number,
  fundingRateCap: number,
): number {
  assertNonNegative(fundingRateCap, "funding rate cap");

  return roundFinancial(clamp(premiumIndex, -fundingRateCap, fundingRateCap));
}

export function shouldExecuteFunding(
  now: number,
  lastFundingTime: number | null,
  fundingIntervalHours: number,
): boolean {
  assertPositive(fundingIntervalHours, "funding interval hours");

  if (lastFundingTime == null) {
    return true;
  }

  const intervalMs = fundingIntervalHours * 60 * 60 * 1000;
  return now - lastFundingTime >= intervalMs;
}

export function nextFundingTime(
  lastFundingTime: number,
  fundingIntervalHours: number,
): number {
  assertPositive(fundingIntervalHours, "funding interval hours");

  return lastFundingTime + fundingIntervalHours * 60 * 60 * 1000;
}

export function createFundingExecution(
  input: CreateFundingExecutionInput,
): FundingExecution {
  if (input.market.marketId !== input.price.marketId) {
    throw new Error(
      `funding price market ${input.price.marketId} does not match ${input.market.marketId}`,
    );
  }

  const premiumIndex = calculatePremiumIndex(
    input.price.markPrice,
    input.price.indexPrice,
  );
  const fundingRate = calculateFundingRate(
    premiumIndex,
    input.market.fundingRateCap,
  );
  const activePositions = input.positions.filter(
    (position) =>
      position.marketId === input.market.marketId && position.quantity !== 0,
  );
  const payments = activePositions.map((position) =>
    createFundingPayment({
      position,
      eventId: input.eventId,
      markPrice: input.price.markPrice,
      indexPrice: input.price.indexPrice,
      fundingRate,
      fundingTime: input.price.timestamp,
    }),
  );

  return {
    eventId: input.eventId,
    marketId: input.market.marketId,
    markPrice: input.price.markPrice,
    indexPrice: input.price.indexPrice,
    premiumIndex,
    fundingRate,
    fundingTime: input.price.timestamp,
    payments,
  };
}

export function applyFundingPayments(
  input: ApplyFundingPaymentsInput,
): ApplyFundingPaymentsResult {
  const balancesByUser = new Map(
    input.balances.map((balance) => [balance.userId, { ...balance }]),
  );
  const ledgerEntries: LedgerEntry[] = [];

  for (const payment of input.payments) {
    const balance = balancesByUser.get(payment.userId);

    if (!balance) {
      throw new Error(`Missing ${input.collateralAsset} balance for ${payment.userId}`);
    }

    if (balance.asset !== input.collateralAsset) {
      throw new Error(
        `Expected ${input.collateralAsset} balance for ${payment.userId}`,
      );
    }

    const result = applyLedgerEntry({
      id: `${payment.id}:ledger`,
      balance,
      type: "FUNDING_PAYMENT",
      amount: payment.paymentAmount,
      referenceId: payment.id,
      createdAt: input.createdAt,
    });

    balancesByUser.set(payment.userId, result.balance);
    ledgerEntries.push(result.entry);
  }

  return {
    balances: [...balancesByUser.values()],
    ledgerEntries,
  };
}

function createFundingPayment(input: {
  position: Position;
  eventId: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  fundingTime: number;
}): FundingPayment {
  const paymentAmount = roundFinancial(
    -input.position.quantity * input.markPrice * input.fundingRate,
  );

  return {
    id: `${input.eventId}:${input.position.userId}:${input.position.marketId}`,
    eventId: input.eventId,
    userId: input.position.userId,
    marketId: input.position.marketId,
    positionQuantity: input.position.quantity,
    markPrice: input.markPrice,
    indexPrice: input.indexPrice,
    fundingRate: input.fundingRate,
    paymentAmount,
    fundingTime: input.fundingTime,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
}

function roundFinancial(value: number): number {
  return Number(value.toFixed(12));
}
