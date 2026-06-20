import type { Balance, LedgerEntry, LedgerEntryType } from "./types";

export interface ApplyLedgerEntryInput {
  id: string;
  balance: Balance;
  type: LedgerEntryType;
  amount: number;
  referenceId?: string;
  createdAt: number;
}

export interface ApplyLedgerEntryResult {
  balance: Balance;
  entry: LedgerEntry;
}

export function applyLedgerEntry(
  input: ApplyLedgerEntryInput,
): ApplyLedgerEntryResult {
  const nextTotal = roundFinancial(input.balance.total + input.amount);

  if (nextTotal < 0) {
    throw new Error(
      `ledger entry would make ${input.balance.asset} balance negative`,
    );
  }

  const balance: Balance = {
    ...input.balance,
    total: nextTotal,
  };

  return {
    balance,
    entry: {
      id: input.id,
      userId: input.balance.userId,
      asset: input.balance.asset,
      type: input.type,
      amount: input.amount,
      balanceAfter: nextTotal,
      referenceId: input.referenceId,
      createdAt: input.createdAt,
    },
  };
}

export function availableBalance(balance: Balance): number {
  return roundFinancial(balance.total - balance.locked);
}

export function lockBalance(balance: Balance, amount: number): Balance {
  assertNonNegative(amount, "lock amount");

  if (availableBalance(balance) < amount) {
    throw new Error(`insufficient available ${balance.asset} balance`);
  }

  return {
    ...balance,
    locked: roundFinancial(balance.locked + amount),
  };
}

export function unlockBalance(balance: Balance, amount: number): Balance {
  assertNonNegative(amount, "unlock amount");

  if (balance.locked < amount) {
    throw new Error(`cannot unlock more ${balance.asset} than is locked`);
  }

  return {
    ...balance,
    locked: roundFinancial(balance.locked - amount),
  };
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
}

function roundFinancial(value: number): number {
  return Number(value.toFixed(12));
}
