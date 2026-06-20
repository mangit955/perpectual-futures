import type { StreamMessage } from "./types";

export interface StreamBus {
  append<T>(stream: string, payload: T): Promise<StreamMessage<T>>;
  readAfter<T>(stream: string, afterId?: string, limit?: number): Promise<StreamMessage<T>[]>;
}

export class InMemoryStreamBus implements StreamBus {
  private readonly streams = new Map<string, StreamMessage<unknown>[]>();
  private sequence = 0;

  async append<T>(stream: string, payload: T): Promise<StreamMessage<T>> {
    const message: StreamMessage<T> = {
      id: `${Date.now()}-${++this.sequence}`,
      stream,
      payload,
    };
    const messages = this.streams.get(stream) ?? [];
    messages.push(message as StreamMessage<unknown>);
    this.streams.set(stream, messages);
    return message;
  }

  async readAfter<T>(
    stream: string,
    afterId = "0-0",
    limit = 100,
  ): Promise<StreamMessage<T>[]> {
    const messages = this.streams.get(stream) ?? [];
    const startIndex =
      afterId === "0-0"
        ? 0
        : messages.findIndex((message) => message.id === afterId) + 1;

    return messages
      .slice(Math.max(0, startIndex), Math.max(0, startIndex) + limit)
      .map((message) => message as StreamMessage<T>);
  }
}

export function commandStream(market: string): string {
  return `engine.commands.${market}`;
}

export function eventStream(market: string): string {
  return `engine.events.${market}`;
}
