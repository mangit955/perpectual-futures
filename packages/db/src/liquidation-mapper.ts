import type { DurableLiquidationStatus, LiquidationWrite } from "./records";

export interface LiquidationLike {
  eventId: string;
  userId: string;
  marketId: string;
  positionQuantity: number;
  markPrice: number;
  maintenanceMargin: number;
  accountEquity: number;
  status: DurableLiquidationStatus;
  createdAt: number;
}

export interface LiquidationSettlementLike {
  insuranceFundUsed: number;
  adlUsed: number;
  status?: DurableLiquidationStatus;
}

export function toLiquidationWrite(
  liquidation: LiquidationLike,
  settlement: LiquidationSettlementLike = {
    insuranceFundUsed: 0,
    adlUsed: 0,
  },
): LiquidationWrite {
  const createdAt = new Date(liquidation.createdAt);

  return {
    id: liquidation.eventId,
    userId: liquidation.userId,
    marketId: liquidation.marketId,
    positionQuantity: decimalString(liquidation.positionQuantity),
    markPrice: decimalString(liquidation.markPrice),
    maintenanceMargin: decimalString(liquidation.maintenanceMargin),
    accountEquity: decimalString(liquidation.accountEquity),
    status: settlement.status ?? liquidation.status,
    insuranceFundUsed: decimalString(settlement.insuranceFundUsed),
    adlUsed: decimalString(settlement.adlUsed),
    eventId: liquidation.eventId,
    createdAt,
    updatedAt: createdAt,
  };
}

function decimalString(value: number): string {
  return String(value);
}
