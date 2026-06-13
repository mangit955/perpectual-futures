import type { OrderType, Side, TimeInForce } from "./command";

export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCLLED";

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
  createdAt: number;
}
