"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  useOrderBook,
  useLastPrice,
  formatPrice,
} from "@/hooks/use-market-feed";
import { useOrders, useOpenOrders } from "@/hooks/use-api-data";
import type { OrderBookEntry, BookTab } from "@/types/trading";
import { cn } from "@/lib/utils";
import { RecentTrades } from "@/components/trading/recent-trades";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, ArrowDown } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "split" | "asks" | "bids";

const PRECISION_OPTIONS = ["0.001", "0.01", "0.1", "1", "10"] as const;
type Precision = (typeof PRECISION_OPTIONS)[number];

// ─── View Mode Icons ─────────────────────────────────────────────────────────

function AsksOnlyIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="1"
        y="1"
        width="12"
        height="3"
        rx="0.5"
        fill={active ? "#ef4444" : "#52525b"}
      />
      <rect
        x="1"
        y="5.5"
        width="12"
        height="3"
        rx="0.5"
        fill={active ? "#ef4444" : "#52525b"}
        opacity={0.6}
      />
      <rect
        x="1"
        y="10"
        width="12"
        height="3"
        rx="0.5"
        fill={active ? "#ef4444" : "#52525b"}
        opacity={0.3}
      />
    </svg>
  );
}

function SplitViewIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="1"
        y="1"
        width="12"
        height="2.5"
        rx="0.5"
        fill={active ? "#ef4444" : "#52525b"}
      />
      <rect
        x="1"
        y="4.5"
        width="12"
        height="2.5"
        rx="0.5"
        fill={active ? "#ef4444" : "#52525b"}
        opacity={0.6}
      />
      <rect
        x="1"
        y="8"
        width="12"
        height="2.5"
        rx="0.5"
        fill={active ? "#22c55e" : "#52525b"}
        opacity={0.6}
      />
      <rect
        x="1"
        y="11"
        width="12"
        height="2.5"
        rx="0.5"
        fill={active ? "#22c55e" : "#52525b"}
      />
    </svg>
  );
}

function BidsOnlyIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="1"
        y="1"
        width="12"
        height="3"
        rx="0.5"
        fill={active ? "#22c55e" : "#52525b"}
        opacity={0.3}
      />
      <rect
        x="1"
        y="5.5"
        width="12"
        height="3"
        rx="0.5"
        fill={active ? "#22c55e" : "#52525b"}
        opacity={0.6}
      />
      <rect
        x="1"
        y="10"
        width="12"
        height="3"
        rx="0.5"
        fill={active ? "#22c55e" : "#52525b"}
      />
    </svg>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function OrderBookSkeleton() {
  return (
    <div className="flex flex-col gap-px px-2 py-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`ask-${i}`} className="flex items-center h-5 gap-2">
          <div className="h-2.5 w-14 rounded-sm bg-zinc-800/60 animate-pulse" />
          <div className="h-2.5 w-12 rounded-sm bg-zinc-800/40 animate-pulse ml-auto" />
          <div className="h-2.5 w-14 rounded-sm bg-zinc-800/30 animate-pulse" />
        </div>
      ))}
      <div className="h-7 flex items-center justify-center my-0.5">
        <div className="h-3 w-24 rounded-sm bg-zinc-800/50 animate-pulse" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`bid-${i}`} className="flex items-center h-5 gap-2">
          <div className="h-2.5 w-14 rounded-sm bg-zinc-800/60 animate-pulse" />
          <div className="h-2.5 w-12 rounded-sm bg-zinc-800/40 animate-pulse ml-auto" />
          <div className="h-2.5 w-14 rounded-sm bg-zinc-800/30 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Order Row ───────────────────────────────────────────────────────────────

interface OrderRowProps {
  entry: OrderBookEntry;
  maxTotal: number;
  side: "ask" | "bid";
  precision: number;
  hasMyOrder?: boolean;
}

function OrderRow({ entry, maxTotal, side, precision, hasMyOrder }: OrderRowProps) {
  const depthPercent = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
  const bgColor =
    side === "ask" ? `rgba(239,68,68,0.15)` : `rgba(34,197,94,0.15)`;

  const decimals =
    precision < 1 ? (String(precision).split(".")[1]?.length ?? 2) : 0;

  return (
    <div className={cn(
      "relative flex items-center px-2 h-5 hover:bg-white/[0.02] transition-colors duration-75 cursor-pointer overflow-hidden",
      hasMyOrder && "bg-blue-500/10 border-l-2 border-blue-500"
    )}>
      <motion.div
        className={cn(
          "absolute right-0 top-0 h-full",
          side === "ask" ? "bg-red-500/15" : "bg-emerald-500/15",
        )}
        animate={{
          width: `${depthPercent}%`,
        }}
        transition={{
          duration: 0.8,
          ease: "easeOut",
        }}
      />
      <span
        className={cn(
          "relative z-10 flex-1 text-left font-normal text-xs tabular-nums",
          side === "ask" ? "text-red-400" : "text-emerald-400",
          hasMyOrder && "font-semibold"
        )}
      >
        {formatPrice(entry.price, decimals)}
      </span>
      <span className="relative z-10 flex-1 text-right font-normal text-xs text-zinc-300 tabular-nums">
        {entry.size.toFixed(4)}
      </span>
      <span className="relative z-10 flex-1 text-right font-normal text-xs text-zinc-400 tabular-nums">
        {entry.total.toFixed(4)}
      </span>
    </div>
  );
}

