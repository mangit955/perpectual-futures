export type OrderRejectedReason =
  | "INVALID_QUANTITY"
  | "DUPLICATE_ORDER_ID"
  | "LIMIT_ORDER_MISSING_PRICE"
  | "MARKET_ORDER_HAS_PRICE";

export interface BaseEvent {
  eventId: string;
  commandId: string;
  market: string;
  timestamp: number;
}

export interface OrderAccepted extends BaseEvent {
  type: "OrderAccepted";
  orderId: string;
}

export interface OrderRejected extends BaseEvent {
  type: "OrderRejected";
  orderId: string;
  reason: OrderRejectedReason;
}

export type EngineEvent = OrderAccepted | OrderRejected;
