"use client";

import { useEffect, useRef, useState } from "react";
import { getWebSocketClient, type Channel, type ServerMessage } from "@/lib/websocket-client";

/**
 * Hook to connect to WebSocket and auto-reconnect
 */
export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState<ReturnType<typeof getWebSocketClient>>(null);

  useEffect(() => {
    // Only initialize client in browser
    const wsClient = getWebSocketClient();
    if (!wsClient) {
      console.log("[useWebSocket] Skipping WebSocket in SSR");
      return;
    }
    
    setClient(wsClient);
    
    const connectAndListen = async () => {
      try {
        await wsClient.connect();
        setIsConnected(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[useWebSocket] Failed to connect:", errorMessage);
        console.error("[useWebSocket] Full error:", error);
        setIsConnected(false);
      }
    };

    connectAndListen();

    // Listen for connection status changes
    const unsubscribe = wsClient.on("*", (message) => {
      if (message.type === "error") {
        console.error("[useWebSocket] WebSocket error message:", message.reason);
      }
    });

    return () => {
      unsubscribe();
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  return { isConnected, client };
}

/**
 * Hook to subscribe to a WebSocket channel
 */
export function useWebSocketSubscription<T = any>(
  channel: Channel,
  market?: string,
  token?: string,
  enabled: boolean = true
): {
  data: T | null;
  isConnected: boolean;
  error: string | null;
} {
  const { isConnected, client } = useWebSocketConnection();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !isConnected || !client) {
      return;
    }

    // Subscribe to the channel
    const subscriptionKey = client.subscribe(channel, market, token);
    
    // Listen for updates on this topic
    const unsubscribe = client.on(subscriptionKey, (message: ServerMessage) => {
      if (message.type === "error") {
        setError(message.reason || "Unknown error");
      } else if (message.type === "update" || message.type === "snapshot") {
        setData(message.data as T);
        setError(null);
      } else if (message.type === "resync") {
        console.warn(`Resync requested for ${subscriptionKey}:`, message.reason);
      }
    });

    return () => {
      unsubscribe();
      client.unsubscribe(channel, market);
    };
  }, [channel, market, token, enabled, isConnected, client]);

  return { data, isConnected, error };
}

/**
 * Hook to listen for WebSocket updates with a callback
 */
export function useWebSocketListener<T = any>(
  channel: Channel,
  market: string | undefined,
  callback: (data: T) => void,
  token?: string,
  enabled: boolean = true
): { isConnected: boolean; error: string | null } {
  const { isConnected, client } = useWebSocketConnection();
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !isConnected || !client) {
      return;
    }

    const subscriptionKey = client.subscribe(channel, market, token);
    
    const unsubscribe = client.on(subscriptionKey, (message: ServerMessage) => {
      if (message.type === "error") {
        setError(message.reason || "Unknown error");
      } else if (message.type === "update" || message.type === "snapshot") {
        callbackRef.current(message.data as T);
        setError(null);
      }
    });

    return () => {
      unsubscribe();
      client.unsubscribe(channel, market);
    };
  }, [channel, market, token, enabled, isConnected, client]);

  return { isConnected, error };
}
