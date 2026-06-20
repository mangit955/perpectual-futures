import { describe, expect, it } from "bun:test";
import {
  calculateMarginSummary,
  checkOrderMargin,
  isMaintenanceMarginViolated,
} from "./margin";
import type {
  AccountState,
  MarketRiskConfig,
  OpenOrderRisk,
  Position,
} from "./types";

const market: MarketRiskConfig = {
  marketId: "BTC-PERP",
  tickSize: 0.1,
  lotSize: 0.001,
  maxLeverage: 20,
  initialMarginRate: 0.05,
  maintenanceMarginRate: 0.005,
  makerFeeRate: 0.0002,
  takerFeeRate: 0.0005,
};

describe("cross-margin summary", () => {
  it("calculates account equity, position margin, open-order margin, and fees", () => {
    const summary = calculateMarginSummary(
      account({
        walletBalance: 1_000,
        positions: [
          position({
            quantity: 2,
            entryPrice: 100,
            leverage: 10,
          }),
        ],
        openOrders: [
          order({
            price: 110,
            quantity: 1,
            leverage: 10,
            estimatedFeeRate: market.takerFeeRate,
          }),
        ],
      }),
      [market],
      [{ marketId: market.marketId, price: 120 }],
    );

    expect(summary).toMatchObject({
      walletBalance: 1000,
      unrealizedPnl: 40,
      accountEquity: 1040,
      initialMargin: 24,
      maintenanceMargin: 1.2,
      openOrderInitialMargin: 11,
      openOrderFees: 0.055,
      availableMargin: 1004.945,
    });
    expect(summary.marginRatio).toBeCloseTo(866.666666666667, 9);
  });

  it("passes a sufficient-margin order check", () => {
    const check = checkOrderMargin(
      account({ walletBalance: 1_000 }),
      order({
        price: 100,
        quantity: 5,
        leverage: 10,
        estimatedFeeRate: market.takerFeeRate,
      }),
      [market],
      [{ marketId: market.marketId, price: 100 }],
    );

    expect(check).toEqual({
      ok: true,
      requiredInitialMargin: 50,
      requiredFee: 0.25,
      availableMargin: 1000,
    });
  });

  it("rejects an insufficient-margin order check", () => {
    const check = checkOrderMargin(
      account({ walletBalance: 10 }),
      order({
        price: 100,
        quantity: 5,
        leverage: 10,
        estimatedFeeRate: market.takerFeeRate,
      }),
      [market],
      [{ marketId: market.marketId, price: 100 }],
    );

    expect(check).toEqual({
      ok: false,
      requiredInitialMargin: 50,
      requiredFee: 0.25,
      availableMargin: 10,
      reason: "INSUFFICIENT_MARGIN",
    });
  });

  it("does not reserve new margin for reduce-only orders", () => {
    const check = checkOrderMargin(
      account({ walletBalance: 0 }),
      order({
        price: 100,
        quantity: 100,
        leverage: 10,
        reduceOnly: true,
        estimatedFeeRate: market.takerFeeRate,
      }),
      [market],
      [{ marketId: market.marketId, price: 100 }],
    );

    expect(check).toEqual({
      ok: true,
      requiredInitialMargin: 0,
      requiredFee: 0,
      availableMargin: 0,
    });
  });

  it("rejects leverage above the market maximum", () => {
    const check = checkOrderMargin(
      account({ walletBalance: 1_000 }),
      order({
        price: 100,
        quantity: 1,
        leverage: 100,
        estimatedFeeRate: market.takerFeeRate,
      }),
      [market],
      [{ marketId: market.marketId, price: 100 }],
    );

    expect(check).toMatchObject({
      ok: false,
      reason: "INVALID_LEVERAGE",
      availableMargin: 1000,
    });
  });

  it("detects maintenance margin violation for later liquidation handling", () => {
    const violated = isMaintenanceMarginViolated(
      account({
        walletBalance: 5,
        positions: [
          position({
            quantity: 1,
            entryPrice: 100,
            leverage: 10,
          }),
        ],
      }),
      [market],
      [{ marketId: market.marketId, price: 94 }],
    );

    expect(violated).toBe(true);
  });
});

function account(overrides: Partial<AccountState> = {}): AccountState {
  return {
    userId: "user-1",
    collateralAsset: "USDC",
    walletBalance: overrides.walletBalance ?? 1_000,
    positions: overrides.positions ?? [],
    openOrders: overrides.openOrders ?? [],
  };
}

function position(overrides: Partial<Position> = {}): Position {
  return {
    userId: "user-1",
    marketId: market.marketId,
    quantity: overrides.quantity ?? 0,
    entryPrice: overrides.entryPrice ?? 0,
    realizedPnl: overrides.realizedPnl ?? 0,
    leverage: overrides.leverage ?? 10,
  };
}

function order(overrides: Partial<OpenOrderRisk> = {}): OpenOrderRisk {
  return {
    marketId: market.marketId,
    side: overrides.side ?? "BUY",
    price: overrides.price ?? 100,
    quantity: overrides.quantity ?? 1,
    reduceOnly: overrides.reduceOnly ?? false,
    estimatedFeeRate: overrides.estimatedFeeRate ?? market.takerFeeRate,
    leverage: overrides.leverage ?? 10,
  };
}
