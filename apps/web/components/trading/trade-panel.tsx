"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { OrderSide, OrderType, type TradeFormState } from "@/types/trading";
import { useLastPrice, formatPrice } from "@/hooks/use-market-feed";
import { ChevronDown, Info, DollarSign, List, Minus, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUsdcBalance } from "@/hooks/use-api-data";
import { apiSubmitOrder, ApiError } from "@/lib/api";

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVERAGE_STEPS = [1, 2, 5, 10, 20, 50] as const;
const SLIDER_TICKS = [0, 25, 50, 75, 100] as const;

// Default market — in a real app this would come from a market selector context
const DEFAULT_MARKET_ID = "BTC-PERP";

function leverageFromPercent(percent: number): number {
  const index = Math.round((percent / 100) * (LEVERAGE_STEPS.length - 1));
  return LEVERAGE_STEPS[Math.min(index, LEVERAGE_STEPS.length - 1)]!;
}

function percentFromLeverage(leverage: number): number {
  const index = LEVERAGE_STEPS.indexOf(
    leverage as (typeof LEVERAGE_STEPS)[number],
  );
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
    <div className="relative rounded-lg bg-[#111113] p-1">
      {/* Sliding background */}
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md transition-all duration-300 ease-out ${
          side === OrderSide.Buy
            ? "left-1 bg-emerald-500/15"
            : "left-[calc(50%+2px)] bg-red-500/15"
        }`}
      />

      <div className="relative grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onSideChange(OrderSide.Buy)}
          className={`h-9 rounded-md text-sm cursor-pointer font-semibold transition-colors duration-300 ${
            side === OrderSide.Buy
              ? "text-emerald-400"
              : "text-zinc-500 hover:text-emerald-600"
          }`}
        >
          Buy / Long
        </button>

        <button
          type="button"
          onClick={() => onSideChange(OrderSide.Sell)}
          className={`h-9 rounded-md text-sm cursor-pointer font-semibold transition-colors duration-300 ${
            side === OrderSide.Sell
              ? "text-red-400"
              : "text-zinc-500 hover:text-red-400"
          }`}
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
  ];

  return (
    <div className="flex items-center gap-3">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`relative cursor-pointer rounded-sm px-3  text-xs font-medium transition-colors ${
            orderType === tab.value
              ? "text-[#fafafa] bg-zinc-900"
              : "text-zinc-500 hover:text-zinc-300"
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
          disabled={disabled}
          onClick={handleDecrement}
          className={`flex h-full w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors ${disabled ? "cursor-not-allowed" : "hover:text-zinc-300"} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Minus
            className={`size-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-full w-full min-w-0 bg-transparent text-center font-mono text-sm text-[#fafafa] outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={handleIncrement}
          className={`flex h-full w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors ${disabled ? "cursor-not-allowed" : "hover:text-zinc-300"} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Plus
            className={`size-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          />
        </button>
        <div
          className={`mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
            disabled ? "bg-zinc-800 cursor-not-allowed" : "bg-green-700"
          }`}
        >
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
          <Minus className="size-3 cursor-pointer" />
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
          <Plus className="size-3 cursor-pointer" />
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
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-500 transition-all duration-300 ease-out"
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
                className={`size-2 -translate-x-1/2 rounded-full border-2 transition-all duration-300 ${
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
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
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
      <span
        className={`font-mono text-xs ${valueClassName ?? "text-zinc-300"}`}
      >
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
          <svg viewBox="0 0 12 12" fill="none" className="size-2.5 text-white">
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

// ─── Order Status Banner ──────────────────────────────────────────────────────

function OrderBanner({
  status,
  message,
  onDismiss,
}: {
  status: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`rounded-md px-3 py-2 text-xs flex items-center justify-between gap-2 ${
        status === "success"
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      <span className="min-w-0 break-words">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-current opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TradePanel() {
  const lastPrice = useLastPrice();
  const { token, isLoggedIn } = useAuth();
  const availableBalance = useUsdcBalance();

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
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

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
  const quantity = useMemo(
    () => parseFloat(form.quantity) || 0,
    [form.quantity],
  );
  const leverage = useMemo(
    () => leverageFromPercent(form.sliderPercent),
    [form.sliderPercent],
  );
  const orderValue = useMemo(() => price * quantity, [price, quantity]);
  const marginRequired = useMemo(
    () => (leverage > 0 ? orderValue / leverage : 0),
    [orderValue, leverage],
  );

  // ─── Updaters ────────────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof TradeFormState>(key: K, value: TradeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSetMidPrice = useCallback(() => {
    updateField("price", formatPrice(lastPrice));
  }, [lastPrice, updateField]);

  const handleSetBboPrice = useCallback(() => {
    // BBO = best bid/offer; for now use last price as approximation
    updateField("price", formatPrice(lastPrice));
  }, [lastPrice, updateField]);

  // ─── Order submission ─────────────────────────────────────────────────────

  const handleSubmitOrder = useCallback(async () => {
    if (!isLoggedIn || !token) {
      setBanner({ status: "error", message: "Please log in to place orders." });
      return;
    }
    if (quantity <= 0) {
      setBanner({ status: "error", message: "Quantity must be greater than 0." });
      return;
    }
    if (form.orderType === OrderType.Limit && price <= 0) {
      setBanner({ status: "error", message: "Price must be greater than 0 for limit orders." });
      return;
    }

    setSubmitting(true);
    setBanner(null);

    try {
      const order = await apiSubmitOrder(token, {
        marketId: DEFAULT_MARKET_ID,
        side: form.side === OrderSide.Buy ? "buy" : "sell",
        type: form.orderType === OrderType.Market ? "market" : "limit",
        quantity,
        price: form.orderType === OrderType.Limit ? price : undefined,
        leverage,
        timeInForce: form.ioc ? "IOC" : "GTC",
        reduceOnly: form.reduceOnly,
        postOnly: form.postOnly,
      });

      if (order.status === "REJECTED") {
        setBanner({
          status: "error",
          message: `Order rejected: ${order.rejectionReason ?? "Unknown reason"}`,
        });
      } else {
        setBanner({
          status: "success",
          message: `Order placed — ${order.status.toLowerCase().replace("_", " ")} (${order.id})`,
        });
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to place order";
      setBanner({ status: "error", message });
    } finally {
      setSubmitting(false);
    }
  }, [isLoggedIn, token, quantity, price, form, leverage]);

  const isBuy = form.side === OrderSide.Buy;

  return (
    <div className="flex h-full border rounded-lg p-2 border-[#1e1e22] flex-col p-4">
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
          <span className="font-mono text-xs text-zinc-400">
            {isLoggedIn ? `$${formatPrice(availableBalance)}` : "—"}
          </span>
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
            <div className="flex size-5 items-center justify-center rounded-full bg-yellow-600 text-white">
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

        {/* ─── 9. Order banner ───────────────────────────────────────────── */}
        {banner && (
          <OrderBanner
            status={banner.status}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        )}

        {/* ─── 10. Action Button ─────────────────────────────────────────── */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmitOrder}
          className={`h-10 w-full cursor-pointer rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            isBuy
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-red-500/70 hover:bg-red-500 "
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Placing order…
            </>
          ) : isLoggedIn ? (
            isBuy ? "Buy / Long" : "Sell / Short"
          ) : (
            "Log in to trade"
          )}
        </button>

        {/* ─── 11. Option Checkboxes ─────────────────────────────────────── */}
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
    </div>
  );
}
