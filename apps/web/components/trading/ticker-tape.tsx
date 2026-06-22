"use client";

import { useMemo } from "react";
import { generateTickerItems } from "@/lib/mock/market-data";
import { cn } from "@/lib/utils";

// ─── Ticker Tape ─────────────────────────────────────────────────────────────

export function TickerTape() {
  const items = useMemo(() => generateTickerItems(), []);

  // Duplicate items for seamless marquee loop
  const duplicatedItems = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="relative flex h-8 items-center overflow-hidden border-t border-[#1e1e22] bg-[#09090b]">
      {/* Left: Top Movers label */}
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-[#1e1e22] bg-[#09090b] px-3">
        <span className="text-[11px]">🔥</span>
        <span className="whitespace-nowrap text-[11px] font-medium text-zinc-500">
          Top Movers
        </span>
      </div>

      {/* Scrolling marquee */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#09090b] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#09090b] to-transparent" />

        <div className="ticker-marquee flex items-center">
          {duplicatedItems.map((item, index) => (
            <div
              key={`${item.symbol}-${index}`}
              className="flex shrink-0 items-center gap-1.5 px-3"
            >
              <span className="whitespace-nowrap font-mono text-[11px] text-zinc-400">
                {item.symbol}
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] text-[#fafafa]">
                $
                {item.price < 0.01
                  ? item.price.toPrecision(4)
                  : item.price < 1
                    ? item.price.toFixed(5)
                    : item.price.toFixed(2)}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap font-mono text-[11px]",
                  item.changePercent >= 0
                    ? "text-[#22c55e]"
                    : "text-[#ef4444]"
                )}
              >
                ({item.changePercent >= 0 ? "+" : ""}
                {item.changePercent.toFixed(2)}%)
              </span>

              {/* Separator dot */}
              <span className="ml-1.5 text-[8px] text-zinc-700">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Funding Rate */}
      <div className="z-10 flex shrink-0 items-center gap-2 border-l border-[#1e1e22] bg-[#09090b] px-3">
        <span className="whitespace-nowrap text-[11px] text-zinc-500">
          Funding Rate
        </span>
        <span className="whitespace-nowrap font-mono text-[11px] text-[#22c55e]">
          0.0013%
        </span>
      </div>
    </div>
  );
}
