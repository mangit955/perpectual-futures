import type {
  FillInput,
  MarketRiskConfig,
  Position,
  PositionSide,
  PositionUpdateResult,
  PositionView,
} from "./types";

export function emptyPosition(
  userId: string,
  marketId: string,
  leverage = 1,
): Position {
  return {
    userId,
    marketId,
    quantity: 0,
    entryPrice: 0,
    realizedPnl: 0,
    leverage,
  };
}

export function applyFillToPosition(
  position: Position | undefined,
  fill: FillInput,
  market: MarketRiskConfig,
): PositionUpdateResult {
  assertPositive(fill.quantity, "fill quantity");
  assertPositive(fill.price, "fill price");
  assertLeverage(position?.leverage ?? 1, market);

  const previous = clonePosition(
    position ?? emptyPosition(fill.userId, fill.marketId),
  );
  const signedFillQuantity =
    fill.side === "BUY" ? fill.quantity : -fill.quantity;
  const sameDirection =
    previous.quantity === 0 ||
    Math.sign(previous.quantity) === Math.sign(signedFillQuantity);

  let nextQuantity = previous.quantity + signedFillQuantity;
  let nextEntryPrice = previous.entryPrice;
  let realizedPnlDelta = 0;
  let closedQuantity = 0;
  let openedQuantity = 0;

  if (sameDirection) {
    const previousAbsQuantity = Math.abs(previous.quantity);
    const nextAbsQuantity = Math.abs(nextQuantity);

    nextEntryPrice =
      nextAbsQuantity === 0
        ? 0
        : (previous.entryPrice * previousAbsQuantity +
            fill.price * fill.quantity) /
          nextAbsQuantity;
    openedQuantity = fill.quantity;
  } else {
    closedQuantity = Math.min(Math.abs(previous.quantity), fill.quantity);
    realizedPnlDelta = calculateRealizedPnl(
      previous.quantity,
      previous.entryPrice,
      fill.price,
      closedQuantity,
    );

    if (nextQuantity === 0) {
      nextEntryPrice = 0;
    } else if (Math.sign(nextQuantity) !== Math.sign(previous.quantity)) {
      openedQuantity = Math.abs(nextQuantity);
      nextEntryPrice = fill.price;
    } else {
      nextEntryPrice = previous.entryPrice;
    }
  }

  if (isDust(nextQuantity)) {
    nextQuantity = 0;
    nextEntryPrice = 0;
  }

  const next: Position = {
    ...previous,
    userId: fill.userId,
    marketId: fill.marketId,
    quantity: roundFinancial(nextQuantity),
    entryPrice: roundFinancial(nextEntryPrice),
    realizedPnl: roundFinancial(
      previous.realizedPnl + realizedPnlDelta - fill.fee,
    ),
  };

  return {
    previous,
    next,
    closedQuantity: roundFinancial(closedQuantity),
    openedQuantity: roundFinancial(openedQuantity),
    realizedPnlDelta: roundFinancial(realizedPnlDelta),
    feePaid: fill.fee,
  };
}

export function positionSide(position: Pick<Position, "quantity">): PositionSide {
  if (position.quantity > 0) {
    return "LONG";
  }

  if (position.quantity < 0) {
    return "SHORT";
  }

  return "FLAT";
}

export function calculateUnrealizedPnl(
  position: Pick<Position, "quantity" | "entryPrice">,
  markPrice: number,
): number {
  if (position.quantity === 0) {
    return 0;
  }

  return roundFinancial((markPrice - position.entryPrice) * position.quantity);
}

export function positionNotional(
  position: Pick<Position, "quantity">,
  markPrice: number,
): number {
  return roundFinancial(Math.abs(position.quantity) * markPrice);
}

export function viewPosition(
  position: Position,
  market: MarketRiskConfig,
  markPrice: number,
): PositionView {
  const notional = positionNotional(position, markPrice);
  const initialMargin = notional / position.leverage;
  const maintenanceMargin = notional * market.maintenanceMarginRate;

  return {
    ...position,
    side: positionSide(position),
    notional,
    unrealizedPnl: calculateUnrealizedPnl(position, markPrice),
    initialMargin: roundFinancial(initialMargin),
    maintenanceMargin: roundFinancial(maintenanceMargin),
  };
}

function calculateRealizedPnl(
  previousQuantity: number,
  entryPrice: number,
  fillPrice: number,
  closedQuantity: number,
): number {
  if (previousQuantity > 0) {
    return (fillPrice - entryPrice) * closedQuantity;
  }

  return (entryPrice - fillPrice) * closedQuantity;
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}

function assertLeverage(leverage: number, market: MarketRiskConfig): void {
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > market.maxLeverage) {
    throw new Error(
      `leverage must be between 1 and ${market.maxLeverage} for ${market.marketId}`,
    );
  }
}

function clonePosition(position: Position): Position {
  return { ...position };
}

function isDust(value: number): boolean {
  return Math.abs(value) < 1e-12;
}

function roundFinancial(value: number): number {
  return Number(value.toFixed(12));
}
