import type { EngineEvent, TradeExecuted } from "../../matching-engine/index";
import type {
  DurableOrderSide,
  DurableOrderStatus,
  DurableOrderType,
  DurableTimeInForce,
  FillWrite,
  JsonValue,
  OrderWrite,
  ProcessedEventWrite,
} from "./records";
import type {
  PersistenceStore,
  PersistenceTransaction,
} from "./persistence-store";

export interface PersistEventMetadata {
  stream?: string;
  streamId?: string;
  processedAt?: Date;
}

export interface PersistEventResult {
  status: "processed" | "skipped";
  eventId: string;
  eventType: EngineEvent["type"];
  writes: string[];
}

export class PersistenceService {
  constructor(private readonly store: PersistenceStore) {}

  async persistEvent(
    event: EngineEvent,
    metadata: PersistEventMetadata = {},
  ): Promise<PersistEventResult> {
    return this.store.transaction(async (tx) => {
      const existing = await tx.findProcessedEvent(event.eventId);

      if (existing) {
        return {
          status: "skipped",
          eventId: event.eventId,
          eventType: event.type,
          writes: [],
        };
      }

      const writes = await this.applyEvent(tx, event);
      await tx.createProcessedEvent(
        processedEventFromEngineEvent(event, metadata),
      );

      return {
        status: "processed",
        eventId: event.eventId,
        eventType: event.type,
        writes: [...writes, "processed_events.create"],
      };
    });
  }

  private async applyEvent(
    tx: PersistenceTransaction,
    event: EngineEvent,
  ): Promise<string[]> {
    switch (event.type) {
      case "order.accepted":
        await tx.updateOrderStatus({
          orderId: event.orderId,
          status: "OPEN",
          updatedAt: new Date(event.timestamp),
        });
        return ["orders.mark_open"];

      case "order.rejected":
        await tx.updateOrderStatus({
          orderId: event.orderId,
          status: "REJECTED",
          rejectionReason: event.reason,
          updatedAt: new Date(event.timestamp),
        });
        return ["orders.mark_rejected"];

      case "order.rested":
        await tx.upsertOrder(orderWriteFromRestedEvent(event));
        return ["orders.upsert_rested"];

      case "order.cancelled":
        await tx.updateOrderStatus({
          orderId: event.orderId,
          status: "CANCELLED",
          remainingQuantity: decimalString(event.remainingQtyLots),
          updatedAt: new Date(event.timestamp),
        });
        return ["orders.mark_cancelled"];

      case "order.cancel_rejected":
        return ["orders.cancel_rejected_noop"];

      case "order.expired":
        await tx.updateOrderStatus({
          orderId: event.orderId,
          status: "EXPIRED",
          remainingQuantity: decimalString(event.remainingQtyLots),
          updatedAt: new Date(event.timestamp),
        });
        return ["orders.mark_expired"];

      case "trade.executed":
        await tx.createFills(fillsFromTrade(event));
        await tx.updateOrderStatus({
          orderId: event.makerOrderId,
          status: orderStatusFromRemaining(event.makerOrderRemainingQtyLots),
          remainingQuantity: decimalString(event.makerOrderRemainingQtyLots),
          updatedAt: new Date(event.timestamp),
        });
        await tx.updateOrderStatus({
          orderId: event.takerOrderId,
          status: orderStatusFromRemaining(event.takerOrderRemainingQtyLots),
          remainingQuantity: decimalString(event.takerOrderRemainingQtyLots),
          updatedAt: new Date(event.timestamp),
        });
        return [
          "fills.create_many",
          "orders.update_maker_after_trade",
          "orders.update_taker_after_trade",
        ];
    }
  }
}

function processedEventFromEngineEvent(
  event: EngineEvent,
  metadata: PersistEventMetadata,
): ProcessedEventWrite {
  return {
    eventId: event.eventId,
    eventType: event.type,
    stream: metadata.stream,
    streamId: metadata.streamId,
    marketId: event.market,
    raw: toJsonValue(event),
    processedAt: metadata.processedAt ?? new Date(),
  };
}

function orderWriteFromRestedEvent(
  event: Extract<EngineEvent, { type: "order.rested" }>,
): OrderWrite {
  return {
    id: event.order.orderId,
    userId: event.order.userId,
    marketId: event.order.market,
    side: sideToDurable(event.order.side),
    type: orderTypeToDurable(event.order.type),
    timeInForce: timeInForceToDurable(event.order.timeInForce),
    price:
      event.order.priceTicks == null ? null : decimalString(event.order.priceTicks),
    quantity: decimalString(event.order.qtyLots),
    remainingQuantity: decimalString(event.order.remainingQtyLots),
    reduceOnly: event.order.reduceOnly,
    postOnly: event.order.postOnly,
    status: event.order.status,
    rejectionReason: null,
    createdAt: new Date(event.order.createdAt),
    updatedAt: new Date(event.timestamp),
  };
}

function fillsFromTrade(event: TradeExecuted): FillWrite[] {
  const createdAt = new Date(event.timestamp);
  const price = decimalString(event.priceTicks);
  const quantity = decimalString(event.qtyLots);
  const notional = decimalString(event.priceTicks * event.qtyLots);

  return [
    {
      id: `${event.tradeId}:maker`,
      tradeId: event.tradeId,
      orderId: event.makerOrderId,
      userId: event.makerUserId,
      marketId: event.market,
      side: sideToDurable(event.makerSide),
      liquidityRole: "MAKER",
      price,
      quantity,
      notional,
      fee: "0",
      realizedPnl: "0",
      eventId: event.eventId,
      createdAt,
    },
    {
      id: `${event.tradeId}:taker`,
      tradeId: event.tradeId,
      orderId: event.takerOrderId,
      userId: event.takerUserId,
      marketId: event.market,
      side: sideToDurable(event.takerSide),
      liquidityRole: "TAKER",
      price,
      quantity,
      notional,
      fee: "0",
      realizedPnl: "0",
      eventId: event.eventId,
      createdAt,
    },
  ];
}

function sideToDurable(side: "buy" | "sell"): DurableOrderSide {
  return side === "buy" ? "BUY" : "SELL";
}

function orderTypeToDurable(type: "market" | "limit"): DurableOrderType {
  return type === "market" ? "MARKET" : "LIMIT";
}

function timeInForceToDurable(timeInForce: "GTC" | "IOC"): DurableTimeInForce {
  return timeInForce;
}

function orderStatusFromRemaining(remainingQtyLots: number): DurableOrderStatus {
  return remainingQtyLots === 0 ? "FILLED" : "PARTIALLY_FILLED";
}

function decimalString(value: number): string {
  return String(value);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
