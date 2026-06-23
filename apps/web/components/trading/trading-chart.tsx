"use client";

import dynamic from "next/dynamic";

const AdvancedRealTimeChart = dynamic(
  () =>
    import("react-ts-tradingview-widgets").then(
      (mod) => mod.AdvancedRealTimeChart,
    ),
  { ssr: false },
);

export function TradingChart() {
  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-[#1e1e22] bg-[#0f0f11]">
      <AdvancedRealTimeChart
        theme="dark"
        symbol="BINANCE:SOLUSDT"
        interval="60"
        autosize
        hide_top_toolbar={false}
        hide_side_toolbar={false}
        allow_symbol_change={false}
      />
    </div>
  );
}
