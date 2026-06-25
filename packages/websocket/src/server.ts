import { WebSocketHub } from "./hub";
import type { Authenticator, ClientMessage } from "./types";

interface SocketData {
  connectionId: string;
}

export interface CreateWebSocketServerOptions {
  port: number;
  hub?: WebSocketHub;
  authenticate?: Authenticator;
}

export function createWebSocketServer(options: CreateWebSocketServerOptions) {
  const hub =
    options.hub ?? new WebSocketHub(options.authenticate ?? (() => ({ ok: true })));

  const server = Bun.serve<SocketData>({
    port: options.port,
    fetch(request, server) {
      if (handleUpgrade(request, server)) {
        return undefined;
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: getWebSocketHandlers(hub),
  });

  return { server, hub };
}

export function handleUpgrade(request: Request, server: any): boolean {
  const url = new URL(request.url);

  if (url.pathname !== "/ws") {
    return false;
  }

  const connectionId = crypto.randomUUID();
  const upgraded = server.upgrade(request, {
    data: { connectionId },
  });

  return upgraded;
}

export function getWebSocketHandlers(hub: WebSocketHub) {
  return {
    open(socket: any) {
      hub.connect({
        id: socket.data.connectionId,
        send(message) {
          socket.send(message);
        },
      });
    },
    message(socket: any, rawMessage: string | Buffer) {
      const message = parseClientMessage(rawMessage);

      if (!message) {
        socket.send(
          JSON.stringify({
            type: "error",
            reason: "invalid websocket message",
          }),
        );
        return;
      }

      if (message.op === "subscribe") {
        hub.subscribe(socket.data.connectionId, message);
      } else {
        hub.unsubscribe(socket.data.connectionId, message);
      }
    },
    close(socket: any) {
      hub.disconnect(socket.data.connectionId);
    },
  };
}

function parseClientMessage(rawMessage: string | Buffer): ClientMessage | null {
  try {
    const parsed = JSON.parse(String(rawMessage)) as Partial<ClientMessage>;

    if (
      parsed.op !== "subscribe" &&
      parsed.op !== "unsubscribe"
    ) {
      return null;
    }

    if (
      parsed.channel !== "trades" &&
      parsed.channel !== "orderbook" &&
      parsed.channel !== "positions" &&
      parsed.channel !== "balances" &&
      parsed.channel !== "orders" &&
      parsed.channel !== "mark_price" &&
      parsed.channel !== "funding"
    ) {
      return null;
    }

    return parsed as ClientMessage;
  } catch {
    return null;
  }
}
