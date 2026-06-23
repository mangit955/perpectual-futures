"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiGetBalances,
  apiGetFills,
  apiGetOrders,
  apiGetPositions,
  type ApiBalance,
  type ApiFill,
  type ApiOrder,
  type ApiPosition,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ─── Generic async data hook ─────────────────────────────────────────────────

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useApiData<T>(
  fetcher: (token: string) => Promise<T>,
  token: string | null,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetch = useCallback(() => {
    if (!token) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetcherRef
      .current(token)
      .then((result) => {
        setData(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useBalances ─────────────────────────────────────────────────────────────

export function useBalances(): AsyncState<ApiBalance[]> {
  const { token } = useAuth();
  return useApiData(apiGetBalances, token);
}

/** Returns the USDC (or first quote asset) available balance */
export function useUsdcBalance(): number {
  const { data } = useBalances();
  if (!data) return 0;
  const usdc = data.find(
    (b) =>
      b.asset === "USDC" ||
      b.asset === "USD" ||
      b.asset.toUpperCase().includes("USD"),
  );
  if (usdc) return Math.max(0, usdc.total - usdc.locked);
  // Fallback: first balance
  return data[0] ? Math.max(0, data[0].total - data[0].locked) : 0;
}

// ─── usePositions ────────────────────────────────────────────────────────────

export function usePositions(): AsyncState<ApiPosition[]> {
  const { token } = useAuth();
  return useApiData(apiGetPositions, token);
}

// ─── useOrders ───────────────────────────────────────────────────────────────

export function useOrders(): AsyncState<ApiOrder[]> {
  const { token } = useAuth();
  return useApiData(apiGetOrders, token);
}

export function useOpenOrders(allOrders: ApiOrder[] | null): ApiOrder[] {
  if (!allOrders) return [];
  return allOrders.filter(
    (o) => o.status === "OPEN" || o.status === "PARTIALLY_FILLED" || o.status === "PENDING",
  );
}

export function useClosedOrders(allOrders: ApiOrder[] | null): ApiOrder[] {
  if (!allOrders) return [];
  return allOrders.filter(
    (o) =>
      o.status === "FILLED" ||
      o.status === "CANCELLED" ||
      o.status === "EXPIRED" ||
      o.status === "REJECTED",
  );
}

// ─── useFills ────────────────────────────────────────────────────────────────

export function useFills(): AsyncState<ApiFill[]> {
  const { token } = useAuth();
  return useApiData(apiGetFills, token);
}
