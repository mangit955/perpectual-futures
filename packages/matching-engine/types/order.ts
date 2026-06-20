import type { OrderType, Side, TimeInForce } from "./command";

export type OrderStatus =
  | "OPEN"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED"
  | "EXPIRED";

export interface Order {
  orderId: string;
  userId: string;
  market: string;
  side: Side;
  type: OrderType;
  qtyLots: number;
  remainingQtyLots: number;
  priceTicks?: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  reduceOnly: boolean;
  postOnly: boolean;
  createdAt: number;
}

export interface OrderSnapshot extends Order {
  sequence: number;
}

export interface PriceLevelSnapshot {
  priceTicks: number;
  totalQtyLots: number;
  orders: OrderSnapshot[];
}

export interface OrderBookSnapshot {
  market: string;
  sequence: number;
  bids: PriceLevelSnapshot[];
  asks: PriceLevelSnapshot[];
}
