import { describe, expect, it } from "bun:test";
import {
  applyFundingPayments,
  calculateFundingRate,
  calculatePremiumIndex,
  createFundingExecution,
  nextFundingTime,
  shouldExecuteFunding,
} from "./funding";
import type { Balance, FundingMarketConfig, Position } from "./types";

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const FUNDING_TIME = 1_700_000_000_000;

const market: FundingMarketConfig = {
  marketId: "BTC-PERP",
  fundingIntervalHours: 8,
  fundingRateCap: 0.00375,
};

describe("funding calculations", () => {
  it("calculates premium index from mark and index prices", () => {
    expect(calculatePremiumIndex(101, 100)).toBe(0.01);
    expect(calculatePremiumIndex(99, 100)).toBe(-0.01);
  });

  it("caps funding rate in both directions", () => {
    expect(calculateFundingRate(0.01, market.fundingRateCap)).toBe(0.00375);
    expect(calculateFundingRate(-0.01, market.fundingRateCap)).toBe(-0.00375);
    expect(calculateFundingRate(0.001, market.fundingRateCap)).toBe(0.001);
  });

  it("runs when the funding interval is due", () => {
    expect(shouldExecuteFunding(FUNDING_TIME, null, 8)).toBe(true);
    expect(
      shouldExecuteFunding(FUNDING_TIME, FUNDING_TIME - EIGHT_HOURS_MS, 8),
    ).toBe(true);
    expect(
      shouldExecuteFunding(FUNDING_TIME, FUNDING_TIME - EIGHT_HOURS_MS + 1, 8),
    ).toBe(false);
    expect(nextFundingTime(FUNDING_TIME, 8)).toBe(
      FUNDING_TIME + EIGHT_HOURS_MS,
    );
  });
});

describe("funding execution", () => {
  it("creates positive funding payments where longs pay shorts", () => {
    const execution = createFundingExecution({
      market,
      eventId: "funding-1",
      price: {
        marketId: market.marketId,
        markPrice: 101,
        indexPrice: 100,
        timestamp: FUNDING_TIME,
      },
      positions: [
        position({ userId: "long", quantity: 2 }),
        position({ userId: "short", quantity: -2 }),
        position({ userId: "flat", quantity: 0 }),
      ],
    });

    expect(execution).toMatchObject({
      eventId: "funding-1",
      marketId: "BTC-PERP",
      markPrice: 101,
      indexPrice: 100,
      premiumIndex: 0.01,
      fundingRate: 0.00375,
      fundingTime: FUNDING_TIME,
    });
    expect(execution.payments).toHaveLength(2);
    expect(execution.payments[0]).toMatchObject({
      id: "funding-1:long:BTC-PERP",
      userId: "long",
      positionQuantity: 2,
      paymentAmount: -0.7575,
    });
    expect(execution.payments[1]).toMatchObject({
      id: "funding-1:short:BTC-PERP",
      userId: "short",
      positionQuantity: -2,
      paymentAmount: 0.7575,
    });
    expect(
      execution.payments.reduce((sum, payment) => sum + payment.paymentAmount, 0),
    ).toBe(0);
  });

  it("creates negative funding payments where shorts pay longs", () => {
    const execution = createFundingExecution({
      market,
      eventId: "funding-2",
      price: {
        marketId: market.marketId,
        markPrice: 99,
        indexPrice: 100,
        timestamp: FUNDING_TIME,
      },
      positions: [
        position({ userId: "long", quantity: 1 }),
        position({ userId: "short", quantity: -1 }),
      ],
    });

    expect(execution.fundingRate).toBe(-0.00375);
    expect(execution.payments[0]).toMatchObject({
      userId: "long",
      paymentAmount: 0.37125,
    });
    expect(execution.payments[1]).toMatchObject({
      userId: "short",
      paymentAmount: -0.37125,
    });
  });

  it("applies funding payments to collateral balances with ledger entries", () => {
    const execution = createFundingExecution({
      market,
      eventId: "funding-3",
      price: {
        marketId: market.marketId,
        markPrice: 101,
        indexPrice: 100,
        timestamp: FUNDING_TIME,
      },
      positions: [
        position({ userId: "long", quantity: 2 }),
        position({ userId: "short", quantity: -2 }),
      ],
    });

    const result = applyFundingPayments({
      collateralAsset: "USDC",
      balances: [
        balance({ userId: "long", total: 100 }),
        balance({ userId: "short", total: 100 }),
      ],
      payments: execution.payments,
      createdAt: FUNDING_TIME,
    });

    expect(result.balances).toEqual([
      balance({ userId: "long", total: 99.2425 }),
      balance({ userId: "short", total: 100.7575 }),
    ]);
    expect(result.ledgerEntries).toMatchObject([
      {
        id: "funding-3:long:BTC-PERP:ledger",
        userId: "long",
        type: "FUNDING_PAYMENT",
        amount: -0.7575,
        balanceAfter: 99.2425,
      },
      {
        id: "funding-3:short:BTC-PERP:ledger",
        userId: "short",
        type: "FUNDING_PAYMENT",
        amount: 0.7575,
        balanceAfter: 100.7575,
      },
    ]);
  });
});

function position(overrides: Partial<Position>): Position {
  return {
    userId: overrides.userId ?? "user-1",
    marketId: overrides.marketId ?? market.marketId,
    quantity: overrides.quantity ?? 0,
    entryPrice: overrides.entryPrice ?? 100,
    realizedPnl: overrides.realizedPnl ?? 0,
    leverage: overrides.leverage ?? 10,
  };
}

function balance(overrides: Partial<Balance>): Balance {
  return {
    userId: overrides.userId ?? "user-1",
    asset: overrides.asset ?? "USDC",
    total: overrides.total ?? 0,
    locked: overrides.locked ?? 0,
  };
}
