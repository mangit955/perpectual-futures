import type { OrderSnapshot } from "./order";

export type OrderRejectedReason =
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "DUPLICATE_ORDER_ID"
  | "LIMIT_ORDER_MISSING_PRICE"
  | "MARKET_ORDER_HAS_PRICE"
  | "POST_ONLY_REQUIRES_LIMIT_ORDER"
  | "POST_ONLY_REQUIRES_GTC"
  | "POST_ONLY_WOULD_TAKE";

export type CancelRejectedReason =
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_OPEN"
  | "USER_MISMATCH";

export type OrderExpiredReason =
  | "IOC_UNFILLED"
  | "MARKET_LIQUIDITY_EXHAUSTED"
  | "SELF_TRADE_PREVENTION";

export interface BaseEvent {
  eventId: string;
  commandId: string;
  market: string;
  sequence: number;
  timestamp: number;
}

export interface OrderAccepted extends BaseEvent {
  type: "order.accepted";
  orderId: string;
}

export interface OrderRejected extends BaseEvent {
  type: "order.rejected";
  orderId: string;
  reason: OrderRejectedReason;
}

export interface OrderRested extends BaseEvent {
  type: "order.rested";
  order: OrderSnapshot;
}

export interface OrderCancelled extends BaseEvent {
  type: "order.cancelled";
  orderId: string;
  remainingQtyLots: number;
}

export interface CancelRejected extends BaseEvent {
  type: "order.cancel_rejected";
  orderId: string;
  reason: CancelRejectedReason;
}

export interface OrderExpired extends BaseEvent {
  type: "order.expired";
  orderId: string;
  remainingQtyLots: number;
  reason: OrderExpiredReason;
}

export interface TradeExecuted extends BaseEvent {
  type: "trade.executed";
  tradeId: string;
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  makerSide: "buy" | "sell";
  takerSide: "buy" | "sell";
  priceTicks: number;
  qtyLots: number;
  makerOrderRemainingQtyLots: number;
  takerOrderRemainingQtyLots: number;
}

export type EngineEvent =
  | OrderAccepted
  | OrderRejected
  | OrderRested
  | OrderCancelled
  | CancelRejected
  | OrderExpired
  | TradeExecuted;
