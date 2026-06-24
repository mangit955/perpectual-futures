"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiDeposit, apiWithdraw } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export function DepositButton() {
  const { token } = useAuth();
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDeposit = async () => {
    if (!token || !amount || isNaN(Number(amount))) return;
    setLoading(true);
    try {
      await apiDeposit(token, asset, Number(amount));
      setOpen(false);
      setAmount("");
      // Optionally trigger a balance refresh event here
      window.dispatchEvent(new CustomEvent("balances-updated"));
    } catch (error) {
      console.error("Deposit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="h-8 rounded-md px-4 text-xs font-semibold! text-emerald-600 hover:text-green-700 bg-green-600/20 cursor-pointer transition-colors hover:bg-green-600/15">
        Deposit
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Deposit</h4>
            <p className="text-sm text-muted-foreground">
              Add funds to your trading account.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <label htmlFor="asset" className="text-xs font-medium">
                Asset
              </label>
              <Input
                id="asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="col-span-2 h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <label htmlFor="amount" className="text-xs font-medium">
                Amount
              </label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-2 h-8 text-xs"
                placeholder="0.00"
              />
            </div>
          </div>
          <button
            onClick={handleDeposit}
            disabled={loading || !amount}
            className="h-8 w-full rounded-md bg-emerald-600 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Depositing..." : "Confirm Deposit"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WithdrawButton() {
  const { token } = useAuth();
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleWithdraw = async () => {
    if (!token || !amount || isNaN(Number(amount))) return;
    setLoading(true);
    try {
      await apiWithdraw(token, asset, Number(amount));
      setOpen(false);
      setAmount("");
      window.dispatchEvent(new CustomEvent("balances-updated"));
    } catch (error) {
      console.error("Withdraw failed:", error);
      alert(error instanceof Error ? error.message : "Withdraw failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="h-8 font-semibold! rounded-md text-blue-600 hover:text-blue-700 bg-blue-600/20 px-4 cursor-pointer text-xs transition-colors hover:bg-blue-600/15">
        Withdraw
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Withdraw</h4>
            <p className="text-sm text-muted-foreground">
              Withdraw funds from your account.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <label htmlFor="w-asset" className="text-xs font-medium">
                Asset
              </label>
              <Input
                id="w-asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="col-span-2 h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <label htmlFor="w-amount" className="text-xs font-medium">
                Amount
              </label>
              <Input
                id="w-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-2 h-8 text-xs"
                placeholder="0.00"
              />
            </div>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={loading || !amount}
            className="h-8 w-full rounded-md bg-blue-600 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Withdrawing..." : "Confirm Withdraw"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
