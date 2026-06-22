"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCandleData } from "@/hooks/use-market-feed";
import type { CandleData, ChartTab, PriceType } from "@/types/trading";
import { cn } from "@/lib/utils";
import {
  Crosshair,
  Settings,
  Camera,
  Maximize2,
  ChevronDown,
  TrendingUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeframeOption {
  label: string;
  value: string;
}

const TIMEFRAMES: TimeframeOption[] = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
];

const CHART_TABS: { label: string; value: ChartTab }[] = [
  { label: "Chart", value: "chart" },
  { label: "Depth", value: "depth" },
  { label: "Margin", value: "margin" },
  { label: "Funding", value: "funding" },
  { label: "Market Info", value: "market-info" },
];

const PRICE_TYPES: { label: string; value: PriceType }[] = [
  { label: "Last", value: "last" },
  { label: "Mark", value: "mark" },
  { label: "Index", value: "index" },
];

// ─── Chart Header Overlay ────────────────────────────────────────────────────

function ChartOverlay({ candle }: { candle: CandleData | null }) {
  if (!candle) return null;

  const change = candle.close - candle.open;
  const changePct = ((change / candle.open) * 100).toFixed(2);
  const isPositive = change >= 0;

  return (
    <div className="pointer-events-none absolute top-2 left-3 z-10">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-300 font-medium">SOL-PERP</span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-500">1h</span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-500">Flux</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] font-mono">
        <span className="text-zinc-500">
          O<span className={cn("ml-1", isPositive ? "text-emerald-400" : "text-red-400")}>
            {candle.open.toFixed(2)}
          </span>
        </span>
        <span className="text-zinc-500">
          H<span className="ml-1 text-emerald-400">{candle.high.toFixed(2)}</span>
        </span>
        <span className="text-zinc-500">
          L<span className="ml-1 text-red-400">{candle.low.toFixed(2)}</span>
        </span>
        <span className="text-zinc-500">
          C<span className={cn("ml-1", isPositive ? "text-emerald-400" : "text-red-400")}>
            {candle.close.toFixed(2)}
          </span>
        </span>
        <span className={cn(isPositive ? "text-emerald-400" : "text-red-400")}>
          {isPositive ? "+" : ""}
          {change.toFixed(2)} ({isPositive ? "+" : ""}
          {changePct}%)
        </span>
      </div>
      <div className="mt-0.5 text-[11px] font-mono text-zinc-500">
        Volume SMA{" "}
        <span className="text-zinc-400">{candle.volume.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── Main Chart Component ────────────────────────────────────────────────────

export function TradingChart() {
  const [activeTab, setActiveTab] = useState<ChartTab>("chart");
  const [activePriceType, setActivePriceType] = useState<PriceType>("last");
  const [activeTimeframe, setActiveTimeframe] = useState("60");

  const { candles, latestCandle } = useCandleData();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<
    ReturnType<typeof import("lightweight-charts").createChart>["addSeries"]
  > | null>(null);
  const volumeSeriesRef = useRef<ReturnType<
    ReturnType<typeof import("lightweight-charts").createChart>["addSeries"]
  > | null>(null);
  const initializedRef = useRef(false);

  // ─── Initialize chart ──────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "chart") return;
    if (!chartContainerRef.current) return;

    let chart: ReturnType<typeof import("lightweight-charts").createChart> | null = null;

    const initChart = async () => {
      const lc = await import("lightweight-charts");

      if (!chartContainerRef.current) return;

      const container = chartContainerRef.current;

      chart = lc.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: lc.ColorType.Solid, color: "#0d0d0f" },
          textColor: "#71717a",
          fontSize: 11,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        },
        grid: {
          vertLines: { color: "#1e1e22" },
          horzLines: { color: "#1e1e22" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: {
            color: "rgba(255,255,255,0.1)",
            labelBackgroundColor: "#27272a",
          },
          horzLine: {
            color: "rgba(255,255,255,0.1)",
            labelBackgroundColor: "#27272a",
          },
        },
        rightPriceScale: {
          borderColor: "#1e1e22",
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor: "#1e1e22",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
      });

      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      initializedRef.current = false; // reset so data gets loaded

      // Resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (chart && width > 0 && height > 0) {
            chart.applyOptions({ width, height });
          }
        }
      });

      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
      };
    };

    const cleanupPromise = initChart();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
      if (chart) {
        chart.remove();
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      initializedRef.current = false;
    };
  }, [activeTab]);

  // ─── Load / update data ────────────────────────────────────────────────────

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    if (!initializedRef.current) {
      // Initial data load
      const candleData = candles.map((c) => ({
        time: c.time as import("lightweight-charts").UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volumeData = candles.map((c) => ({
        time: c.time as import("lightweight-charts").UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? "rgba(34, 197, 94, 0.3)"
            : "rgba(239, 68, 68, 0.3)",
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      initializedRef.current = true;
    } else if (latestCandle) {
      // Live update
      candleSeriesRef.current.update({
        time: latestCandle.time as import("lightweight-charts").UTCTimestamp,
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
      });

      volumeSeriesRef.current.update({
        time: latestCandle.time as import("lightweight-charts").UTCTimestamp,
        value: latestCandle.volume,
        color:
          latestCandle.close >= latestCandle.open
            ? "rgba(34, 197, 94, 0.3)"
            : "rgba(239, 68, 68, 0.3)",
      });
    }
  }, [candles, latestCandle]);

  // ─── Reset handler ─────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-[#1e1e22] px-3">
        <div className="flex items-center gap-0.5">
          {CHART_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "relative px-3 py-2.5 text-xs font-medium transition-colors",
                activeTab === tab.value
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-1/2 h-[2px] w-4/5 -translate-x-1/2 rounded-t bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* Price Type Selector */}
        <div className="flex items-center gap-0.5 rounded-md bg-[#111113] p-0.5">
          {PRICE_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setActivePriceType(pt.value)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                activePriceType === pt.value
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Content */}
      {activeTab === "chart" ? (
        <div className="relative flex flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-1 border-b border-[#1e1e22] px-3 py-1.5">
            {/* Timeframes */}
            <div className="flex items-center gap-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setActiveTimeframe(tf.value)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                    activeTimeframe === tf.value
                      ? "bg-zinc-700/60 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {tf.label}
                </button>
              ))}
              <button className="rounded px-1.5 py-1 text-zinc-500 hover:text-zinc-300">
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            {/* Separator */}
            <div className="mx-1.5 h-4 w-px bg-[#1e1e22]" />

            {/* Indicators */}
            <div className="flex items-center gap-1">
              <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                <TrendingUp className="h-3 w-3" />
                Indicators
              </button>
              <button className="rounded px-1.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                OL
              </button>
              <button className="rounded px-1.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                TE
              </button>
            </div>

            {/* Separator */}
            <div className="mx-1.5 h-4 w-px bg-[#1e1e22]" />

            {/* Tools */}
            <div className="flex items-center gap-0.5">
              <button className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right-side tools */}
            <div className="flex items-center gap-0.5">
              <button className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <Camera className="h-3.5 w-3.5" />
              </button>
              <button className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleReset}
                className="ml-1 rounded px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Chart Container */}
          <div className="relative flex-1">
            <ChartOverlay candle={latestCandle} />
            <div ref={chartContainerRef} className="absolute inset-0" />
          </div>
        </div>
      ) : (
        /* Placeholder for non-chart tabs */
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-zinc-500">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace("-", " ")}
            </p>
            <p className="mt-1 text-xs text-zinc-600">Coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}
