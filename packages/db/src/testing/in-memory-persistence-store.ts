import type {
  FillWrite,
  OrderStatusUpdate,
  OrderWrite,
  ProcessedEventWrite,
} from "../records";
import type {
  PersistenceStore,
  PersistenceTransaction,
} from "../persistence-store";

export interface InMemoryPersistenceState {
  orders: Map<string, OrderWrite>;
  fills: Map<string, FillWrite>;
  processedEvents: Map<string, ProcessedEventWrite>;
}

export class InMemoryPersistenceStore implements PersistenceStore {
  readonly state: InMemoryPersistenceState = {
    orders: new Map(),
    fills: new Map(),
    processedEvents: new Map(),
  };

  async transaction<T>(
    callback: (tx: PersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    const draft = cloneState(this.state);
    const result = await callback(new InMemoryPersistenceTransaction(draft));

    this.state.orders = draft.orders;
    this.state.fills = draft.fills;
    this.state.processedEvents = draft.processedEvents;

    return result;
  }

  seedOrder(order: OrderWrite): void {
    this.state.orders.set(order.id, cloneOrder(order));
  }
}

class InMemoryPersistenceTransaction implements PersistenceTransaction {
  constructor(private readonly state: InMemoryPersistenceState) {}

  async findProcessedEvent(
    eventId: string,
  ): Promise<ProcessedEventWrite | null> {
    return this.state.processedEvents.get(eventId) ?? null;
  }

  async createProcessedEvent(event: ProcessedEventWrite): Promise<void> {
    if (this.state.processedEvents.has(event.eventId)) {
      throw new Error(`Processed event already exists: ${event.eventId}`);
    }

    this.state.processedEvents.set(event.eventId, cloneProcessedEvent(event));
  }

  async upsertOrder(order: OrderWrite): Promise<void> {
    this.state.orders.set(order.id, cloneOrder(order));
  }

  async updateOrderStatus(update: OrderStatusUpdate): Promise<void> {
    const existing = this.state.orders.get(update.orderId);

    if (!existing) {
      return;
    }

    this.state.orders.set(update.orderId, {
      ...existing,
      status: update.status,
      remainingQuantity:
        update.remainingQuantity ?? existing.remainingQuantity,
      rejectionReason:
        update.rejectionReason === undefined
          ? existing.rejectionReason
          : update.rejectionReason,
      updatedAt: new Date(update.updatedAt),
    });
  }

  async createFills(fills: FillWrite[]): Promise<void> {
    for (const fill of fills) {
      if (!this.state.fills.has(fill.id)) {
        this.state.fills.set(fill.id, cloneFill(fill));
      }
    }
  }
}

function cloneState(state: InMemoryPersistenceState): InMemoryPersistenceState {
  return {
    orders: new Map(
      [...state.orders.entries()].map(([id, order]) => [id, cloneOrder(order)]),
    ),
    fills: new Map(
      [...state.fills.entries()].map(([id, fill]) => [id, cloneFill(fill)]),
    ),
    processedEvents: new Map(
      [...state.processedEvents.entries()].map(([id, event]) => [
        id,
        cloneProcessedEvent(event),
      ]),
    ),
  };
}

function cloneOrder(order: OrderWrite): OrderWrite {
  return {
    ...order,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
  };
}

function cloneFill(fill: FillWrite): FillWrite {
  return {
    ...fill,
    createdAt: new Date(fill.createdAt),
  };
}

function cloneProcessedEvent(event: ProcessedEventWrite): ProcessedEventWrite {
  return {
    ...event,
    processedAt: new Date(event.processedAt),
  };
}
