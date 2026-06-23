"use client";

import { useMarketFeedCleanup } from "@/hooks/use-market-feed";
import { NavigationBar } from "@/components/trading/navigation-bar";
import { MarketHeader } from "@/components/trading/market-header";
import { TradingChart } from "@/components/trading/trading-chart";
import { OrderBook } from "@/components/trading/order-book";
import { TradePanel } from "@/components/trading/trade-panel";
import { PositionsTable } from "@/components/trading/positions-table";
import { TickerTape } from "@/components/trading/ticker-tape";

export default function TradePage() {
  // Start/stop the mock market feed with this page's lifecycle
  useMarketFeedCleanup();

  return (
    <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden">
      {/* ─── Top Navigation ─────────────────────────────────────────────────── */}
      <NavigationBar />

      {/* ─── Market Header ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-2">
        <MarketHeader />
      </div>

      {/* ─── Main Trading Area ──────────────────────────────────────────────── */}
      <div
        className="flex gap-2 px-4 py-2"
        style={{ height: "calc(100vh - 140px)" }}
      >
        {/* Chart Panel — largest, takes remaining space */}
        <div className="flex min-w-0 flex-1 overflow-hidden flex-col">
          <TradingChart />
        </div>

        {/* Order Book Panel — fixed width middle column */}
        <div className="hidden w-[280px] flex-shrink-0 flex-col overflow-hidden lg:flex">
          <OrderBook />
        </div>

        {/* Trade Panel — fixed width right column */}
        <div className="hidden w-[300px] flex-shrink-0 flex-col xl:flex">
          <TradePanel />
        </div>
      </div>

      {/* ─── Bottom Positions Area ──────────────────────────────────────────── */}
      <div className="flex-shrink-0  p-2">
        <PositionsTable />
      </div>

      {/* ─── Ticker Tape ────────────────────────────────────────────────────── */}
      <TickerTape />
    </div>
  );
}
