"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CandleData, MarketData, OrderBookData, RecentTrade } from "@/types/trading";
import { OrderSide } from "@/types/trading";
import { getMarketFeed, MockMarketFeed } from "@/lib/mock/websocket";
import { apiGetOrderBook, convertOrderBookToFrontend } from "@/lib/api";
import { useWebSocketListener, useWebSocketSubscription } from "./use-websocket";

// ─── Configuration ────────────────────────────────────────────────────────────

const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === "true";
const DEFAULT_MARKET_ID = "BTC-PERP"; // Use the seeded market

// ─── Shared feed hook ────────────────────────────────────────────────────────

function useFeed(): MockMarketFeed {
  const feedRef = useRef<MockMarketFeed | null>(null);

  if (!feedRef.current) {
    feedRef.current = getMarketFeed();
  }

  useEffect(() => {
    const feed = feedRef.current!;
    feed.start();
    return () => {
      // Don't stop the feed on unmount — it's a singleton shared across components.
      // It will be stopped when the page unmounts entirely.
    };
  }, []);

  return feedRef.current!;
}

// ─── useOrderBook ────────────────────────────────────────────────────────────

export function useOrderBook(): OrderBookData | null {
  const feed = useFeed();
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);

  // Use WebSocket subscription when real API is enabled
  const { data: wsOrderBook } = useWebSocketSubscription<{
    market: string;
    sequence: number;
    bids: Array<{ priceTicks: number; totalQtyLots: number }>;
    asks: Array<{ priceTicks: number; totalQtyLots: number }>;
  }>("orderbook", DEFAULT_MARKET_ID, undefined, USE_REAL_API);

  useEffect(() => {
    if (USE_REAL_API) {
      if (wsOrderBook) {
        // Convert WebSocket data to frontend format
        const frontendBook = convertOrderBookToFrontend(wsOrderBook);
        setOrderBook(frontendBook);
      } else {
        // Fetch initial orderbook data from API
        const fetchOrderBook = async () => {
          try {
            const backendBook = await apiGetOrderBook(DEFAULT_MARKET_ID, 15);
            const frontendBook = convertOrderBookToFrontend(backendBook);
            setOrderBook(frontendBook);
          } catch (error) {
            console.error("Failed to fetch orderbook:", error);
          }
        };
        fetchOrderBook();
      }
    } else {
      // Use mock data
      setOrderBook(feed.getInitialOrderBook());
      const unsub = feed.subscribe("orderbook", (data) => {
        setOrderBook(data);
      });
      return unsub;
    }
  }, [feed, wsOrderBook]);

  return orderBook;
}

// ─── useRecentTrades ─────────────────────────────────────────────────────────

export function useRecentTrades(maxTrades: number = 50): RecentTrade[] {
  const feed = useFeed();
  const [trades, setTrades] = useState<RecentTrade[]>([]);

  // Listen for trade updates via WebSocket
  useWebSocketListener<{
    tradeId: string;
    price: number;
    quantity: number;
    side: "buy" | "sell";
    timestamp: number;
  }>(
    "trades",
    DEFAULT_MARKET_ID,
    (trade) => {
      const recentTrade: RecentTrade = {
        id: trade.tradeId,
        price: trade.price,
        size: trade.quantity,
        side: trade.side === "buy" ? OrderSide.Buy : OrderSide.Sell,
        timestamp: trade.timestamp,
      };
      setTrades((prev) => [recentTrade, ...prev].slice(0, maxTrades));
    },
    undefined,
    USE_REAL_API
  );

  useEffect(() => {
    if (!USE_REAL_API) {
      setTrades(feed.getInitialTrades());
      const unsub = feed.subscribe("trade", (trade) => {
        setTrades((prev) => [trade, ...prev].slice(0, maxTrades));
      });
      return unsub;
    }
  }, [feed, maxTrades]);

  return trades;
}

// ─── useCandleData ───────────────────────────────────────────────────────────

export function useCandleData(): {
  candles: CandleData[];
  latestCandle: CandleData | null;
} {
  const feed = useFeed();
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [latestCandle, setLatestCandle] = useState<CandleData | null>(null);

  useEffect(() => {
    const initialCandles = feed.getInitialCandles();
    setCandles(initialCandles);
    if (initialCandles.length > 0) {
      setLatestCandle(initialCandles[initialCandles.length - 1]!);
    }

    const unsub = feed.subscribe("candle", (candle) => {
      setLatestCandle(candle);
      setCandles((prev) => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1]!.time === candle.time) {
          updated[updated.length - 1] = candle;
        } else {
          updated.push(candle);
        }
        return updated;
      });
    });
    return unsub;
  }, [feed]);

  return { candles, latestCandle };
}

// ─── useMarketData ───────────────────────────────────────────────────────────

export function useMarketData(): MarketData | null {
  const feed = useFeed();
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  useEffect(() => {
    setMarketData(feed.getInitialMarketData());
    const unsub = feed.subscribe("market", (data) => {
      setMarketData(data);
    });
    return unsub;
  }, [feed]);

  return marketData;
}

// ─── useLastPrice ────────────────────────────────────────────────────────────

export function useLastPrice(): number {
  const feed = useFeed();
  const [price, setPrice] = useState<number>(feed.getLastPrice());

  useEffect(() => {
    const unsub = feed.subscribe("candle", (candle) => {
      setPrice(candle.close);
    });
    return unsub;
  }, [feed]);

  return price;
}

// ─── Cleanup hook for page-level unmount ──────────────────────────────────────

export function useMarketFeedCleanup(): void {
  useEffect(() => {
    const feed = getMarketFeed();
    feed.start();
    return () => {
      feed.stop();
    };
  }, []);
}

// ─── Format helpers ──────────────────────────────────────────────────────────

export function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
