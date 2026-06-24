import type { Channel } from "./types";

export function topicFor(input: {
  channel: Channel;
  market?: string;
  userId?: string;
}): string {
  switch (input.channel) {
    case "trades":
    case "orderbook":
    case "mark_price":
    case "funding":
      if (!input.market) {
        throw new Error(`${input.channel} subscriptions require a market`);
      }

      return `${input.channel}:${input.market}`;

    case "positions":
    case "balances":
    case "orders":
      if (!input.userId) {
        throw new Error(`${input.channel} subscriptions require an authenticated user`);
      }

      return `${input.channel}:${input.userId}`;
  }
}

export function isPrivateChannel(channel: Channel): boolean {
  return channel === "positions" || channel === "balances" || channel === "orders";
}
