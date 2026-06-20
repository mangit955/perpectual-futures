import type {
  FillWrite,
  OrderStatusUpdate,
  OrderWrite,
  ProcessedEventWrite,
} from "./records";

export interface PersistenceStore {
  transaction<T>(
    callback: (tx: PersistenceTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface PersistenceTransaction {
  findProcessedEvent(eventId: string): Promise<ProcessedEventWrite | null>;
  createProcessedEvent(event: ProcessedEventWrite): Promise<void>;
  upsertOrder(order: OrderWrite): Promise<void>;
  updateOrderStatus(update: OrderStatusUpdate): Promise<void>;
  createFills(fills: FillWrite[]): Promise<void>;
}
