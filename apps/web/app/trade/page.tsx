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
    <>
      {/* ─── Top Navigation ─────────────────────────────────────────────────── */}
      <NavigationBar />

      {/* ─── Market Header ──────────────────────────────────────────────────── */}
      <MarketHeader />

      {/* ─── Main Trading Area ──────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Chart Panel — largest, takes remaining space */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-[#1e1e22]">
          <TradingChart />
        </div>

        {/* Order Book Panel — fixed width middle column */}
        <div className="hidden w-[280px] flex-shrink-0 flex-col border-r border-[#1e1e22] lg:flex">
          <OrderBook />
        </div>

        {/* Trade Panel — fixed width right column */}
        <div className="hidden w-[300px] flex-shrink-0 flex-col xl:flex">
          <TradePanel />
        </div>
      </div>

      {/* ─── Bottom Positions Area ──────────────────────────────────────────── */}
      <div className="h-[200px] flex-shrink-0 border-t border-[#1e1e22]">
        <PositionsTable />
      </div>

      {/* ─── Ticker Tape ────────────────────────────────────────────────────── */}
      <TickerTape />
    </>
  );
}
