import { OrderBook } from "./src/orderbook";
import type { CancelOrderCommand, NewOrderCommand } from "./types/command";
import type { EngineEvent } from "./types/event";
import type { OrderBookSnapshot, OrderSnapshot } from "./types/order";

export class MatchingEngine {
  private readonly booksByMarket = new Map<string, OrderBook>();

  constructor(private readonly options: { clock?: () => number } = {}) {}

  submitOrder(command: NewOrderCommand): EngineEvent[] {
    return this.bookFor(command.market).submitOrder(command);
  }

  submitOrders(commands: NewOrderCommand[]): EngineEvent[] {
    const events: EngineEvent[] = [];

    for (const command of commands) {
      events.push(...this.submitOrder(command));
    }

    return events;
  }

  cancelOrder(command: CancelOrderCommand): EngineEvent[] {
    return this.bookFor(command.market).cancelOrder(command);
  }

  getOpenOrder(market: string, orderId: string): OrderSnapshot | undefined {
    return this.bookFor(market).getOpenOrder(orderId);
  }

  getBookSnapshot(market: string, depth?: number): OrderBookSnapshot {
    return this.bookFor(market).snapshot(depth);
  }

  private bookFor(market: string): OrderBook {
    let book = this.booksByMarket.get(market);

    if (!book) {
      book = new OrderBook(market, this.options.clock);
      this.booksByMarket.set(market, book);
    }

    return book;
  }
}

export { OrderBook } from "./src/orderbook";
export {
  createStoredSnapshot,
  FileSnapshotStore,
  recoverOrderBookFromSnapshot,
} from "./src/recovery";
export type { SnapshotStore, StoredOrderBookSnapshot } from "./src/recovery";
export type {
  CancelOrderCommand,
  NewOrderCommand,
  OrderType,
  Side,
  TimeInForce,
} from "./types/command";
export type {
  CancelRejected,
  CancelRejectedReason,
  EngineEvent,
  OrderAccepted,
  OrderCancelled,
  OrderExpired,
  OrderExpiredReason,
  OrderRejected,
  OrderRejectedReason,
  OrderRested,
  TradeExecuted,
} from "./types/event";
export type {
  Order,
  OrderBookSnapshot,
  OrderSnapshot,
  OrderStatus,
  PriceLevelSnapshot,
} from "./types/order";
