import {
  MatchingEngine,
  type EngineEvent,
  type TradeExecuted,
} from "../../matching-engine/index";
import {
  applyFillToPosition,
  emptyPosition,
  type FillInput,
} from "../../risk/src/index";
import { commandStream, eventStream, type StreamBus } from "./stream";
import type { RuntimeCommand, RuntimeFill, RuntimeOrder } from "./types";
import type { RuntimeStore } from "./store";

export class MatchingWorker {
  private readonly offsets = new Map<string, string>();

  constructor(
    private readonly bus: StreamBus,
    private readonly engine: MatchingEngine,
    private readonly markets: () => string[],
  ) {}

  async processOnce(): Promise<number> {
    let processed = 0;

    for (const market of this.markets()) {
      const stream = commandStream(market);
      const messages = await this.bus.readAfter<RuntimeCommand>(
        stream,
        this.offsets.get(stream),
      );

      for (const message of messages) {
        const events =
          message.payload.type === "order.created"
            ? this.engine.submitOrder(message.payload.command)
            : this.engine.cancelOrder(message.payload.command);

        for (const event of events) {
          await this.bus.append(eventStream(event.market), {
            type: "engine.event",
            event,
          });
        }

        this.offsets.set(stream, message.id);
        processed += 1;
      }
    }

    return processed;
  }
}

export class RuntimePersistenceWorker {
  private readonly offsets = new Map<string, string>();

  constructor(
    private readonly bus: StreamBus,
    private readonly store: RuntimeStore,
    private readonly markets: () => string[],
  ) {}

  async processOnce(): Promise<number> {
    let processed = 0;

    for (const market of this.markets()) {
      const stream = eventStream(market);
      const messages = await this.bus.readAfter<{ type: "engine.event"; event: EngineEvent }>(
        stream,
        this.offsets.get(stream),
      );

      for (const message of messages) {
        this.applyEvent(message.payload.event);
        this.offsets.set(stream, message.id);
        processed += 1;
      }
    }

    return processed;
  }

  private applyEvent(event: EngineEvent): void {
    if (this.store.processedEvents.has(event.eventId)) {
      return;
    }

    switch (event.type) {
      case "order.accepted":
        this.updateOrder(event.orderId, { status: "OPEN", updatedAt: event.timestamp });
        break;
      case "order.rejected":
        this.updateOrder(event.orderId, {
          status: "REJECTED",
          rejectionReason: event.reason,
          updatedAt: event.timestamp,
        });
        break;
      case "order.rested":
        this.updateOrder(event.order.orderId, {
          status: event.order.status,
          remainingQuantity: event.order.remainingQtyLots,
          updatedAt: event.timestamp,
        });
        break;
      case "order.cancelled":
        this.updateOrder(event.orderId, {
          status: "CANCELLED",
          remainingQuantity: event.remainingQtyLots,
          updatedAt: event.timestamp,
        });
        break;
      case "order.expired":
        this.updateOrder(event.orderId, {
          status: "EXPIRED",
          remainingQuantity: event.remainingQtyLots,
          updatedAt: event.timestamp,
        });
        break;
      case "order.cancel_rejected":
        break;
      case "trade.executed":
        this.applyTrade(event);
        break;
    }

    this.store.processedEvents.add(event.eventId);
  }

  private applyTrade(event: TradeExecuted): void {
    const makerFill = fillFromTrade(event, "MAKER");
    const takerFill = fillFromTrade(event, "TAKER");

    this.store.fills.set(makerFill.id, makerFill);
    this.store.fills.set(takerFill.id, takerFill);
    this.updateOrder(event.makerOrderId, {
      status: event.makerOrderRemainingQtyLots === 0 ? "FILLED" : "PARTIALLY_FILLED",
      remainingQuantity: event.makerOrderRemainingQtyLots,
      updatedAt: event.timestamp,
    });
    this.updateOrder(event.takerOrderId, {
      status: event.takerOrderRemainingQtyLots === 0 ? "FILLED" : "PARTIALLY_FILLED",
      remainingQuantity: event.takerOrderRemainingQtyLots,
      updatedAt: event.timestamp,
    });
    this.applyFillToPosition(event, "MAKER");
    this.applyFillToPosition(event, "TAKER");
  }

  private applyFillToPosition(event: TradeExecuted, role: "MAKER" | "TAKER"): void {
    const userId = role === "MAKER" ? event.makerUserId : event.takerUserId;
    const side = role === "MAKER" ? event.makerSide : event.takerSide;
    const market = this.store.markets.get(event.market);

    if (!market) {
      throw new Error(`Unknown market ${event.market}`);
    }

    const existing =
      this.store.getPosition(userId, event.market) ??
      emptyPosition(userId, event.market, 10);
    const fill: FillInput = {
      userId,
      marketId: event.market,
      side: side === "buy" ? "BUY" : "SELL",
      price: event.priceTicks,
      quantity: event.qtyLots,
      fee: 0,
    };
    const result = applyFillToPosition(existing, fill, market);
    this.store.setPosition(result.next);
  }

  private updateOrder(orderId: string, patch: Partial<RuntimeOrder>): void {
    const existing = this.store.orders.get(orderId);

    if (existing) {
      this.store.orders.set(orderId, { ...existing, ...patch });
    }
  }
}

function fillFromTrade(event: TradeExecuted, role: "MAKER" | "TAKER"): RuntimeFill {
  const maker = role === "MAKER";
  const side = maker ? event.makerSide : event.takerSide;

  return {
    id: `${event.tradeId}:${role.toLowerCase()}`,
    tradeId: event.tradeId,
    orderId: maker ? event.makerOrderId : event.takerOrderId,
    userId: maker ? event.makerUserId : event.takerUserId,
    marketId: event.market,
    side: side === "buy" ? "BUY" : "SELL",
    liquidityRole: role,
    price: event.priceTicks,
    quantity: event.qtyLots,
    notional: event.priceTicks * event.qtyLots,
    fee: 0,
    realizedPnl: 0,
    createdAt: event.timestamp,
  };
}
