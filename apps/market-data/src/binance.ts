import { PRICE_UPDATED_STREAM, type StreamBus } from "../../../packages/runtime/src/index";

export interface MarketSymbolMapping {
  binanceSymbol: string;
  marketId: string;
}

export interface PriceUpdatedEvent {
  type: "price.updated";
  marketId: string;
  symbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  eventTime: number;
  nextFundingTime?: number;
}

export function parseBinanceMarkPriceMessage(
  raw: string,
  mappings: MarketSymbolMapping[],
): PriceUpdatedEvent | null {
  const parsed = JSON.parse(raw) as { data?: unknown } | unknown;
  const data = (parsed as { data?: unknown }).data ?? parsed;

  if (!data || typeof data !== "object") {
    return null;
  }

  const message = data as Record<string, unknown>;
  const symbol = String(message["s"] ?? "").toUpperCase();
  const mapping = mappings.find((candidate) => candidate.binanceSymbol === symbol);

  if (!mapping) {
    return null;
  }

  const markPrice = Number(message["p"]);
  const indexPrice = Number(message["i"] ?? message["p"]);
  const fundingRate = Number(message["r"] ?? 0);
  const eventTime = Number(message["E"] ?? Date.now());
  const nextFundingTime = message["T"] == null ? undefined : Number(message["T"]);

  if (!Number.isFinite(markPrice) || markPrice <= 0 || !Number.isFinite(indexPrice)) {
    return null;
  }

  return {
    type: "price.updated",
    marketId: mapping.marketId,
    symbol,
    markPrice,
    indexPrice,
    fundingRate: Number.isFinite(fundingRate) ? fundingRate : 0,
    eventTime,
    nextFundingTime: Number.isFinite(nextFundingTime) ? nextFundingTime : undefined,
  };
}

export class BinanceMarketDataService {
  private stopped = false;

  constructor(
    private readonly options: {
      url: string;
      mappings: MarketSymbolMapping[];
      bus: StreamBus;
      reconnectBaseMs?: number;
      reconnectMaxMs?: number;
    },
  ) {}

  start(): void {
    this.connect(0);
  }

  stop(): void {
    this.stopped = true;
  }

  private connect(attempt: number): void {
    if (this.stopped) {
      return;
    }

    const socket = new WebSocket(buildStreamUrl(this.options.url, this.options.mappings));

    socket.onopen = () => {
      console.log("Binance market-data websocket connected");
    };

    socket.onmessage = (message) => {
      void this.publishMessage(String(message.data));
    };

    socket.onerror = (event) => {
      console.error("Binance market-data websocket error", event);
    };

    socket.onclose = () => {
      if (this.stopped) {
        return;
      }

      const delay = Math.min(
        (this.options.reconnectBaseMs ?? 500) * 2 ** attempt,
        this.options.reconnectMaxMs ?? 30_000,
      );
      console.error(`Binance market-data websocket closed; reconnecting in ${delay}ms`);
      setTimeout(() => this.connect(attempt + 1), delay);
    };
  }

  private async publishMessage(raw: string): Promise<void> {
    try {
      const event = parseBinanceMarkPriceMessage(raw, this.options.mappings);

      if (event) {
        await this.options.bus.append(PRICE_UPDATED_STREAM, event);
      }
    } catch (error) {
      console.error("Skipping malformed Binance market-data message", error);
    }
  }
}

export function buildStreamUrl(
  baseUrl: string,
  mappings: MarketSymbolMapping[],
): string {
  const streams = mappings
    .map((mapping) => `${mapping.binanceSymbol.toLowerCase()}@markPrice`)
    .join("/");

  if (baseUrl.includes("{streams}")) {
    return baseUrl.replace("{streams}", streams);
  }

  if (baseUrl.includes("?")) {
    return `${baseUrl}&streams=${streams}`;
  }

  return `${baseUrl.replace(/\/$/, "")}/stream?streams=${streams}`;
}