// ─── Spread Row ──────────────────────────────────────────────────────────────

interface SpreadRowProps {
  lastPrice: number;
  spread: number;
  spreadPercentage: number;
}

function SpreadRow({ lastPrice, spread, spreadPercentage }: SpreadRowProps) {
  return (
    <div className="flex items-center px-2 h-7 bg-[#111113] border-y border-[#1e1e22] shrink-0">
      <div className="flex items-center gap-1.5 flex-1">
        <span className="font-normal text-sm font-medium text-[#fafafa] tabular-nums">
          {formatPrice(lastPrice)}
        </span>
        <ArrowDown className="size-3 text-zinc-500" />
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-normal tabular-nums">
        <span>Spread: {formatPrice(spread, 4)}</span>
        <span>({spreadPercentage.toFixed(3)}%)</span>
      </div>
    </div>
  );
}

// ─── Precision Dropdown ──────────────────────────────────────────────────────

interface PrecisionDropdownProps {
  value: Precision;
  onChange: (p: Precision) => void;
}

function PrecisionDropdown({ value, onChange }: PrecisionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-0.5 px-1.5 h-6 rounded border border-[#27272a] bg-[#18181b] text-[10px] font-normal text-zinc-400 hover:text-zinc-300 hover:border-zinc-600 transition-colors cursor-pointer outline-none">
        {value}
        <ChevronDown className="size-3 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-[72px] bg-[#18181b] border border-[#27272a]"
      >
        {PRECISION_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt}
            className={cn(
              "font-normal text-xs cursor-pointer",
              opt === value && "text-white bg-white/5",
            )}
            onSelect={() => onChange(opt)}
          >
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Main OrderBook Component ────────────────────────────────────────────────

interface OrderBookProps {
  defaultTab?: BookTab;
}

export function OrderBook({ defaultTab = "book" }: OrderBookProps) {
  const orderBook = useOrderBook();
  const lastPrice = useLastPrice();
  const [activeTab, setActiveTab] = useState<BookTab>(defaultTab);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [precision, setPrecision] = useState<Precision>("0.01");

  // Fetch user's open orders
  const { data: allOrders } = useOrders();
  const myOpenOrders = useOpenOrders(allOrders);

  // Create a map of prices where user has open orders
  const myOrderPrices = useMemo(() => {
    const priceMap = new Map<number, { side: "buy" | "sell"; size: number }>();
    myOpenOrders.forEach((order) => {
      if (order.price) {
        const existing = priceMap.get(order.price);
        if (existing) {
          existing.size += order.remainingQuantity;
        } else {
          priceMap.set(order.price, {
            side: order.side.toLowerCase() as "buy" | "sell",
            size: order.remainingQuantity,
          });
        }
      }
    });
    return priceMap;
  }, [myOpenOrders]);

  // ── Aggregate entries to selected precision ──
  const aggregatedData = useMemo(() => {
    if (!orderBook) return null;

    const precisionNum = parseFloat(precision);

    const aggregate = (
      entries: OrderBookEntry[],
      isAsk: boolean,
    ): OrderBookEntry[] => {
      const grouped = new Map<number, number>();

      for (const entry of entries) {
        const key = isAsk
          ? Math.ceil(entry.price / precisionNum) * precisionNum
          : Math.floor(entry.price / precisionNum) * precisionNum;
        grouped.set(key, (grouped.get(key) ?? 0) + entry.size);
      }

      const sorted = Array.from(grouped.entries())
        .map(([price, size]) => ({ price, size, total: 0 }))
        .sort((a, b) => (isAsk ? a.price - b.price : b.price - a.price));

      // Compute running totals
      let runningTotal = 0;
      for (const entry of sorted) {
        runningTotal += entry.size;
        entry.total = runningTotal;
      }

      return sorted;
    };

    const asks = aggregate(orderBook.asks, true);
    const bids = aggregate(orderBook.bids, false);

    return {
      asks,
      bids,
      spread: orderBook.spread,
      spreadPercentage: orderBook.spreadPercentage,
    };
  }, [orderBook, precision]);

  // ── Compute max totals for depth bars ──
  const { maxAskTotal, maxBidTotal } = useMemo(() => {
    if (!aggregatedData) return { maxAskTotal: 0, maxBidTotal: 0 };

    const maxAsk =
      aggregatedData.asks.length > 0
        ? Math.max(...aggregatedData.asks.map((e) => e.total))
        : 0;
    const maxBid =
      aggregatedData.bids.length > 0
        ? Math.max(...aggregatedData.bids.map((e) => e.total))
        : 0;

    return { maxAskTotal: maxAsk, maxBidTotal: maxBid };
  }, [aggregatedData]);

  const precisionNum = parseFloat(precision);

  // ── Determine row counts based on view mode ──
  const getRowCount = useCallback(
    (mode: ViewMode): { askRows: number; bidRows: number } => {
      switch (mode) {
        case "asks":
          return { askRows: 20, bidRows: 0 };
        case "bids":
          return { askRows: 0, bidRows: 20 };
        case "split":
        default:
          return { askRows: 10, bidRows: 10 };
      }
    },
    [],
  );

  const { askRows, bidRows } = getRowCount(viewMode);

  // ── Slice data for display ──
  const displayAsks = useMemo(() => {
    if (!aggregatedData) return [];
    // For asks display: we show them with highest at top, lowest at bottom (approaching spread)
    // aggregatedData.asks is sorted ascending, so reverse for display
    const sliced = aggregatedData.asks.slice(0, askRows);
    return [...sliced].reverse();
  }, [aggregatedData, askRows]);

  const displayBids = useMemo(() => {
    if (!aggregatedData) return [];
    // For bids display: highest bid at top (closest to spread)
    // aggregatedData.bids is already sorted descending
    return aggregatedData.bids.slice(0, bidRows);
  }, [aggregatedData, bidRows]);

  return (
    <div className="flex flex-col h-full  p-2 min-h-0 overflow-hidden rounded-lg border border-[#1e1e22] bg-[#0d0d0f]">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-[#1e1e22] shrink-0">
        <button
          onClick={() => setActiveTab("book")}
          className={cn(
            "px-3 py-1 text-md font-medium rounded-md cursor-pointer transition-colors relative",
            activeTab === "book"
              ? "text-[#fafafa] bg-zinc-900"
              : "text-zinc-500 hover:text-zinc-400",
          )}
        >
          Book
        </button>
        <button
          onClick={() => setActiveTab("trades")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors relative",
            activeTab === "trades"
              ? "text-[#fafafa] bg-zinc-900"
              : "text-zinc-500 hover:text-zinc-400",
          )}
        >
          Trades
        </button>
      </div>

      {/* ─── Trades Tab ─── */}
      {activeTab === "trades" && (
        <div className="flex-1 h-0 min-h-0 overflow-hidden ">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <RecentTrades />
          </div>
        </div>
      )}

      {/* ─── Book Tab ─── */}
      {activeTab === "book" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Controls Row */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e22] shrink-0">
            {/* View mode icons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setViewMode("asks")}
                className={cn(
                  "p-1 rounded transition-colors",
                  viewMode === "asks"
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]",
                )}
                title="Asks only"
              >
                <AsksOnlyIcon active={viewMode === "asks"} />
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={cn(
                  "p-1 rounded transition-colors",
                  viewMode === "split"
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]",
                )}
                title="Split view"
              >
                <SplitViewIcon active={viewMode === "split"} />
              </button>
              <button
                onClick={() => setViewMode("bids")}
                className={cn(
                  "p-1 rounded transition-colors",
                  viewMode === "bids"
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]",
                )}
                title="Bids only"
              >
                <BidsOnlyIcon active={viewMode === "bids"} />
              </button>
            </div>

            {/* Precision + Add button */}
            <div className="flex items-center gap-1">
              <PrecisionDropdown value={precision} onChange={setPrecision} />
              <button
                className="flex items-center justify-center size-6 rounded border border-[#27272a] bg-[#18181b] text-zinc-400 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
                title="Add column"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          {/* Column Headers */}
          <div className="flex items-center px-2 py-1 text-[10px] text-zinc-500 shrink-0">
            <span className="flex-1 text-left">Price (USD)</span>
            <span className="flex-1 text-right">Size (SOL)</span>
            <span className="flex-1 text-right">Total (SOL)</span>
          </div>

          {/* Order Book Data */}
          {!aggregatedData ? (
            <OrderBookSkeleton />
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Asks Section */}
              {viewMode !== "bids" && (
                <div className="flex flex-col justify-end flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <div className="flex flex-col">
                    {displayAsks.map((entry) => {
                      const myOrder = myOrderPrices.get(entry.price);
                      const hasMyOrder = myOrder?.side === "sell";
                      return (
                        <OrderRow
                          key={entry.price}
                          entry={entry}
                          maxTotal={maxAskTotal}
                          side="ask"
                          precision={precisionNum}
                          hasMyOrder={hasMyOrder}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Spread Row */}
              {viewMode === "split" && (
                <SpreadRow
                  lastPrice={lastPrice}
                  spread={aggregatedData.spread}
                  spreadPercentage={aggregatedData.spreadPercentage}
                />
              )}

              {/* Bids Section */}
              {viewMode !== "asks" && (
                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <div className="flex flex-col">
                    {displayBids.map((entry) => {
                      const myOrder = myOrderPrices.get(entry.price);
                      const hasMyOrder = myOrder?.side === "buy";
                      return (
                        <OrderRow
                          key={entry.price}
                          entry={entry}
                          maxTotal={maxBidTotal}
                          side="bid"
                          precision={precisionNum}
                          hasMyOrder={hasMyOrder}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
