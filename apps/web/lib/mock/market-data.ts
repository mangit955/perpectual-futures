import type {
  CandleData,
  MarketData,
  OpenOrder,
  OrderBookData,
  OrderBookEntry,
  OrderHistoryEntry,
  Position,
  RecentTrade,
  TickerItem,
  TradeHistoryEntry,
} from "@/types/trading";
import { OrderSide, OrderType, PositionSide } from "@/types/trading";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max));
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

let tradeIdCounter = 1000;

export function generateTradeId(): string {
  return `T${++tradeIdCounter}`;
}

let orderIdCounter = 5000;

export function generateOrderId(): string {
  return `O${++orderIdCounter}`;
}

// ─── Candle Data ─────────────────────────────────────────────────────────────

export function generateCandleData(count: number = 200): CandleData[] {
  const candles: CandleData[] = [];
  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds = 3600; // 1h candles
  let price = 68 + Math.random() * 4; // Start around 68-72

  for (let i = count; i > 0; i--) {
    const time = now - i * intervalSeconds;
    const open = price;
    const changePercent = (Math.random() - 0.48) * 0.04; // slight upward bias
    const close = roundTo(open * (1 + changePercent), 2);
    const high = roundTo(Math.max(open, close) * (1 + Math.random() * 0.015), 2);
    const low = roundTo(Math.min(open, close) * (1 - Math.random() * 0.015), 2);
    const volume = roundTo(rand(50, 2000), 2);

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }

  return candles;
}

export function generateNextCandle(lastCandle: CandleData): CandleData {
  const changePercent = (Math.random() - 0.48) * 0.02;
  const open = lastCandle.close;
  const close = roundTo(open * (1 + changePercent), 2);
  const high = roundTo(Math.max(open, close) * (1 + Math.random() * 0.008), 2);
  const low = roundTo(Math.min(open, close) * (1 - Math.random() * 0.008), 2);
  const volume = roundTo(rand(50, 800), 2);

  return {
    time: lastCandle.time + 3600,
    open,
    high,
    low,
    close,
    volume,
  };
}

export function updateCandleInPlace(candle: CandleData, targetPrice?: number): CandleData {
  let newClose: number;
  
  if (targetPrice !== undefined) {
    // Move towards the target price (Binance real price)
    const diff = targetPrice - candle.close;
    const move = diff * 0.1; // Move 10% of the way towards target
    newClose = roundTo(candle.close + move, 2);
  } else {
    // Random walk
    const tick = (Math.random() - 0.5) * 0.1;
    newClose = roundTo(candle.close + tick, 2);
  }

  return {
    ...candle,
    close: newClose,
    high: Math.max(candle.high, newClose),
    low: Math.min(candle.low, newClose),
    volume: roundTo(candle.volume + rand(0.5, 5), 2),
  };
}

// ─── Order Book ──────────────────────────────────────────────────────────────

export function generateOrderBook(midPrice: number, levels: number = 15): OrderBookData {
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];
  const tickSize = 0.01;

  // Generate asks (ascending from mid)
  let askCumulative = 0;
  for (let i = 1; i <= levels; i++) {
    const price = roundTo(midPrice + i * tickSize, 2);
    const size = roundTo(rand(5, 5000), 2);
    askCumulative += size;
    asks.push({ price, size, total: roundTo(askCumulative, 2) });
  }

  // Generate bids (descending from mid)
  let bidCumulative = 0;
  for (let i = 1; i <= levels; i++) {
    const price = roundTo(midPrice - i * tickSize, 2);
    const size = roundTo(rand(5, 5000), 2);
    bidCumulative += size;
    bids.push({ price, size, total: roundTo(bidCumulative, 2) });
  }

  const spread = roundTo(asks[0]!.price - bids[0]!.price, 2);
  const spreadPercentage = roundTo((spread / midPrice) * 100, 4);

  return {
    asks: asks.reverse(), // highest ask first, so we display top-down
    bids,
    spread,
    spreadPercentage,
    midPrice: roundTo(midPrice, 2),
  };
}

