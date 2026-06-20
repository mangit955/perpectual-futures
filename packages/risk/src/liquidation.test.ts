import { describe, expect, it } from "bun:test";
import {
  calculateAdlScore,
  createAdlActions,
  createLiquidationOrder,
  createLiquidationTriggers,
  settleLiquidationDeficit,
  useInsuranceFund,
} from "./liquidation";
import type {
  AccountState,
  AdlCandidate,
  InsuranceFund,
  MarketRiskConfig,
  Position,
} from "./types";

const CREATED_AT = 1_700_000_000_000;

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

describe("liquidation triggers", () => {
  it("creates reduce-only liquidation orders when maintenance margin is breached", () => {
    const triggers = createLiquidationTriggers({
      eventId: "liq-1",
      account: account({
        walletBalance: 5,
        positions: [
          position({
            quantity: 1,
            entryPrice: 100,
            leverage: 10,
          }),
        ],
      }),
      markets: [market],
      markPrices: [{ marketId: market.marketId, price: 94 }],
      createdAt: CREATED_AT,
      slippageBufferRate: 0.01,
    });

    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      eventId: "liq-1:BTC-PERP",
      userId: "user-1",
      marketId: "BTC-PERP",
      positionQuantity: 1,
      markPrice: 94,
      maintenanceMargin: 0.47,
      accountEquity: -1,
      status: "TRIGGERED",
      createdAt: CREATED_AT,
      order: {
        orderId: "liq-1:BTC-PERP:liquidation-order",
        side: "SELL",
        quantity: 1,
        limitPrice: 93.06,
        reduceOnly: true,
      },
    });
  });

  it("does not trigger liquidation when equity is above maintenance margin", () => {
    const triggers = createLiquidationTriggers({
      eventId: "liq-1",
      account: account({
        walletBalance: 100,
        positions: [
          position({
            quantity: 1,
            entryPrice: 100,
            leverage: 10,
          }),
        ],
      }),
      markets: [market],
      markPrices: [{ marketId: market.marketId, price: 94 }],
      createdAt: CREATED_AT,
    });

    expect(triggers).toEqual([]);
  });

  it("uses buy orders to liquidate short positions", () => {
    const order = createLiquidationOrder({
      eventId: "liq-1",
      userId: "user-1",
      position: position({
        quantity: -2,
        entryPrice: 100,
      }),
      markPrice: 110,
      slippageBufferRate: 0.01,
    });

    expect(order).toEqual({
      orderId: "liq-1:BTC-PERP:liquidation-order",
      userId: "user-1",
      marketId: "BTC-PERP",
      side: "BUY",
      quantity: 2,
      limitPrice: 111.1,
      reduceOnly: true,
    });
  });
});

describe("insurance fund and ADL", () => {
  it("covers a deficit fully with the insurance fund", () => {
    const usage = useInsuranceFund(fund({ balance: 100 }), 40);

    expect(usage).toEqual({
      asset: "USDC",
      requested: 40,
      used: 40,
      remainingDeficit: 0,
      nextFundBalance: 60,
    });
  });

  it("uses ADL after the insurance fund is exhausted", () => {
    const settlement = settleLiquidationDeficit({
      asset: "USDC",
      deficit: 150,
      insuranceFund: fund({ balance: 50 }),
      liquidatedPosition: position({
        userId: "liquidated",
        quantity: 2,
        entryPrice: 100,
      }),
      markPrice: 100,
      adlCandidates: [
        adlCandidate({
          userId: "lower-score",
          quantity: -2,
          entryPrice: 120,
          accountEquity: 1_000,
          markPrice: 100,
        }),
        adlCandidate({
          userId: "higher-score",
          quantity: -2,
          entryPrice: 150,
          accountEquity: 100,
          markPrice: 100,
        }),
      ],
    });

    expect(settlement.insuranceFund).toMatchObject({
      used: 50,
      remainingDeficit: 100,
      nextFundBalance: 0,
    });
    expect(settlement.status).toBe("ADL_USED");
    expect(settlement.unresolvedDeficit).toBe(0);
    expect(settlement.adlActions).toEqual([
      {
        userId: "higher-score",
        marketId: "BTC-PERP",
        side: "BUY",
        quantity: 1,
        price: 100,
        score: 0.666666666667,
      },
    ]);
  });

  it("reports unresolved deficit when ADL liquidity is insufficient", () => {
    const settlement = settleLiquidationDeficit({
      asset: "USDC",
      deficit: 300,
      insuranceFund: fund({ balance: 0 }),
      liquidatedPosition: position({
        userId: "liquidated",
        quantity: 5,
        entryPrice: 100,
      }),
      markPrice: 100,
      adlCandidates: [
        adlCandidate({
          userId: "short-1",
          quantity: -1,
          entryPrice: 150,
          accountEquity: 100,
          markPrice: 100,
        }),
      ],
    });

    expect(settlement.status).toBe("FAILED");
    expect(settlement.adlActions).toHaveLength(1);
    expect(settlement.unresolvedDeficit).toBe(200);
  });

  it("ranks ADL candidates by profitability and effective leverage", () => {
    const low = adlCandidate({
      userId: "low",
      quantity: -1,
      entryPrice: 120,
      accountEquity: 1_000,
      markPrice: 100,
    });
    const high = adlCandidate({
      userId: "high",
      quantity: -1,
      entryPrice: 150,
      accountEquity: 100,
      markPrice: 100,
    });

    expect(calculateAdlScore(high)).toBeGreaterThan(calculateAdlScore(low));

    const actions = createAdlActions({
      liquidatedPosition: position({ quantity: 2, entryPrice: 100 }),
      markPrice: 100,
      quantityToReduce: 1.5,
      candidates: [low, high],
    });

    expect(actions.map((action) => action.userId)).toEqual(["high", "low"]);
    expect(actions.map((action) => action.quantity)).toEqual([1, 0.5]);
  });
});

function account(overrides: Partial<AccountState>): AccountState {
  return {
    userId: overrides.userId ?? "user-1",
    collateralAsset: overrides.collateralAsset ?? "USDC",
    walletBalance: overrides.walletBalance ?? 0,
    positions: overrides.positions ?? [],
    openOrders: overrides.openOrders ?? [],
  };
}

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

function fund(overrides: Partial<InsuranceFund>): InsuranceFund {
  return {
    asset: overrides.asset ?? "USDC",
    balance: overrides.balance ?? 0,
  };
}

function adlCandidate(input: {
  userId: string;
  quantity: number;
  entryPrice: number;
  accountEquity: number;
  markPrice: number;
}): AdlCandidate {
  return {
    userId: input.userId,
    position: position({
      userId: input.userId,
      quantity: input.quantity,
      entryPrice: input.entryPrice,
    }),
    accountEquity: input.accountEquity,
    markPrice: input.markPrice,
  };
}
