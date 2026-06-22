import type { CandleData, OrderBookData, RecentTrade, MarketData } from "@/types/trading";
import {
  generateCandleData,
  generateMarketData,
  generateNewTrade,
  generateOrderBook,
  generateRecentTrades,
  perturbOrderBook,
  updateCandleInPlace,
} from "./market-data";

// ─── Event Types ─────────────────────────────────────────────────────────────

type EventMap = {
  orderbook: OrderBookData;
  trade: RecentTrade;
  candle: CandleData;
  market: MarketData;
};

type EventType = keyof EventMap;
type Listener<T extends EventType> = (data: EventMap[T]) => void;

// ─── Mock Market Feed ────────────────────────────────────────────────────────

export class MockMarketFeed {
  private listeners: Map<EventType, Set<Listener<EventType>>> = new Map();
  private intervals: ReturnType<typeof setInterval>[] = [];
  private orderBook: OrderBookData;
  private candles: CandleData[];
  private lastPrice: number;
  private running = false;

  constructor() {
    this.candles = generateCandleData(200);
    const lastCandle = this.candles[this.candles.length - 1]!;
    this.lastPrice = lastCandle.close;
    this.orderBook = generateOrderBook(this.lastPrice, 15);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Order book updates: every 200ms
    this.intervals.push(
      setInterval(() => {
        this.orderBook = perturbOrderBook(this.orderBook);
        this.lastPrice = this.orderBook.midPrice;
        this.emit("orderbook", this.orderBook);
      }, 200)
    );

    // New trades: every 500-1500ms (random)
    const scheduleTradeUpdate = () => {
      const delay = 500 + Math.random() * 1000;
      const timer = setTimeout(() => {
        if (!this.running) return;
        const trade = generateNewTrade(this.lastPrice);
        this.emit("trade", trade);
        scheduleTradeUpdate();
      }, delay);
      // Store as interval for cleanup — we'll clear via running flag
      this.intervals.push(timer as unknown as ReturnType<typeof setInterval>);
    };
    scheduleTradeUpdate();

    // Candle updates: every 1s
    this.intervals.push(
      setInterval(() => {
        const lastCandle = this.candles[this.candles.length - 1]!;
        const updated = updateCandleInPlace(lastCandle);
        this.candles[this.candles.length - 1] = updated;
        this.lastPrice = updated.close;
        this.emit("candle", updated);
      }, 1000)
    );

    // Market data updates: every 2s
    this.intervals.push(
      setInterval(() => {
        const marketData = generateMarketData(this.lastPrice);
        this.emit("market", marketData);
      }, 2000)
    );
  }

  stop(): void {
    this.running = false;
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  subscribe<T extends EventType>(event: T, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event)!;
    listeners.add(listener as Listener<EventType>);

    return () => {
      listeners.delete(listener as Listener<EventType>);
    };
  }

  private emit<T extends EventType>(event: T, data: EventMap[T]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        (listener as Listener<T>)(data);
      }
    }
  }

  // ─── Getters for initial data ────────────────────────────────────────────

  getInitialCandles(): CandleData[] {
    return [...this.candles];
  }

  getInitialOrderBook(): OrderBookData {
    return this.orderBook;
  }

  getInitialTrades(): RecentTrade[] {
    return generateRecentTrades(this.lastPrice, 30);
  }

  getInitialMarketData(): MarketData {
    return generateMarketData(this.lastPrice);
  }

  getLastPrice(): number {
    return this.lastPrice;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let feedInstance: MockMarketFeed | null = null;

export function getMarketFeed(): MockMarketFeed {
  if (!feedInstance) {
    feedInstance = new MockMarketFeed();
  }
  return feedInstance;
}
