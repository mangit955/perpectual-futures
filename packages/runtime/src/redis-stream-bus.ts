import type { AckingStreamBus } from "./stream";
import type { StreamMessage } from "./types";

export interface RedisCommandExecutor {
  send(command: string, args: string[]): Promise<unknown>;
}

export interface RedisStreamBusOptions {
  redis?: RedisCommandExecutor;
  redisUrl?: string;
  createGroups?: boolean;
}

export class RedisStreamBus implements AckingStreamBus {
  private readonly redis: RedisCommandExecutor;
  private readonly createGroups: boolean;
  private readonly createdGroups = new Set<string>();

  constructor(options: RedisStreamBusOptions = {}) {
    this.redis = options.redis ?? createBunRedis(options.redisUrl);
    this.createGroups = options.createGroups ?? true;
  }

  async append<T>(stream: string, payload: T): Promise<StreamMessage<T>> {
    const id = await this.command("XADD", [
      stream,
      "*",
      "payload",
      JSON.stringify(payload),
    ]);

    return {
      id: String(id),
      stream,
      payload,
    };
  }

  async readAfter<T>(
    stream: string,
    afterId = "0-0",
    limit = 100,
  ): Promise<StreamMessage<T>[]> {
    const rows = await this.command("XRANGE", [
      stream,
      `(${afterId}`,
      "+",
      "COUNT",
      String(limit),
    ]);

    return decodeRedisStreamRows(stream, rows);
  }

  async readGroup<T>(
    stream: string,
    group: string,
    consumer: string,
    options: { count?: number; blockMs?: number } = {},
  ): Promise<StreamMessage<T>[]> {
    if (this.createGroups) {
      await this.ensureGroup(stream, group);
    }

    const rows = await this.command("XREADGROUP", [
      "GROUP",
      group,
      consumer,
      "COUNT",
      String(options.count ?? 100),
      "BLOCK",
      String(options.blockMs ?? 1000),
      "STREAMS",
      stream,
      ">",
    ]);

    return decodeXReadGroupRows(stream, rows);
  }

  async ack(stream: string, group: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.command("XACK", [stream, group, ...ids]);
  }

  private async ensureGroup(stream: string, group: string): Promise<void> {
    const key = `${stream}:${group}`;

    if (this.createdGroups.has(key)) {
      return;
    }

    try {
      await this.command("XGROUP", [
        "CREATE",
        stream,
        group,
        "0",
        "MKSTREAM",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes("BUSYGROUP")) {
        throw error;
      }
    }

    this.createdGroups.add(key);
  }

  private command(command: string, args: string[]): Promise<unknown> {
    return this.redis.send(command, args);
  }
}

function createBunRedis(redisUrl: string | undefined): RedisCommandExecutor {
  const bunWithRedis = Bun as unknown as {
    redis?: RedisCommandExecutor;
    RedisClient?: new (url?: string) => RedisCommandExecutor;
  };

  if (bunWithRedis.RedisClient) {
    return new bunWithRedis.RedisClient(redisUrl);
  }

  if (bunWithRedis.redis) {
    return bunWithRedis.redis;
  }

  throw new Error("Bun Redis client is unavailable in this runtime");
}

function decodeXReadGroupRows<T>(
  fallbackStream: string,
  rows: unknown,
): StreamMessage<T>[] {
  const result: StreamMessage<T>[] = [];

  if (!Array.isArray(rows)) {
    return result;
  }

  for (const streamRow of rows) {
    if (!Array.isArray(streamRow)) {
      continue;
    }

    const stream = String(streamRow[0] ?? fallbackStream);
    const messages = streamRow[1];

    if (Array.isArray(messages)) {
      result.push(...decodeRedisStreamRows<T>(stream, messages));
    }
  }

  return result;
}

function decodeRedisStreamRows<T>(
  stream: string,
  rows: unknown,
): StreamMessage<T>[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    if (!Array.isArray(row)) {
      return [];
    }

    const id = String(row[0]);
    const fields = Array.isArray(row[1]) ? row[1] : [];
    const payloadIndex = fields.findIndex((field) => String(field) === "payload");
    const rawPayload = payloadIndex >= 0 ? fields[payloadIndex + 1] : undefined;

    if (rawPayload == null) {
      return [];
    }

    return [{
      id,
      stream,
      payload: JSON.parse(String(rawPayload)) as T,
    }];
  });
}
