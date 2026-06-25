"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocketSubscription } from "./use-websocket";
import {
  apiGetOrders,
  apiGetBalances,
  apiGetPositions,
  apiSubmitOrder,
  apiCancelOrder,
  type ApiOrder,
  type ApiBalance,
  type ApiPosition,
  type SubmitOrderPayload,
} from "@/lib/api";

const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === "true";

/**
 * Hook for managing user balances with real-time updates
 */
export function useBalances(token: string | null) {
  const [balances, setBalances] = useState<ApiBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to balance updates via WebSocket
  const { data: wsBalances } = useWebSocketSubscription<ApiBalance[]>(
    "balances",
    undefined,
    token || undefined,
    USE_REAL_API && !!token
  );

  // Fetch balances from API
  const fetchBalances = useCallback(async () => {
    if (!token) {
      setBalances([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiGetBalances(token);
      setBalances(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
      console.error("Failed to fetch balances:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch initial balances
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Update balances when WebSocket data arrives
  useEffect(() => {
    if (wsBalances && USE_REAL_API) {
      setBalances(wsBalances);
    }
  }, [wsBalances]);

  return { balances, loading, error, refetch: fetchBalances };
}

/**
 * Hook for managing user positions with real-time updates
 */
export function usePositions(token: string | null) {
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to position updates via WebSocket
  const { data: wsPositions } = useWebSocketSubscription<ApiPosition[]>(
    "positions",
    undefined,
    token || undefined,
    USE_REAL_API && !!token
  );

  // Fetch initial positions
  useEffect(() => {
    if (!token) {
      setPositions([]);
      setLoading(false);
      return;
    }

    const fetchPositions = async () => {
      try {
        setLoading(true);
        const data = await apiGetPositions(token);
        setPositions(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch positions");
        console.error("Failed to fetch positions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, [token]);

  // Update positions when WebSocket data arrives
  useEffect(() => {
    if (wsPositions && USE_REAL_API) {
      setPositions(wsPositions);
    }
  }, [wsPositions]);

  return { positions, loading, error };
}

/**
 * Hook for managing user orders with real-time updates
 */
export function useOrders(token: string | null) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiGetOrders(token);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch initial orders
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Poll for order updates if not using WebSocket
  // (WebSocket support for orders can be added similar to balances/positions)
  useEffect(() => {
    if (!token || !USE_REAL_API) return;

    const interval = setInterval(fetchOrders, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [token, fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

/**
 * Hook for submitting and canceling orders
 */
export function useOrderActions(token: string | null) {
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitOrder = useCallback(
    async (payload: SubmitOrderPayload): Promise<ApiOrder | null> => {
      if (!token) {
        setError("Not authenticated");
        return null;
      }

      try {
        setSubmitting(true);
        setError(null);
        const order = await apiSubmitOrder(token, payload);
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to submit order";
        setError(errorMessage);
        console.error("Failed to submit order:", err);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [token]
  );

  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      if (!token) {
        setError("Not authenticated");
        return false;
      }

      try {
        setCanceling(orderId);
        setError(null);
        await apiCancelOrder(token, orderId);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to cancel order";
        setError(errorMessage);
        console.error("Failed to cancel order:", err);
        return false;
      } finally {
        setCanceling(null);
      }
    },
    [token]
  );

  return {
    submitOrder,
    cancelOrder,
    submitting,
    canceling,
    error,
  };
}

/**
 * Combined hook for all trading data
 */
export function useTradingData(token: string | null) {
  const balances = useBalances(token);
  const positions = usePositions(token);
  const orders = useOrders(token);
  const actions = useOrderActions(token);

  return {
    balances: balances.balances,
    positions: positions.positions,
    orders: orders.orders,
    loading: balances.loading || positions.loading || orders.loading,
    error: balances.error || positions.error || orders.error || actions.error,
    refetchOrders: orders.refetch,
    submitOrder: actions.submitOrder,
    cancelOrder: actions.cancelOrder,
    submitting: actions.submitting,
    canceling: actions.canceling,
  };
}
