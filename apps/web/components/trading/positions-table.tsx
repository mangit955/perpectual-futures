"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import type {
  Position,
  OpenOrder,
  OrderHistoryEntry,
  TradeHistoryEntry,
  BottomTab,
} from "@/types/trading";
import { OrderSide, PositionSide } from "@/types/trading";
import { formatPrice, formatDate } from "@/hooks/use-market-feed";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  useOrders,
  useFills,
  usePositions,
  useOpenOrders,
  useClosedOrders,
} from "@/hooks/use-api-data";
import {
  type ApiOrder,
  type ApiFill,
  type ApiPosition,
  apiCancelOrder,
} from "@/lib/api";
import { Loader2 } from "lucide-react";

// ─── Tab config ──────────────────────────────────────────────────────────────

interface TabConfig {
  id: BottomTab;
  label: string;
  countKey?: "positions" | "openOrders";
}

const TABS: TabConfig[] = [
  { id: "positions", label: "Positions", countKey: "positions" },
  { id: "open-orders", label: "Open Orders", countKey: "openOrders" },
  { id: "order-history", label: "Order History" },
  { id: "trade-history", label: "Trade History" },
];

// ─── API → display type mappers ──────────────────────────────────────────────

function apiOrderToOpenOrder(o: ApiOrder): OpenOrder {
  const filled = o.quantity - o.remainingQuantity;
  return {
    id: o.id,
    symbol: o.marketId,
    side: o.side.toUpperCase() === "BUY" ? OrderSide.Buy : OrderSide.Sell,
    type:
      o.type.toUpperCase() === "MARKET"
        ? ("market" as OpenOrder["type"])
        : ("limit" as OpenOrder["type"]),
    price: o.price ?? 0,
    size: o.quantity,
    filled,
    remaining: o.remainingQuantity,
    status: o.status === "PARTIALLY_FILLED" ? "partially_filled" : "open",
    timestamp: o.createdAt,
    reduceOnly: o.reduceOnly,
    postOnly: o.postOnly,
  };
}

function apiOrderToHistoryEntry(o: ApiOrder): OrderHistoryEntry {
  const filled = o.quantity - o.remainingQuantity;
  const status =
    o.status === "FILLED"
      ? "filled"
      : o.status === "CANCELLED" || o.status === "REJECTED"
        ? "cancelled"
        : "expired";
  return {
    id: o.id,
    symbol: o.marketId,
    side: o.side.toUpperCase() === "BUY" ? OrderSide.Buy : OrderSide.Sell,
    type:
      o.type.toUpperCase() === "MARKET"
        ? ("market" as OrderHistoryEntry["type"])
        : ("limit" as OrderHistoryEntry["type"]),
    price: o.price ?? 0,
    size: o.quantity,
    filled,
    status,
    fee: 0, // Fee is in fills, not orders
    timestamp: o.createdAt,
  };
}

function apiFillToTradeHistory(f: ApiFill): TradeHistoryEntry {
  return {
    id: f.id,
    symbol: f.marketId,
    side: f.side.toUpperCase() === "BUY" ? OrderSide.Buy : OrderSide.Sell,
    price: f.price,
    size: f.quantity,
    fee: f.fee,
    realizedPnl: f.realizedPnl,
    timestamp: f.createdAt,
  };
}

