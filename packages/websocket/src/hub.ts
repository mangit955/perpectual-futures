import { isPrivateChannel, topicFor } from "./topics";
import type {
  Authenticator,
  ClientConnection,
  PublishInput,
  ServerMessage,
  SubscribeMessage,
  SubscriptionSnapshot,
  UnsubscribeMessage,
} from "./types";

export class WebSocketHub {
  private readonly connections = new Map<string, ClientConnection>();
  private readonly topicsByConnection = new Map<string, Set<string>>();
  private readonly connectionsByTopic = new Map<string, Set<string>>();

  constructor(private readonly authenticate: Authenticator = allowAnonymous) {}

  connect(connection: ClientConnection): void {
    this.connections.set(connection.id, connection);
    this.topicsByConnection.set(connection.id, new Set());
  }

  disconnect(connectionId: string): void {
    const topics = this.topicsByConnection.get(connectionId) ?? new Set();

    for (const topic of topics) {
      const subscribers = this.connectionsByTopic.get(topic);
      subscribers?.delete(connectionId);

      if (subscribers?.size === 0) {
        this.connectionsByTopic.delete(topic);
      }
    }

    this.topicsByConnection.delete(connectionId);
    this.connections.delete(connectionId);
  }

  subscribe(connectionId: string, message: SubscribeMessage): ServerMessage {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return errorMessage("connection not found");
    }

    const auth = isPrivateChannel(message.channel)
      ? this.authenticate(message.token)
      : { ok: true };

    if (!auth.ok) {
      return errorMessage(auth.reason ?? "unauthorized");
    }

    if (auth.userId) {
      connection.userId = auth.userId;
    }

    let topic: string;

    try {
      topic = topicFor({
        channel: message.channel,
        market: message.market,
        userId: isPrivateChannel(message.channel) ? connection.userId : undefined,
      });
    } catch (error) {
      return errorMessage(error instanceof Error ? error.message : "invalid subscription");
    }

    this.topicsByConnection.get(connectionId)?.add(topic);

    let subscribers = this.connectionsByTopic.get(topic);

    if (!subscribers) {
      subscribers = new Set();
      this.connectionsByTopic.set(topic, subscribers);
    }

    subscribers.add(connectionId);

    const response: ServerMessage = {
      type: "subscribed",
      channel: message.channel,
      topic,
    };

    sendJson(connection, response);
    return response;
  }

  unsubscribe(
    connectionId: string,
    message: UnsubscribeMessage,
  ): ServerMessage {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return errorMessage("connection not found");
    }

    let topic: string;

    try {
      topic = topicFor({
        channel: message.channel,
        market: message.market,
        userId: isPrivateChannel(message.channel) ? connection.userId : undefined,
      });
    } catch (error) {
      return errorMessage(error instanceof Error ? error.message : "invalid subscription");
    }

    this.topicsByConnection.get(connectionId)?.delete(topic);
    const subscribers = this.connectionsByTopic.get(topic);
    subscribers?.delete(connectionId);

    if (subscribers?.size === 0) {
      this.connectionsByTopic.delete(topic);
    }

    const response: ServerMessage = {
      type: "unsubscribed",
      channel: message.channel,
      topic,
    };

    sendJson(connection, response);
    return response;
  }

  publish(input: PublishInput): number {
    const topic = topicFor(input);
    const subscribers = this.connectionsByTopic.get(topic);

    if (!subscribers) {
      return 0;
    }

    const message: ServerMessage = {
      type: "update",
      channel: input.channel,
      topic,
      sequence: input.sequence,
      data: input.data,
    };

    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);

      if (connection) {
        sendJson(connection, message);
      }
    }

    return subscribers.size;
  }

  sendSnapshot(connectionId: string, topic: string, data: unknown, sequence: number): boolean {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return false;
    }

    sendJson(connection, {
      type: "snapshot",
      topic,
      sequence,
      data,
    });
    return true;
  }

  sendResync(topic: string, reason: string): number {
    const subscribers = this.connectionsByTopic.get(topic);

    if (!subscribers) {
      return 0;
    }

    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);

      if (connection) {
        sendJson(connection, {
          type: "resync",
          topic,
          reason,
        });
      }
    }

    return subscribers.size;
  }

  subscriptions(): SubscriptionSnapshot[] {
    return [...this.topicsByConnection.entries()].map(
      ([connectionId, topics]) => ({
        connectionId,
        topics: [...topics].sort(),
      }),
    );
  }
}

function sendJson(connection: ClientConnection, message: ServerMessage): void {
  connection.send(JSON.stringify(message));
}

function errorMessage(reason: string): ServerMessage {
  return {
    type: "error",
    reason,
  };
}

function allowAnonymous(): { ok: true } {
  return { ok: true };
}
