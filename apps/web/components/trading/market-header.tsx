"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMarketData, formatPrice } from "@/hooks/use-market-feed";
import type { MarketData } from "@/types/trading";

// ─── MarketPill ──────────────────────────────────────────────────────────────

function MarketPill({
  symbol,
  maxLeverage,
}: {
  symbol: string;
  maxLeverage: number;
}) {
  return (
    <button className="flex items-center gap-2 rounded-md border border-[#27272a] bg-[#111113] px-3 py-1.5 transition-colors hover:border-zinc-600">
      {/* Green status dot */}
      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />

      {/* Symbol */}
      <span className="text-sm font-semibold text-white">{symbol}</span>

      {/* Leverage badge */}
      <span className="rounded bg-[#27272a] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
        {maxLeverage}x
      </span>

      {/* Dropdown chevron */}
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
    </button>
  );
}

// ─── PriceDisplay ────────────────────────────────────────────────────────────

function PriceDisplay({
  lastPrice,
  markPrice,
  change24h,
}: {
  lastPrice: number;
  markPrice: number;
  change24h: number;
}) {
  const isPositive = change24h >= 0;

  return (
    <div className="flex flex-col justify-center border-r border-[#1e1e22] px-4">
      <span
        className={` text-lg font-semibold leading-tight ${
          isPositive ? "text-emerald-500" : "text-red-400"
        }`}
      >
        {formatPrice(lastPrice, 2)}
      </span>
      <span className="font-normal text-[11px] text-zinc-500 leading-tight">
        Mark {formatPrice(markPrice, 2)}
      </span>
    </div>
  );
}

// ─── DataCard ────────────────────────────────────────────────────────────────

interface DataCardProps {
  label: string;
  value: string;
  valueClass?: string;
  subValue?: string;
  subValueClass?: string;
}

function DataCard({
  label,
  value,
  valueClass,
  subValue,
  subValueClass,
}: DataCardProps) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <span className="text-[11px] leading-none text-zinc-500 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-normal text-xs leading-none whitespace-nowrap ${
            valueClass ?? "text-zinc-300"
          }`}
        >
          {value}
        </span>
        {subValue && (
          <span
            className={`font-normal text-xs leading-none whitespace-nowrap ${
              subValueClass ?? "text-zinc-300"
            }`}
          >
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-zinc-800 ${className ?? ""}`} />
  );
}

function MarketHeaderSkeleton() {
  return (
    <div className="flex h-14 w-full items-center border-b border-[#1e1e22] bg-[#0d0d0f] px-4 gap-6">
      <Skeleton className="h-8 w-[140px]" />
      <div className="flex flex-col gap-1.5 px-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Data cards builder ──────────────────────────────────────────────────────

function buildDataCards(data: MarketData): DataCardProps[] {
  const isChangePositive = data.change24h >= 0;
  const changeColor = isChangePositive ? "text-emerald-500" : "text-red-400";

  const isFundingPositive = data.fundingRate >= 0;
  const fundingColor = isFundingPositive ? "text-amber-400" : "text-red-400";

  return [
    {
      label: "Index Price",
      value: formatPrice(data.indexPrice, 2),
    },
    {
      label: "24H Change",
      value: `${isChangePositive ? "+" : ""}${formatPrice(data.change24h, 2)}`,
      valueClass: changeColor,
      subValue: `${isChangePositive ? "+" : ""}${data.changePercent24h.toFixed(2)}%`,
      subValueClass: changeColor,
    },
    {
      label: "1H Funding / Countdown",
      value: `${data.fundingRate >= 0 ? "" : "-"}${Math.abs(data.fundingRate * 100).toFixed(4)}%`,
      valueClass: fundingColor,
      subValue: `/ ${data.fundingCountdown}`,
      subValueClass: "text-zinc-400",
    },
    {
      label: "24H High",
      value: formatPrice(data.high24h, 2),
    },
    {
      label: "24H Low",
      value: formatPrice(data.low24h, 2),
    },
    {
      label: "24H Volume (USD)",
      value: formatVolume(data.volume24h),
    },
    {
      label: "Open Interest (SOL)",
      value: formatOI(data.openInterest),
    },
  ];
}

function formatVolume(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatOI(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── ScrollIndicator ─────────────────────────────────────────────────────────

function ScrollIndicator({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute right-0 top-0 flex h-full w-10 items-center justify-center bg-gradient-to-l from-[#0d0d0f] via-[#0d0d0f]/90 to-transparent"
      aria-label="Scroll right"
    >
      <ChevronRight className="h-4 w-4 text-zinc-400" />
    </button>
  );
}

// ─── MarketHeader ────────────────────────────────────────────────────────────

export function MarketHeader() {
  const marketData = useMarketData();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setShowScrollIndicator(hasOverflow && !isAtEnd);
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [checkOverflow, marketData]);

  const handleScrollRight = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: 200, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    checkOverflow();
  }, [checkOverflow]);

  if (!marketData) {
    return <MarketHeaderSkeleton />;
  }

  const dataCards = buildDataCards(marketData);

  return (
    <div className="relative flex h-14 w-full items-center border rounded-sm border-[#1e1e22] bg-[#0d0d0f] px-4">
      {/* Market Pill */}
      <MarketPill
        symbol={marketData.symbol}
        maxLeverage={marketData.maxLeverage}
      />

      {/* Separator */}
      <div className="mx-3 h-8 w-px bg-[#1e1e22]" />

      {/* Price Display */}
      <PriceDisplay
        lastPrice={marketData.lastPrice}
        markPrice={marketData.markPrice}
        change24h={marketData.change24h}
      />

      {/* Data Cards (scrollable) */}
      <div className="relative flex min-w-0 flex-1 items-center">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex items-center gap-6 overflow-x-auto px-2 hide-scrollbar"
        >
          {dataCards.map((card) => (
            <DataCard key={card.label} {...card} />
          ))}
        </div>

        {/* Scroll indicator */}
        <ScrollIndicator
          visible={showScrollIndicator}
          onClick={handleScrollRight}
        />
      </div>
    </div>
  );
}
