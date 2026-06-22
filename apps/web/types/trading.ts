// ─── Enums ───────────────────────────────────────────────────────────────────

export enum OrderSide {
  Buy = "buy",
  Sell = "sell",
}

export enum OrderType {
  Limit = "limit",
  Market = "market",
  Conditional = "conditional",
}

export enum TimeInterval {
  ONE_MINUTE = "1m",
  FIVE_MINUTES = "5m",
  FIFTEEN_MINUTES = "15m",
  ONE_HOUR = "1h",
  FOUR_HOURS = "4h",
  ONE_DAY = "1D",
}

export enum PositionSide {
  Long = "long",
  Short = "short",
}

// ─── Order Book ──────────────────────────────────────────────────────────────

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookData {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  spread: number;
  spreadPercentage: number;
  midPrice: number;
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export interface RecentTrade {
  id: string;
  price: number;
  size: number;
  side: OrderSide;
  timestamp: number;
}

// ─── Candle Data ─────────────────────────────────────────────────────────────

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Market Data ─────────────────────────────────────────────────────────────

export interface MarketData {
  symbol: string;
  lastPrice: number;
  markPrice: number;
  indexPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  fundingCountdown: string;
  maxLeverage: number;
}

// ─── Positions ───────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  margin: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  timestamp: number;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface OpenOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  filled: number;
  remaining: number;
  status: "open" | "partially_filled";
  timestamp: number;
  reduceOnly: boolean;
  postOnly: boolean;
}

export interface OrderHistoryEntry {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  filled: number;
  status: "filled" | "cancelled" | "expired";
  fee: number;
  timestamp: number;
}

export interface TradeHistoryEntry {
  id: string;
  symbol: string;
  side: OrderSide;
  price: number;
  size: number;
  fee: number;
  realizedPnl: number;
  timestamp: number;
}

// ─── Trade Form State ────────────────────────────────────────────────────────

export interface TradeFormState {
  side: OrderSide;
  orderType: OrderType;
  price: string;
  quantity: string;
  leverage: number;
  sliderPercent: number;
  postOnly: boolean;
  ioc: boolean;
  reduceOnly: boolean;
  tpsl: boolean;
}

// ─── Ticker Tape ─────────────────────────────────────────────────────────────

export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

// ─── Tab Types ───────────────────────────────────────────────────────────────

export type BottomTab = "positions" | "open-orders" | "order-history" | "trade-history";
export type ChartTab = "chart" | "depth" | "margin" | "funding" | "market-info";
export type BookTab = "book" | "trades";
export type PriceType = "last" | "mark" | "index";
