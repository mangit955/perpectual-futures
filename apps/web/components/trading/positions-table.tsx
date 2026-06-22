"use client";

import { useState, useMemo } from "react";
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
import {
  generatePositions,
  generateOpenOrders,
  generateOrderHistory,
  generateTradeHistory,
} from "@/lib/mock/market-data";
import { formatPrice, formatDate } from "@/hooks/use-market-feed";
import { cn } from "@/lib/utils";

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

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: string;
}) {
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
        c.text
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
        "font-mono",
        isPositive ? "text-[#22c55e]" : "text-[#ef4444]"
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
  const isBull =
    side === OrderSide.Buy || side === PositionSide.Long;
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
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyMessage: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
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
                  className="whitespace-nowrap border-b border-[#1e1e22]/50 px-3 py-2 font-mono text-zinc-300"
                >
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PositionsTable() {
  const [activeTab, setActiveTab] = useState<BottomTab>("positions");

  // Mock data – stable references via useMemo
  const positions = useMemo(() => generatePositions(), []);
  const openOrders = useMemo(() => generateOpenOrders(), []);
  const orderHistory = useMemo(() => generateOrderHistory(), []);
  const tradeHistory = useMemo(() => generateTradeHistory(), []);

  const counts = {
    positions: positions.length,
    openOrders: openOrders.length,
  };

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
    []
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
        cell: () => (
          <button className="rounded border border-[#ef4444]/30 px-2 py-0.5 text-[10px] text-[#ef4444] transition-colors hover:border-[#ef4444]/60 hover:bg-[#ef4444]/10">
            Cancel
          </button>
        ),
      },
    ],
    []
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
    []
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
    []
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[200px] flex-col rounded-lg border border-[#1e1e22] bg-[#0d0d0f]">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[#1e1e22] px-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.countKey ? counts[tab.countKey] : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-[#fafafa]"
                  : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                    isActive
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-zinc-800 text-zinc-500"
                  )}
                >
                  {count}
                </span>
              )}
              {/* Active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-[1px] bg-[#fafafa]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Table content */}
      <div className="min-h-0 flex-1">
        {activeTab === "positions" && (
          <DataTable
            data={positions}
            columns={positionColumns}
            emptyMessage="No open positions"
          />
        )}
        {activeTab === "open-orders" && (
          <DataTable
            data={openOrders}
            columns={openOrderColumns}
            emptyMessage="No open orders"
          />
        )}
        {activeTab === "order-history" && (
          <DataTable
            data={orderHistory}
            columns={orderHistoryColumns}
            emptyMessage="No order history"
          />
        )}
        {activeTab === "trade-history" && (
          <DataTable
            data={tradeHistory}
            columns={tradeHistoryColumns}
            emptyMessage="No trade history"
          />
        )}
      </div>
    </div>
  );
}
