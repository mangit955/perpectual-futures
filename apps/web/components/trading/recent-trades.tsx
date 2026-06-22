"use client";

import { useMemo } from "react";
import { useRecentTrades, formatPrice, formatTime } from "@/hooks/use-market-feed";
import { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function RecentTradesSkeleton() {
  return (
    <div className="flex flex-col gap-px px-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="flex items-center h-[18px] gap-2">
          <div className="h-2.5 w-16 rounded-sm bg-zinc-800/60 animate-pulse" />
          <div className="h-2.5 w-14 rounded-sm bg-zinc-800/40 animate-pulse ml-auto" />
          <div className="h-2.5 w-16 rounded-sm bg-zinc-800/30 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── RecentTrades Component ──────────────────────────────────────────────────

export function RecentTrades() {
  const trades = useRecentTrades(50);

  const hasTrades = trades.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column Headers */}
      <div className="flex items-center px-2 py-1 text-[10px] text-zinc-500 shrink-0">
        <span className="flex-1 text-left">Price (USD)</span>
        <span className="flex-1 text-right">Size (SOL)</span>
        <span className="w-[72px] text-right">Time</span>
      </div>

      {/* Trade Rows */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {!hasTrades ? (
          <RecentTradesSkeleton />
        ) : (
          <div className="flex flex-col">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center px-2 h-[18px] hover:bg-white/[0.02] transition-colors duration-75"
              >
                <span
                  className={cn(
                    "flex-1 text-left font-mono text-xs tabular-nums",
                    trade.side === OrderSide.Buy
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {formatPrice(trade.price)}
                </span>
                <span className="flex-1 text-right font-mono text-xs text-zinc-300 tabular-nums">
                  {trade.size.toFixed(4)}
                </span>
                <span className="w-[72px] text-right font-mono text-xs text-zinc-500 tabular-nums">
                  {formatTime(trade.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