function apiPositionToPosition(p: ApiPosition): Position {
  return {
    id: `${p.userId}-${p.marketId}`,
    symbol: p.marketId,
    side: p.side === "LONG" ? PositionSide.Long : PositionSide.Short,
    size: p.quantity,
    entryPrice: p.entryPrice,
    markPrice: p.markPrice ?? 0,
    liquidationPrice: p.liquidationPrice ?? 0,
    margin: p.margin ?? 0,
    leverage: p.leverage ?? 1,
    unrealizedPnl: p.unrealizedPnl ?? 0,
    unrealizedPnlPercent:
      p.margin > 0 ? ((p.unrealizedPnl ?? 0) / p.margin) * 100 : 0,
    realizedPnl: p.realizedPnl ?? 0,
    timestamp: Date.now(),
  };
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    open: {
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      label: "Open",
    },
    partially_filled: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-500",
      label: "Partially Filled",
    },
    filled: {
      bg: "bg-emerald-500/10",
      text: "text-[#22c55e]",
      label: "Filled",
    },
    cancelled: {
      bg: "bg-red-500/10",
      text: "text-[#ef4444]",
      label: "Cancelled",
    },
    expired: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-500",
      label: "Expired",
    },
  };

  const c = config[status] ?? config.open!;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
        c.bg,
        c.text,
      )}
    >
      {c.label}
    </span>
  );
}

// ─── PnL cell ────────────────────────────────────────────────────────────────

function PnlCell({ value, percent }: { value: number; percent?: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "font-normal",
        isPositive ? "text-[#22c55e]" : "text-[#ef4444]",
      )}
    >
      {isPositive ? "+" : ""}
      {formatPrice(value)}
      {percent !== undefined && (
        <span className="ml-1 text-[10px] opacity-70">
          ({isPositive ? "+" : ""}
          {formatPrice(percent)}%)
        </span>
      )}
    </span>
  );
}

// ─── Side cell ───────────────────────────────────────────────────────────────

function SideCell({ side }: { side: OrderSide | PositionSide }) {
  const isBull = side === OrderSide.Buy || side === PositionSide.Long;
  const label =
    side === PositionSide.Long
      ? "Long"
      : side === PositionSide.Short
        ? "Short"
        : side === OrderSide.Buy
          ? "Buy"
          : "Sell";

  return (
    <span className={isBull ? "text-[#22c55e]" : "text-[#ef4444]"}>
      {label}
    </span>
  );
}

// ─── Generic table renderer ──────────────────────────────────────────────────

