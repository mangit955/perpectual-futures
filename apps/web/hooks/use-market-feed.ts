"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CandleData, MarketData, OrderBookData, RecentTrade } from "@/types/trading";
import { getMarketFeed, MockMarketFeed } from "@/lib/mock/websocket";

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

  useEffect(() => {
    setOrderBook(feed.getInitialOrderBook());
    const unsub = feed.subscribe("orderbook", (data) => {
      setOrderBook(data);
    });
    return unsub;
  }, [feed]);

  return orderBook;
}

// ─── useRecentTrades ─────────────────────────────────────────────────────────

export function useRecentTrades(maxTrades: number = 50): RecentTrade[] {
  const feed = useFeed();
  const [trades, setTrades] = useState<RecentTrade[]>([]);

  useEffect(() => {
    setTrades(feed.getInitialTrades());
    const unsub = feed.subscribe("trade", (trade) => {
      setTrades((prev) => [trade, ...prev].slice(0, maxTrades));
    });
    return unsub;
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
