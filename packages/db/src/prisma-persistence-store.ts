import type {
  FillWrite,
  OrderStatusUpdate,
  OrderWrite,
  ProcessedEventWrite,
} from "./records";
import type {
  PersistenceStore,
  PersistenceTransaction,
} from "./persistence-store";

export interface PrismaClientLike {
  $transaction<T>(
    callback: (tx: PrismaTransactionLike) => Promise<T>,
  ): Promise<T>;
}

export interface PrismaTransactionLike {
  processedEvent: {
    findUnique(args: { where: { eventId: string } }): Promise<unknown | null>;
    create(args: { data: ProcessedEventWrite }): Promise<unknown>;
  };
  order: {
    upsert(args: {
      where: { id: string };
      create: OrderWrite;
      update: Partial<OrderWrite>;
    }): Promise<unknown>;
    updateMany(args: {
      where: { id: string };
      data: Partial<OrderWrite> & { updatedAt: Date };
    }): Promise<unknown>;
  };
  fill: {
    createMany(args: {
      data: FillWrite[];
      skipDuplicates: boolean;
    }): Promise<unknown>;
  };
}

export class PrismaPersistenceStore implements PersistenceStore {
  constructor(private readonly client: PrismaClientLike) {}

  transaction<T>(
    callback: (tx: PersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction((tx) =>
      callback(new PrismaPersistenceTransaction(tx)),
    );
  }
}

class PrismaPersistenceTransaction implements PersistenceTransaction {
  constructor(private readonly tx: PrismaTransactionLike) {}

  async findProcessedEvent(
    eventId: string,
  ): Promise<ProcessedEventWrite | null> {
    const row = await this.tx.processedEvent.findUnique({
      where: { eventId },
    });

    return row as ProcessedEventWrite | null;
  }

  async createProcessedEvent(event: ProcessedEventWrite): Promise<void> {
    await this.tx.processedEvent.create({
      data: event,
    });
  }

  async upsertOrder(order: OrderWrite): Promise<void> {
    await this.tx.order.upsert({
      where: { id: order.id },
      create: order,
      update: {
        userId: order.userId,
        marketId: order.marketId,
        side: order.side,
        type: order.type,
        timeInForce: order.timeInForce,
        price: order.price,
        quantity: order.quantity,
        remainingQuantity: order.remainingQuantity,
        reduceOnly: order.reduceOnly,
        postOnly: order.postOnly,
        status: order.status,
        rejectionReason: order.rejectionReason ?? null,
        updatedAt: order.updatedAt,
      },
    });
  }

  async updateOrderStatus(update: OrderStatusUpdate): Promise<void> {
    await this.tx.order.updateMany({
      where: { id: update.orderId },
      data: {
        status: update.status,
        remainingQuantity: update.remainingQuantity,
        rejectionReason: update.rejectionReason,
        updatedAt: update.updatedAt,
      },
    });
  }

  async createFills(fills: FillWrite[]): Promise<void> {
    if (fills.length === 0) {
      return;
    }

    await this.tx.fill.createMany({
      data: fills,
      skipDuplicates: true,
    });
  }
}
