"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  OrderSide,
  OrderType,
  type TradeFormState,
} from "@/types/trading";
import { useLastPrice, formatPrice } from "@/hooks/use-market-feed";
import {
  ChevronDown,
  Info,
  DollarSign,
  List,
  Minus,
  Plus,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVERAGE_STEPS = [1, 2, 5, 10, 20, 50] as const;
const SLIDER_TICKS = [0, 25, 50, 75, 100] as const;

function leverageFromPercent(percent: number): number {
  const index = Math.round((percent / 100) * (LEVERAGE_STEPS.length - 1));
  return LEVERAGE_STEPS[Math.min(index, LEVERAGE_STEPS.length - 1)]!;
}

function percentFromLeverage(leverage: number): number {
  const index = LEVERAGE_STEPS.indexOf(leverage as (typeof LEVERAGE_STEPS)[number]);
  if (index === -1) return 0;
  return (index / (LEVERAGE_STEPS.length - 1)) * 100;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SideToggle({
  side,
  onSideChange,
}: {
  side: OrderSide;
  onSideChange: (side: OrderSide) => void;
}) {
  return (
    <div className="rounded-lg bg-[#111113] p-1">
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          className={`h-9 rounded-md text-sm font-medium transition-colors ${
            side === OrderSide.Buy
              ? "bg-emerald-600 text-white"
              : "bg-transparent text-zinc-500 hover:text-zinc-400"
          }`}
          onClick={() => onSideChange(OrderSide.Buy)}
        >
          Buy / Long
        </button>
        <button
          type="button"
          className={`h-9 rounded-md text-sm font-medium transition-colors ${
            side === OrderSide.Sell
              ? "bg-red-600 text-white"
              : "bg-transparent text-zinc-500 hover:text-zinc-400"
          }`}
          onClick={() => onSideChange(OrderSide.Sell)}
        >
          Sell / Short
        </button>
      </div>
    </div>
  );
}

function OrderTypeTabs({
  orderType,
  onOrderTypeChange,
}: {
  orderType: OrderType;
  onOrderTypeChange: (type: OrderType) => void;
}) {
  const tabs: { label: string; value: OrderType; hasDropdown?: boolean }[] = [
    { label: "Limit", value: OrderType.Limit },
    { label: "Market", value: OrderType.Market },
    { label: "Conditional", value: OrderType.Conditional, hasDropdown: true },
  ];

  return (
    <div className="flex items-center gap-3">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`relative pb-1.5 text-xs font-medium transition-colors ${
            orderType === tab.value
              ? "text-[#fafafa] after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:rounded-full after:bg-[#fafafa]"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
          onClick={() => onOrderTypeChange(tab.value)}
        >
          <span className="flex items-center gap-0.5">
            {tab.label}
            {tab.hasDropdown && <ChevronDown className="size-3" />}
          </span>
        </button>
      ))}
    </div>
  );
}

function PriceInput({
  value,
  onChange,
  onMidClick,
  onBboClick,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  onMidClick: () => void;
  onBboClick: () => void;
  disabled?: boolean;
}) {
  const handleIncrement = useCallback(() => {
    const num = parseFloat(value) || 0;
    onChange((num + 0.01).toFixed(2));
  }, [value, onChange]);

  const handleDecrement = useCallback(() => {
    const num = parseFloat(value) || 0;
    const next = num - 0.01;
    if (next >= 0) onChange(next.toFixed(2));
  }, [value, onChange]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Price</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMidClick}
            className="rounded-sm bg-[#18181b] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-[#27272a] hover:text-zinc-300"
          >
            Mid
          </button>
          <button
            type="button"
            onClick={onBboClick}
            className="rounded-sm bg-[#18181b] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-[#27272a] hover:text-zinc-300"
          >
            BBO
          </button>
        </div>
      </div>
      <div className="flex h-10 items-center rounded-lg border border-[#27272a] bg-[#111113] transition-colors focus-within:border-zinc-500">
        <button
          type="button"
          onClick={handleDecrement}
          className="flex h-full w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-full w-full min-w-0 bg-transparent text-center font-mono text-sm text-[#fafafa] outline-none placeholder:text-zinc-600 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleIncrement}
          className="flex h-full w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Plus className="size-3" />
        </button>
        <div className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-700/60 text-zinc-400">
          <DollarSign className="size-3" />
        </div>
      </div>
    </div>
  );
}

function QuantityInput({
  value,
  onChange,
  sliderPercent,
}: {
  value: string;
  onChange: (val: string) => void;
  sliderPercent: number;
}) {
  const handleIncrement = useCallback(() => {
    const num = parseFloat(value) || 0;
    onChange(String(num + 1));
  }, [value, onChange]);

  const handleDecrement = useCallback(() => {
    const num = parseFloat(value) || 0;
    const next = num - 1;
    if (next >= 0) onChange(String(next));
  }, [value, onChange]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Quantity</span>
      </div>
      <div className="flex h-10 items-center rounded-lg border border-[#27272a] bg-[#111113] transition-colors focus-within:border-zinc-500">
        <button
          type="button"
          onClick={handleDecrement}
          className="flex h-full w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full min-w-0 bg-transparent text-center font-mono text-sm text-[#fafafa] outline-none placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={handleIncrement}
          className="flex h-full w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Plus className="size-3" />
        </button>
        <button
          type="button"
          className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-300"
        >
          <List className="size-3.5" />
        </button>
      </div>
      <div className="flex justify-end">
        <span className="text-[10px] text-zinc-500">
          {sliderPercent > 0 ? `${sliderPercent}%` : "100%"}
        </span>
      </div>
    </div>
  );
}

function LeverageSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const leverage = leverageFromPercent(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Leverage</span>
        <span className="font-mono text-xs font-medium text-[#fafafa]">
          {leverage}x
        </span>
      </div>

      {/* Custom slider track */}
      <div className="relative px-1">
        <div className="relative h-5">
          {/* Track background */}
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[#27272a]" />

          {/* Active track fill */}
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-500"
            style={{ width: `${value}%` }}
          />

          {/* Tick marks */}
          {SLIDER_TICKS.map((tick) => (
            <div
              key={tick}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${tick}%` }}
            >
              <div
                className={`size-2 -translate-x-1/2 rounded-full border-2 ${
                  tick <= value
                    ? "border-blue-500 bg-blue-500"
                    : "border-[#27272a] bg-[#111113]"
                }`}
              />
            </div>
          ))}

          {/* Invisible range input for interaction */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />

          {/* Visible thumb */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ left: `${value}%` }}
          >
            <div className="size-3.5 -translate-x-1/2 rounded-full border-2 border-blue-500 bg-white shadow-sm" />
          </div>
        </div>
      </div>

      {/* Tick labels */}
      <div className="flex items-center justify-between px-1">
        {SLIDER_TICKS.map((tick) => (
          <button
            key={tick}
            type="button"
            onClick={() => onChange(tick)}
            className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-400"
          >
            {tick}%
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`font-mono text-xs ${valueClassName ?? "text-zinc-300"}`}>
        {value}
      </span>
    </div>
  );
}

function OptionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 select-none">
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
          checked
            ? "border-blue-500 bg-blue-500"
            : "border-[#27272a] bg-[#111113] hover:border-zinc-500"
        }`}
      >
        {checked && (
          <svg
            viewBox="0 0 12 12"
            fill="none"
            className="size-2.5 text-white"
          >
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-xs text-zinc-500">{label}</span>
    </label>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TradePanel() {
  const lastPrice = useLastPrice();

  const [form, setForm] = useState<TradeFormState>({
    side: OrderSide.Buy,
    orderType: OrderType.Limit,
    price: "",
    quantity: "12",
    leverage: 1,
    sliderPercent: 0,
    postOnly: false,
    ioc: false,
    reduceOnly: false,
    tpsl: false,
  });

  const [marginExpanded, setMarginExpanded] = useState(false);

  // Sync price with live feed on mount (avoids SSR hydration mismatch)
  const priceInitialized = useRef(false);
  useEffect(() => {
    if (!priceInitialized.current && lastPrice > 0) {
      priceInitialized.current = true;
      setForm((prev) => ({ ...prev, price: formatPrice(lastPrice) }));
    }
  }, [lastPrice]);

  // ─── Derived values ──────────────────────────────────────────────────────

  const price = useMemo(() => parseFloat(form.price) || 0, [form.price]);
  const quantity = useMemo(() => parseFloat(form.quantity) || 0, [form.quantity]);
  const leverage = useMemo(
    () => leverageFromPercent(form.sliderPercent),
    [form.sliderPercent]
  );
  const orderValue = useMemo(() => price * quantity, [price, quantity]);
  const marginRequired = useMemo(
    () => (leverage > 0 ? orderValue / leverage : 0),
    [orderValue, leverage]
  );

  // ─── Updaters ────────────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof TradeFormState>(key: K, value: TradeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSetMidPrice = useCallback(() => {
    updateField("price", formatPrice(lastPrice));
  }, [lastPrice, updateField]);

  const handleSetBboPrice = useCallback(() => {
    // BBO = best bid/offer; for now use last price as approximation
    updateField("price", formatPrice(lastPrice));
  }, [lastPrice, updateField]);

  const isBuy = form.side === OrderSide.Buy;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="space-y-3">
        {/* ─── 1. Buy/Sell Toggle ─────────────────────────────────────────── */}
        <SideToggle
          side={form.side}
          onSideChange={(side) => updateField("side", side)}
        />

        {/* ─── 2. Order Type Tabs ────────────────────────────────────────── */}
        <OrderTypeTabs
          orderType={form.orderType}
          onOrderTypeChange={(type) => updateField("orderType", type)}
        />

        {/* ─── 3. Available Equity ───────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Available Equity</span>
          <span className="font-mono text-xs text-zinc-400">$0.00</span>
        </div>

        {/* ─── 4. Price Input ────────────────────────────────────────────── */}
        <PriceInput
          value={form.price}
          onChange={(val) => updateField("price", val)}
          onMidClick={handleSetMidPrice}
          onBboClick={handleSetBboPrice}
          disabled={form.orderType === OrderType.Market}
        />

        {/* ─── 5. Quantity Input ─────────────────────────────────────────── */}
        <QuantityInput
          value={form.quantity}
          onChange={(val) => updateField("quantity", val)}
          sliderPercent={form.sliderPercent}
        />

        {/* ─── 6. Leverage Slider ────────────────────────────────────────── */}
        <LeverageSlider
          value={form.sliderPercent}
          onChange={(val) => updateField("sliderPercent", val)}
        />

        {/* ─── 7. Order Value ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-400">Order Value</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-semibold text-[#fafafa]">
              {formatPrice(orderValue)}
            </span>
            <div
              className={`flex size-5 items-center justify-center rounded-full ${
                isBuy
                  ? "bg-emerald-500/20 text-emerald-500"
                  : "bg-red-500/20 text-red-500"
              }`}
            >
              <DollarSign className="size-3" />
            </div>
          </div>
        </div>

        {/* ─── 8. Info Rows ──────────────────────────────────────────────── */}
        <div className="space-y-1.5 border-t border-[#1e1e22] pt-3">
          <InfoRow
            label="Margin Required"
            value={`$${formatPrice(marginRequired)}`}
          />
          <InfoRow label="Est. Liquidation Price" value="—" />
        </div>

        {/* ─── 9. Action Button ──────────────────────────────────────────── */}
        <button
          type="button"
          className={`h-10 w-full rounded-lg text-sm font-semibold text-white transition-colors ${
            isBuy
              ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
              : "bg-red-600 hover:bg-red-500 active:bg-red-700"
          }`}
        >
          {isBuy ? "Buy / Long" : "Sell / Short"}
        </button>

        {/* ─── 10. Option Checkboxes ─────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <OptionCheckbox
              label="Post Only"
              checked={form.postOnly}
              onChange={(val) => updateField("postOnly", val)}
            />
            <OptionCheckbox
              label="IOC"
              checked={form.ioc}
              onChange={(val) => updateField("ioc", val)}
            />
            <OptionCheckbox
              label="Reduce Only"
              checked={form.reduceOnly}
              onChange={(val) => updateField("reduceOnly", val)}
            />
          </div>
          <div>
            <OptionCheckbox
              label="TP/SL"
              checked={form.tpsl}
              onChange={(val) => updateField("tpsl", val)}
            />
          </div>
        </div>
      </div>

      {/* ─── 11. Cross Margin Overview ─────────────────────────────────── */}
      <div className="mt-auto border-t border-[#1e1e22] pt-3">
        <button
          type="button"
          onClick={() => setMarginExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between text-xs text-zinc-400 transition-colors hover:text-zinc-300"
        >
          <span className="flex items-center gap-1">
            Cross Margin Overview
            <Info className="size-3" />
          </span>
          <ChevronDown
            className={`size-3 transition-transform ${
              marginExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {marginExpanded && (
          <div className="mt-2 space-y-1.5">
            <InfoRow label="Total Equity" value="$0.00" />
            <InfoRow label="Available Balance" value="$0.00" />
            <InfoRow label="Unrealized PnL" value="$0.00" />
            <InfoRow label="Margin Ratio" value="—" />
          </div>
        )}
      </div>
    </div>
  );
}