export function perturbOrderBook(book: OrderBookData, microChangesOnly: boolean = false): OrderBookData {
  if (microChangesOnly) {
    // Only update quantities, keep prices stable
    const asks = book.asks.map(entry => ({
      ...entry,
      size: roundTo(entry.size + (Math.random() - 0.5) * entry.size * 0.1, 2),
    }));
    
    const bids = book.bids.map(entry => ({
      ...entry,
      size: roundTo(entry.size + (Math.random() - 0.5) * entry.size * 0.1, 2),
    }));
    
    // Recalculate totals
    let askCumulative = 0;
    for (const entry of asks) {
      askCumulative += entry.size;
      entry.total = roundTo(askCumulative, 2);
    }
    
    let bidCumulative = 0;
    for (const entry of bids) {
      bidCumulative += entry.size;
      entry.total = roundTo(bidCumulative, 2);
    }
    
    return {
      ...book,
      asks,
      bids,
    };
  }
  
  // Original behavior: drift the price
  const drift = (Math.random() - 0.5) * 0.04;
  const newMid = roundTo(book.midPrice + drift, 2);
  return generateOrderBook(newMid, book.asks.length);
}

// ─── Recent Trades ───────────────────────────────────────────────────────────

export function generateRecentTrades(midPrice: number, count: number = 30): RecentTrade[] {
  const trades: RecentTrade[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.5 ? OrderSide.Buy : OrderSide.Sell;
    const priceOffset = (Math.random() - 0.5) * 0.1;
    trades.push({
      id: generateTradeId(),
      price: roundTo(midPrice + priceOffset, 2),
      size: roundTo(rand(0.1, 50), 2),
      side,
      timestamp: now - i * randInt(200, 2000),
    });
  }

  return trades;
}

export function generateNewTrade(midPrice: number): RecentTrade {
  const side = Math.random() > 0.5 ? OrderSide.Buy : OrderSide.Sell;
  const priceOffset = (Math.random() - 0.5) * 0.06;
  return {
    id: generateTradeId(),
    price: roundTo(midPrice + priceOffset, 2),
    size: roundTo(rand(0.1, 50), 2),
    side,
    timestamp: Date.now(),
  };
}

// ─── Market Data ─────────────────────────────────────────────────────────────

export function generateMarketData(lastPrice: number): MarketData {
  return {
    symbol: "SOL-PERP",
    lastPrice: roundTo(lastPrice, 2),
    markPrice: roundTo(lastPrice + (Math.random() - 0.5) * 0.02, 2),
    indexPrice: roundTo(lastPrice + (Math.random() - 0.5) * 0.05, 2),
    change24h: roundTo(lastPrice * 0.0158 + rand(-0.5, 0.5), 2),
    changePercent24h: roundTo(1.58 + rand(-0.8, 0.8), 2),
    high24h: roundTo(lastPrice + rand(0.5, 1.5), 2),
    low24h: roundTo(lastPrice - rand(2, 4), 2),
    volume24h: roundTo(rand(8000000, 12000000), 2),
    openInterest: roundTo(rand(200000, 260000), 2),
    fundingRate: roundTo(rand(0.0005, 0.002), 4),
    fundingCountdown: "00:46:11",
    maxLeverage: 50,
  };
}

// ─── Positions ───────────────────────────────────────────────────────────────

export function generatePositions(): Position[] {
  return [
    {
      id: "P001",
      symbol: "SOL-PERP",
      side: PositionSide.Long,
      size: 25,
      entryPrice: 71.45,
      markPrice: 73.22,
      liquidationPrice: 58.12,
      margin: 178.63,
      leverage: 10,
      unrealizedPnl: 44.25,
      unrealizedPnlPercent: 24.78,
      realizedPnl: 12.5,
      timestamp: Date.now() - 3600000 * 4,
    },
    {
      id: "P002",
      symbol: "ETH-PERP",
      side: PositionSide.Short,
      size: 2,
      entryPrice: 3850.0,
      markPrice: 3825.0,
      liquidationPrice: 4200.0,
      margin: 770.0,
      leverage: 10,
      unrealizedPnl: 50.0,
      unrealizedPnlPercent: 6.49,
      realizedPnl: -5.2,
      timestamp: Date.now() - 3600000 * 12,
    },
  ];
}

// ─── Open Orders ─────────────────────────────────────────────────────────────

