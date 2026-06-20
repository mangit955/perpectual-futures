import type { AckingStreamBus, StreamBus } from "./stream";
import { commandStream } from "./stream";
import type { RuntimeCommand } from "./types";

export interface OutboxPublisherClient {
  outboxEvent: {
    findMany(args: {
      where: { status: { in: Array<"PENDING" | "FAILED"> } };
      orderBy: { createdAt: "asc" };
      take: number;
    }): Promise<OutboxRow[]>;
    update(args: {
      where: { id: string };
      data: Partial<{
        status: "PENDING" | "PUBLISHED" | "FAILED";
        attempts: { increment: number };
        lastError: string | null;
        publishedAt: Date | null;
      }>;
    }): Promise<unknown>;
  };
}

export interface OutboxRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: unknown;
}

export class OutboxPublisher {
  constructor(
    private readonly client: OutboxPublisherClient,
    private readonly bus: StreamBus | AckingStreamBus,
  ) {}

  async publishOnce(limit = 100): Promise<number> {
    const rows = await this.client.outboxEvent.findMany({
      where: { status: { in: ["PENDING", "FAILED"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    let published = 0;

    for (const row of rows) {
      try {
        const command = runtimeCommandFromOutbox(row);
        await this.bus.append(commandStream(commandMarket(command)), command);
        await this.client.outboxEvent.update({
          where: { id: row.id },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            lastError: null,
          },
        });
        published += 1;
      } catch (error) {
        await this.client.outboxEvent.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return published;
  }
}

function runtimeCommandFromOutbox(row: OutboxRow): RuntimeCommand {
  const payload = row.payload as RuntimeCommand | { type?: string; command?: unknown };

  if (
    payload.type === "order.created" ||
    payload.type === "order.cancelled"
  ) {
    return payload as RuntimeCommand;
  }

  throw new Error(`unsupported outbox event type: ${row.type}`);
}

function commandMarket(command: RuntimeCommand): string {
  return command.command.market;
}
