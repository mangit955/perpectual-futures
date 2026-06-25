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
import { getBinancePriceStream, fetchBinanceSOLPrice } from "../binance-price";

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
  private binancePriceStream: ReturnType<typeof getBinancePriceStream> | null = null;
  private binancePriceUnsubscribe: (() => void) | null = null;

  constructor() {
    // Initialize with a default price
    this.lastPrice = 70.0;
    this.candles = generateCandleData(200);
    this.orderBook = generateOrderBook(this.lastPrice, 15);
    
    // Fetch initial Binance price
    this.initializeBinancePrice();
  }

  private async initializeBinancePrice(): Promise<void> {
    try {
      const realPrice = await fetchBinanceSOLPrice();
      this.lastPrice = realPrice;
      this.orderBook = generateOrderBook(this.lastPrice, 15);
      
      // Update candles to match real price
      const lastCandle = this.candles[this.candles.length - 1];
      if (lastCandle) {
        lastCandle.close = realPrice;
        lastCandle.high = Math.max(lastCandle.high, realPrice);
        lastCandle.low = Math.min(lastCandle.low, realPrice);
      }
      
      console.log(`✅ Initialized with Binance SOL price: $${realPrice.toFixed(2)}`);
    } catch (error) {
      console.error("Failed to initialize Binance price:", error);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Subscribe to Binance real-time price updates
    this.binancePriceStream = getBinancePriceStream();
    this.binancePriceUnsubscribe = this.binancePriceStream.subscribe((price) => {
      // Update lastPrice with real Binance price
      this.lastPrice = price;
      
      // Regenerate orderbook around the new real price
      // This creates a spread around the actual SOL price
      this.orderBook = generateOrderBook(price, 15);
      this.emit("orderbook", this.orderBook);
      
      console.log(`📊 Updated orderbook with Binance price: $${price.toFixed(2)}`);
    });

    // Order book micro-updates: every 500ms (small changes to quantities)
    // This keeps the book feeling "alive" between Binance price updates
    this.intervals.push(
      setInterval(() => {
        // Just perturb the book slightly without changing the base price
        this.orderBook = perturbOrderBook(this.orderBook, true);
        this.emit("orderbook", this.orderBook);
      }, 500)
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
        // Update candle based on current real price
        const updated = updateCandleInPlace(lastCandle, this.lastPrice);
        this.candles[this.candles.length - 1] = updated;
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
    
    // Unsubscribe from Binance price stream
    if (this.binancePriceUnsubscribe) {
      this.binancePriceUnsubscribe();
      this.binancePriceUnsubscribe = null;
    }
    
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