export function generateOpenOrders(): OpenOrder[] {
  return [
    {
      id: "O1001",
      symbol: "SOL-PERP",
      side: OrderSide.Buy,
      type: OrderType.Limit,
      price: 72.0,
      size: 10,
      filled: 0,
      remaining: 10,
      status: "open",
      timestamp: Date.now() - 600000,
      reduceOnly: false,
      postOnly: true,
    },
    {
      id: "O1002",
      symbol: "SOL-PERP",
      side: OrderSide.Sell,
      type: OrderType.Limit,
      price: 75.5,
      size: 15,
      filled: 3,
      remaining: 12,
      status: "partially_filled",
      timestamp: Date.now() - 1200000,
      reduceOnly: false,
      postOnly: false,
    },
    {
      id: "O1003",
      symbol: "ETH-PERP",
      side: OrderSide.Buy,
      type: OrderType.Conditional,
      price: 3700.0,
      size: 1,
      filled: 0,
      remaining: 1,
      status: "open",
      timestamp: Date.now() - 1800000,
      reduceOnly: true,
      postOnly: false,
    },
  ];
}

// ─── Order History ───────────────────────────────────────────────────────────

export function generateOrderHistory(): OrderHistoryEntry[] {
  return [
    {
      id: "O0990",
      symbol: "SOL-PERP",
      side: OrderSide.Buy,
      type: OrderType.Market,
      price: 71.45,
      size: 25,
      filled: 25,
      status: "filled",
      fee: 0.89,
      timestamp: Date.now() - 3600000 * 4,
    },
    {
      id: "O0985",
      symbol: "SOL-PERP",
      side: OrderSide.Sell,
      type: OrderType.Limit,
      price: 74.0,
      size: 10,
      filled: 0,
      status: "cancelled",
      fee: 0,
      timestamp: Date.now() - 3600000 * 8,
    },
    {
      id: "O0980",
      symbol: "ETH-PERP",
      side: OrderSide.Sell,
      type: OrderType.Market,
      price: 3850.0,
      size: 2,
      filled: 2,
      status: "filled",
      fee: 3.85,
      timestamp: Date.now() - 3600000 * 12,
    },
    {
      id: "O0970",
      symbol: "BTC-PERP",
      side: OrderSide.Buy,
      type: OrderType.Limit,
      price: 104200.0,
      size: 0.05,
      filled: 0.05,
      status: "filled",
      fee: 2.6,
      timestamp: Date.now() - 3600000 * 24,
    },
  ];
}

// ─── Trade History ───────────────────────────────────────────────────────────

export function generateTradeHistory(): TradeHistoryEntry[] {
  return [
    {
      id: "TH001",
      symbol: "SOL-PERP",
      side: OrderSide.Buy,
      price: 71.45,
      size: 25,
      fee: 0.89,
      realizedPnl: 0,
      timestamp: Date.now() - 3600000 * 4,
    },
    {
      id: "TH002",
      symbol: "ETH-PERP",
      side: OrderSide.Sell,
      price: 3850.0,
      size: 2,
      fee: 3.85,
      realizedPnl: -15.2,
      timestamp: Date.now() - 3600000 * 12,
    },
    {
      id: "TH003",
      symbol: "BTC-PERP",
      side: OrderSide.Buy,
      price: 104200.0,
      size: 0.05,
      fee: 2.6,
      realizedPnl: 125.5,
      timestamp: Date.now() - 3600000 * 24,
    },
    {
      id: "TH004",
      symbol: "SOL-PERP",
      side: OrderSide.Sell,
      price: 69.8,
      size: 50,
      fee: 1.75,
      realizedPnl: -32.0,
      timestamp: Date.now() - 3600000 * 36,
    },
  ];
}

// ─── Ticker Tape ─────────────────────────────────────────────────────────────

export function generateTickerItems(): TickerItem[] {
  return [
    { symbol: "AERO-PERP", price: 0.54944, change: 0.0648, changePercent: 13.34 },
    { symbol: "FOGO-PERP", price: 0.012898, change: 0.000352, changePercent: 2.81 },
    { symbol: "PENGU-PERP", price: 0.006797, change: 0.00002, changePercent: 0.03 },
    { symbol: "W-PERP", price: 0.01079, change: 0.001327, changePercent: 14.01 },
    { symbol: "ZORA-PERP", price: 0.007866, change: 0.000008, changePercent: 0.1 },
    { symbol: "SKR-F", price: 0.0234, change: -0.0012, changePercent: -4.88 },
    { symbol: "JUP-PERP", price: 0.6842, change: 0.0234, changePercent: 3.54 },
    { symbol: "WIF-PERP", price: 1.2345, change: -0.0543, changePercent: -4.21 },
    { symbol: "BONK-PERP", price: 0.0000182, change: 0.0000012, changePercent: 7.06 },
    { symbol: "RNDR-PERP", price: 8.234, change: 0.412, changePercent: 5.27 },
  ];
}
