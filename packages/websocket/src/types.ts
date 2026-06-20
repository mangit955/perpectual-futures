export type PublicChannel = "trades" | "orderbook" | "mark_price" | "funding";
export type PrivateChannel = "positions";
export type Channel = PublicChannel | PrivateChannel;

export interface SubscribeMessage {
  op: "subscribe";
  channel: Channel;
  market?: string;
  token?: string;
}

export interface UnsubscribeMessage {
  op: "unsubscribe";
  channel: Channel;
  market?: string;
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage;

export interface ServerMessage {
  type:
    | "subscribed"
    | "unsubscribed"
    | "error"
    | "snapshot"
    | "update"
    | "resync";
  channel?: Channel;
  topic?: string;
  sequence?: number;
  data?: unknown;
  reason?: string;
}

export interface ClientConnection {
  id: string;
  userId?: string;
  send(message: string): void;
}

export interface PublishInput {
  channel: Channel;
  market?: string;
  userId?: string;
  sequence?: number;
  data: unknown;
}

export interface SubscriptionSnapshot {
  connectionId: string;
  topics: string[];
}

export interface AuthResult {
  ok: boolean;
  userId?: string;
  reason?: string;
}

export type Authenticator = (token: string | undefined) => AuthResult;
