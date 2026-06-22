import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SOL-PERP | Flux Trade",
  description:
    "Trade SOL perpetual futures on Flux with up to 50x leverage. Advanced charting, real-time orderbook, and institutional-grade execution.",
};

export default function TradeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#09090b]">
      {children}
    </div>
  );
}
