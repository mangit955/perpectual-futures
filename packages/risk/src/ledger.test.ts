import { describe, expect, it } from "bun:test";
import {
  applyLedgerEntry,
  availableBalance,
  lockBalance,
  unlockBalance,
} from "./ledger";
import type { Balance } from "./types";

describe("balance ledger", () => {
  it("applies deposits and records balanceAfter", () => {
    const result = applyLedgerEntry({
      id: "ledger-1",
      balance: balance({ total: 100 }),
      type: "DEPOSIT",
      amount: 50,
      referenceId: "deposit-1",
      createdAt: 1,
    });

    expect(result.balance).toMatchObject({
      total: 150,
      locked: 0,
    });
    expect(result.entry).toEqual({
      id: "ledger-1",
      userId: "user-1",
      asset: "USDC",
      type: "DEPOSIT",
      amount: 50,
      balanceAfter: 150,
      referenceId: "deposit-1",
      createdAt: 1,
    });
  });

  it("applies trading fees as negative ledger entries", () => {
    const result = applyLedgerEntry({
      id: "ledger-1",
      balance: balance({ total: 100 }),
      type: "TRADING_FEE",
      amount: -0.25,
      referenceId: "fill-1",
      createdAt: 1,
    });

    expect(result.balance.total).toBe(99.75);
    expect(result.entry.balanceAfter).toBe(99.75);
  });

  it("rejects ledger entries that would make total balance negative", () => {
    expect(() =>
      applyLedgerEntry({
        id: "ledger-1",
        balance: balance({ total: 10 }),
        type: "TRADING_FEE",
        amount: -11,
        createdAt: 1,
      }),
    ).toThrow("balance negative");
  });

  it("locks and unlocks available balance", () => {
    const locked = lockBalance(balance({ total: 100, locked: 10 }), 30);

    expect(availableBalance(locked)).toBe(60);
    expect(locked.locked).toBe(40);

    const unlocked = unlockBalance(locked, 15);

    expect(unlocked.locked).toBe(25);
    expect(availableBalance(unlocked)).toBe(75);
  });

  it("rejects locking more than available balance", () => {
    expect(() => lockBalance(balance({ total: 100, locked: 90 }), 20)).toThrow(
      "insufficient available",
    );
  });
});

function balance(overrides: Partial<Balance> = {}): Balance {
  return {
    userId: "user-1",
    asset: "USDC",
    total: overrides.total ?? 0,
    locked: overrides.locked ?? 0,
  };
}
