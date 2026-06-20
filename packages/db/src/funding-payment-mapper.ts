import type { FundingPaymentWrite } from "./records";

export interface FundingPaymentLike {
  id: string;
  eventId: string;
  userId: string;
  marketId: string;
  positionQuantity: number;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  paymentAmount: number;
  fundingTime: number;
}

export function toFundingPaymentWrite(
  payment: FundingPaymentLike,
  createdAt = new Date(payment.fundingTime),
): FundingPaymentWrite {
  return {
    id: payment.id,
    userId: payment.userId,
    marketId: payment.marketId,
    positionQuantity: decimalString(payment.positionQuantity),
    markPrice: decimalString(payment.markPrice),
    indexPrice: decimalString(payment.indexPrice),
    fundingRate: decimalString(payment.fundingRate),
    paymentAmount: decimalString(payment.paymentAmount),
    fundingTime: new Date(payment.fundingTime),
    eventId: payment.eventId,
    createdAt,
  };
}

function decimalString(value: number): string {
  return String(value);
}