function DataTable<T>({
  data,
  columns,
  emptyMessage,
  loading,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyMessage: string;
  loading?: boolean;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
        <Loader2 className="size-3.5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-[#0d0d0f]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="whitespace-nowrap border-b border-[#1e1e22] px-3 py-2 text-left text-xs font-normal uppercase text-zinc-500"
                  style={{
                    width:
                      header.getSize() !== 150 ? header.getSize() : undefined,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-white/[0.02]"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="whitespace-nowrap border-b border-[#1e1e22]/50 px-3 py-2 font-normal text-zinc-300"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Not-logged-in placeholder ────────────────────────────────────────────────

function NotLoggedIn() {
  return (
    <div className="flex h-full items-center pt-16 justify-center text-xs text-zinc-500">
      Log in to see your data
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PositionsTable() {
  const [activeTab, setActiveTab] = useState<BottomTab>("positions");
  const { token, isLoggedIn } = useAuth();

  // ─── Real API data ────────────────────────────────────────────────────────
  const {
    data: apiPositions,
    loading: positionsLoading,
    refetch: refetchPositions,
  } = usePositions();
  const {
    data: apiAllOrders,
    loading: ordersLoading,
    refetch: refetchOrders,
  } = useOrders();
  const { data: apiFills, loading: fillsLoading } = useFills();

  // ─── Derived data ──────────────────────────────────────────────────────────
  const openOrdersRaw = useOpenOrders(apiAllOrders);
  const closedOrdersRaw = useClosedOrders(apiAllOrders);

  const positions = useMemo<Position[]>(
    () => (apiPositions ?? []).map(apiPositionToPosition),
    [apiPositions],
  );
  const openOrders = useMemo<OpenOrder[]>(
    () => openOrdersRaw.map(apiOrderToOpenOrder),
    [openOrdersRaw],
  );
  const orderHistory = useMemo<OrderHistoryEntry[]>(
    () => closedOrdersRaw.map(apiOrderToHistoryEntry),
    [closedOrdersRaw],
  );
  const tradeHistory = useMemo<TradeHistoryEntry[]>(
    () => (apiFills ?? []).map(apiFillToTradeHistory),
    [apiFills],
  );

  const counts = {
    positions: positions.length,
    openOrders: openOrders.length,
  };

  // ─── Cancel order ─────────────────────────────────────────────────────────

  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const handleCancel = useCallback(
    async (orderId: string) => {
      if (!token) {
        console.error("❌ Cannot cancel order: no authentication token");
        alert("Please log in to cancel orders");
        return;
      }
      
      console.log("🔄 Attempting to cancel order:", orderId);
      console.log("📝 Using token:", token?.substring(0, 20) + "...");
      
      setCancellingIds((prev) => new Set(prev).add(orderId));
      
      try {
        const result = await apiCancelOrder(token, orderId);
        console.log("✅ Order cancellation successful:", result);
        
        // Immediately refetch orders to update the UI
        await refetchOrders();
        console.log("🔄 Orders refreshed");
      } catch (err) {
        console.error("❌ Failed to cancel order:", err);
        
        // Enhanced error logging
        if (err instanceof Error) {
          console.error("📋 Error details:", {
            name: err.name,
            message: err.message,
            stack: err.stack,
          });
          
          // Show user-friendly error message
          alert(`Failed to cancel order: ${err.message}`);
        } else {
          console.error("📋 Unknown error type:", err);
          alert("Failed to cancel order: Unknown error");
        }
      } finally {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [token, refetchOrders],
  );

  // ─── Column definitions ──────────────────────────────────────────────────

  const positionColumns = useMemo<ColumnDef<Position, unknown>[]>(
    () => [
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#fafafa]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 60,
        cell: ({ getValue }) => <SideCell side={getValue<PositionSide>()} />,
      },
      {
        accessorKey: "size",
        header: "Size",
        size: 70,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "entryPrice",
        header: "Entry Price",
        size: 90,
        cell: ({ getValue }) => formatPrice(getValue<number>()),
      },
      {
        accessorKey: "markPrice",
        header: "Mark Price",
        size: 90,
        cell: ({ getValue }) => formatPrice(getValue<number>()),
      },
      {
        accessorKey: "liquidationPrice",
        header: "Liq. Price",
        size: 90,
        cell: ({ getValue }) => (
          <span className="text-yellow-500/80">
            {formatPrice(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "margin",
        header: "Margin",
        size: 80,
        cell: ({ getValue }) => `$${formatPrice(getValue<number>())}`,
      },
      {
        accessorKey: "leverage",
        header: "Leverage",
        size: 70,
        cell: ({ getValue }) => (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
            {getValue<number>()}×
          </span>
        ),
      },
      {
        id: "unrealizedPnl",
        header: "Unrealized PnL",
        size: 130,
        cell: ({ row }) => (
          <PnlCell
            value={row.original.unrealizedPnl}
            percent={row.original.unrealizedPnlPercent}
          />
        ),
      },
      {
        accessorKey: "realizedPnl",
        header: "Realized PnL",
        size: 100,
        cell: ({ getValue }) => <PnlCell value={getValue<number>()} />,
      },
      {
        id: "actions",
        header: "Actions",
        size: 70,
        cell: () => (
          <button className="rounded border border-[#27272a] px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
            Close
          </button>
        ),
      },
    ],
    [],
  );

  const openOrderColumns = useMemo<ColumnDef<OpenOrder, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        size: 130,
        cell: ({ getValue }) => (
          <span className="text-zinc-500">
            {formatDate(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#fafafa]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 50,
        cell: ({ getValue }) => <SideCell side={getValue<OrderSide>()} />,
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 80,
        cell: ({ getValue }) => (
          <span className="capitalize">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 90,
        cell: ({ getValue }) => formatPrice(getValue<number>()),
      },
      {
        accessorKey: "size",
        header: "Size",
        size: 70,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "filled",
        header: "Filled",
        size: 70,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "remaining",
        header: "Remaining",
        size: 80,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        id: "actions",
        header: "Actions",
        size: 70,
        cell: ({ row }) => {
          const orderId = row.original.id;
          const isCancelling = cancellingIds.has(orderId);
          return (
            <button
              disabled={isCancelling}
              onClick={() => handleCancel(orderId)}
              className="rounded border border-[#ef4444]/30 px-2 py-0.5 text-[10px] text-[#ef4444] transition-colors hover:border-[#ef4444]/60 hover:bg-[#ef4444]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isCancelling ? (
                <Loader2 className="size-2.5 animate-spin" />
              ) : null}
              Cancel
            </button>
          );
        },
      },
    ],
    [cancellingIds, handleCancel],
  );

  const orderHistoryColumns = useMemo<ColumnDef<OrderHistoryEntry, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        size: 130,
        cell: ({ getValue }) => (
          <span className="text-zinc-500">
            {formatDate(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#fafafa]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 50,
        cell: ({ getValue }) => <SideCell side={getValue<OrderSide>()} />,
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 80,
        cell: ({ getValue }) => (
          <span className="capitalize">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 90,
        cell: ({ getValue }) => formatPrice(getValue<number>()),
      },
      {
        accessorKey: "size",
        header: "Size",
        size: 70,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "filled",
        header: "Filled",
        size: 70,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "fee",
        header: "Fee",
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-zinc-500">
            ${formatPrice(getValue<number>())}
          </span>
        ),
      },
    ],
    [],
  );

  const tradeHistoryColumns = useMemo<ColumnDef<TradeHistoryEntry, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        size: 130,
        cell: ({ getValue }) => (
          <span className="text-zinc-500">
            {formatDate(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#fafafa]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 50,
        cell: ({ getValue }) => <SideCell side={getValue<OrderSide>()} />,
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 90,
        cell: ({ getValue }) => formatPrice(getValue<number>()),
      },
      {
        accessorKey: "size",
        header: "Size",
        size: 70,
        cell: ({ getValue }) => formatPrice(getValue<number>(), 4),
      },
      {
        accessorKey: "fee",
        header: "Fee",
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-zinc-500">
            ${formatPrice(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "realizedPnl",
        header: "Realized PnL",
        size: 100,
        cell: ({ getValue }) => <PnlCell value={getValue<number>()} />,
      },
    ],
    [],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[240px] max-h-[360px] flex-col rounded-sm bg-[#0d0d0f]">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border py-2 rounded-md border-[#1e1e22] px-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.countKey ? counts[tab.countKey] : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center cursor-pointer rounded-sm gap-1.5 px-2 py-1.5 text-xs font-medium transition-all duration-200",
                isActive
                  ? "text-[#fafafa]"
                  : "text-zinc-500 hover:text-zinc-400",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="positions-tab-active"
                  className="absolute inset-0 rounded-sm bg-zinc-900"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium relative z-10",
                    isActive
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-zinc-800 text-zinc-500",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table content */}
      <div className="min-h-0 flex-1">
        {!isLoggedIn ? (
          <NotLoggedIn />
        ) : (
          <>
            {activeTab === "positions" && (
              <DataTable
                data={positions}
                columns={positionColumns}
                emptyMessage="No open positions"
                loading={positionsLoading}
              />
            )}
            {activeTab === "open-orders" && (
              <DataTable
                data={openOrders}
                columns={openOrderColumns}
                emptyMessage="No open orders"
                loading={ordersLoading}
              />
            )}
            {activeTab === "order-history" && (
              <DataTable
                data={orderHistory}
                columns={orderHistoryColumns}
                emptyMessage="No order history"
                loading={ordersLoading}
              />
            )}
            {activeTab === "trade-history" && (
              <DataTable
                data={tradeHistory}
                columns={tradeHistoryColumns}
                emptyMessage="No trade history"
                loading={fillsLoading}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
