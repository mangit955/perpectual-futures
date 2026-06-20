import { describe, expect, it } from "bun:test";
import {
  applyFillToPosition,
  calculateUnrealizedPnl,
  emptyPosition,
  positionSide,
  viewPosition,
} from "./position-engine";
import type { MarketRiskConfig, Position } from "./types";

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

describe("applyFillToPosition", () => {
  it("opens a long position", () => {
    const result = applyFillToPosition(undefined, fill("BUY", 100, 2), market);

    expect(result.next).toMatchObject({
      quantity: 2,
      entryPrice: 100,
      realizedPnl: 0,
    });
    expect(result.openedQuantity).toBe(2);
    expect(positionSide(result.next)).toBe("LONG");
  });

  it("increases a long position with weighted average entry", () => {
    const first = applyFillToPosition(undefined, fill("BUY", 100, 2), market);
    const second = applyFillToPosition(
      first.next,
      fill("BUY", 110, 2),
      market,
    );

    expect(second.next).toMatchObject({
      quantity: 4,
      entryPrice: 105,
      realizedPnl: 0,
    });
  });

  it("reduces a long and realizes pnl", () => {
    const position: Position = {
      ...emptyPosition("user-1", "BTC-PERP", 10),
      quantity: 4,
      entryPrice: 100,
    };

    const result = applyFillToPosition(
      position,
      fill("SELL", 120, 1.5, 0.1),
      market,
    );

    expect(result).toMatchObject({
      closedQuantity: 1.5,
      realizedPnlDelta: 30,
      feePaid: 0.1,
    });
    expect(result.next).toMatchObject({
      quantity: 2.5,
      entryPrice: 100,
      realizedPnl: 29.9,
    });
  });

  it("closes a short position", () => {
    const position: Position = {
      ...emptyPosition("user-1", "BTC-PERP", 10),
      quantity: -3,
      entryPrice: 100,
    };

    const result = applyFillToPosition(position, fill("BUY", 90, 3), market);

    expect(result.next).toMatchObject({
      quantity: 0,
      entryPrice: 0,
      realizedPnl: 30,
    });
    expect(positionSide(result.next)).toBe("FLAT");
  });

  it("reverses from long to short", () => {
    const position: Position = {
      ...emptyPosition("user-1", "BTC-PERP", 10),
      quantity: 2,
      entryPrice: 100,
    };

    const result = applyFillToPosition(position, fill("SELL", 90, 5), market);

    expect(result).toMatchObject({
      closedQuantity: 2,
      openedQuantity: 3,
      realizedPnlDelta: -20,
    });
    expect(result.next).toMatchObject({
      quantity: -3,
      entryPrice: 90,
      realizedPnl: -20,
    });
    expect(positionSide(result.next)).toBe("SHORT");
  });

  it("calculates unrealized pnl for longs and shorts", () => {
    expect(
      calculateUnrealizedPnl({ quantity: 2, entryPrice: 100 }, 130),
    ).toBe(60);
    expect(
      calculateUnrealizedPnl({ quantity: -2, entryPrice: 100 }, 80),
    ).toBe(40);
  });

  it("builds a position view with notional and margin values", () => {
    const position: Position = {
      ...emptyPosition("user-1", "BTC-PERP", 10),
      quantity: 2,
      entryPrice: 100,
    };

    const view = viewPosition(position, market, 120);

    expect(view).toMatchObject({
      side: "LONG",
      notional: 240,
      unrealizedPnl: 40,
      initialMargin: 24,
      maintenanceMargin: 1.2,
    });
  });
});

function fill(
  side: "BUY" | "SELL",
  price: number,
  quantity: number,
  fee = 0,
) {
  return {
    userId: "user-1",
    marketId: "BTC-PERP",
    side,
    price,
    quantity,
    fee,
  };
}
