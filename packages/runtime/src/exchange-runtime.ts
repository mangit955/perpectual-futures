import { MatchingEngine, type NewOrderCommand } from "../../matching-engine/index";
import { checkOrderMargin } from "../../risk/src/index";
import { commandStream, InMemoryStreamBus, type StreamBus } from "./stream";
import { RuntimeStore } from "./store";
import type { RuntimeCommand, RuntimeOrder } from "./types";
import { MatchingWorker, RuntimePersistenceWorker } from "./workers";

export interface SubmitOrderInput {
  userId: string;
  marketId: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number;
  timeInForce: "GTC" | "IOC";
  reduceOnly?: boolean;
  postOnly?: boolean;
  leverage?: number;
}

export class ExchangeRuntime {
  readonly store: RuntimeStore;
  readonly bus: StreamBus;
  readonly engine: MatchingEngine;
  readonly matchingWorker: MatchingWorker;
  readonly persistenceWorker: RuntimePersistenceWorker;

  constructor(input: {
    store?: RuntimeStore;
    bus?: StreamBus;
    engine?: MatchingEngine;
    clock?: () => number;
  } = {}) {
    this.store = input.store ?? new RuntimeStore();
    this.bus = input.bus ?? new InMemoryStreamBus();
    this.engine = input.engine ?? new MatchingEngine({ clock: input.clock });
    this.matchingWorker = new MatchingWorker(this.bus, this.engine, () =>
      [...this.store.markets.keys()],
    );
    this.persistenceWorker = new RuntimePersistenceWorker(this.bus, this.store, () =>
      [...this.store.markets.keys()],
    );
  }

  register(email: string, password: string, now = Date.now()) {
    return this.store.createUser({ email, password, now });
  }

  login(email: string, password: string) {
    return this.store.login(email, password);
  }

  deposit(userId: string, asset: string, amount: number) {
    if (amount <= 0) {
      throw new Error("deposit amount must be positive");
    }

    return this.store.adjustBalance(userId, asset, amount);
  }

  async submitOrder(input: SubmitOrderInput, now = Date.now()): Promise<RuntimeOrder> {
    const market = this.store.markets.get(input.marketId);

    if (!market) {
      throw new Error("market not found");
    }

    const orderId = `order-${this.store.orders.size + 1}`;
    const order: RuntimeOrder = {
      id: orderId,
      userId: input.userId,
      marketId: input.marketId,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      remainingQuantity: input.quantity,
      price: input.price,
      timeInForce: input.timeInForce,
      reduceOnly: input.reduceOnly ?? false,
      postOnly: input.postOnly ?? false,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };

    const check = checkOrderMargin(
      {
        userId: input.userId,
        collateralAsset: market.quoteAsset,
        walletBalance: this.store.getBalance(input.userId, market.quoteAsset).total,
        positions: [...this.store.positions.values()].filter(
          (position) => position.userId === input.userId,
        ),
        openOrders: [],
      },
      {
        marketId: input.marketId,
        side: input.side,
        price: input.price ?? 0,
        quantity: input.quantity,
        reduceOnly: input.reduceOnly ?? false,
        estimatedFeeRate: market.takerFeeRate,
        leverage: input.leverage ?? 10,
      },
      [market],
      [{ marketId: input.marketId, price: input.price ?? 0 }],
    );

    if (!check.ok) {
      order.status = "REJECTED";
      order.rejectionReason = check.reason;
      this.store.orders.set(order.id, order);
      return order;
    }

    this.store.orders.set(order.id, order);

    const command: NewOrderCommand = {
      commandId: `cmd-${order.id}`,
      orderId: order.id,
      userId: input.userId,
      market: input.marketId,
      side: input.side === "BUY" ? "buy" : "sell",
      type: input.type === "MARKET" ? "market" : "limit",
      qtyLots: input.quantity,
      priceTicks: input.price,
      timeInForce: input.timeInForce,
      reduceOnly: input.reduceOnly,
      postOnly: input.postOnly,
      createdAt: now,
    };
    const runtimeCommand: RuntimeCommand = { type: "order.created", command };
    await this.bus.append(commandStream(input.marketId), runtimeCommand);

    return order;
  }

  async cancelOrder(userId: string, marketId: string, orderId: string): Promise<void> {
    await this.bus.append(commandStream(marketId), {
      type: "order.cancelled",
      command: {
        commandId: `cmd-cancel-${orderId}`,
        userId,
        market: marketId,
        orderId,
      },
    });
  }

  async drain(maxIterations = 20): Promise<number> {
    let processed = 0;

    for (let index = 0; index < maxIterations; index += 1) {
      const matched = await this.matchingWorker.processOnce();
      const persisted = await this.persistenceWorker.processOnce();
      processed += matched + persisted;

      if (matched + persisted === 0) {
        break;
      }
    }

    return processed;
  }
}
