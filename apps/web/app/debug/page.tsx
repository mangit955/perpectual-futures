"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const useRealApi = process.env.NEXT_PUBLIC_USE_REAL_API;

  const [apiHealth, setApiHealth] = useState<string>("Checking...");
  const [wsStatus, setWsStatus] = useState<string>("Checking...");
  const [orderbookTest, setOrderbookTest] = useState<string>("Pending");

  useEffect(() => {
    // Test API health
    const testApi = async () => {
      try {
        const res = await fetch(`${apiUrl}/health`);
        const data = await res.json();
        setApiHealth(`✅ OK - ${JSON.stringify(data)}`);
      } catch (err) {
        setApiHealth(`❌ FAILED - ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    // Test WebSocket
    const testWs = () => {
      try {
        const ws = new WebSocket(wsUrl || "");
        
        ws.onopen = () => {
          setWsStatus("✅ Connected");
          ws.close();
        };
        
        ws.onerror = (err) => {
          setWsStatus(`❌ Connection Failed - ${JSON.stringify(err)}`);
        };
        
        ws.onclose = (event) => {
          if (!event.wasClean) {
            setWsStatus(`❌ Closed unexpectedly - Code: ${event.code}, Reason: ${event.reason}`);
          }
        };
        
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            setWsStatus(`❌ Timeout - ReadyState: ${ws.readyState}`);
            ws.close();
          }
        }, 5000);
      } catch (err) {
        setWsStatus(`❌ Error - ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    // Test orderbook endpoint
    const testOrderbook = async () => {
      try {
        const res = await fetch(`${apiUrl}/markets/BTC-PERP/orderbook?depth=5`);
        const data = await res.json();
        setOrderbookTest(`✅ OK - Bids: ${data.bids?.length || 0}, Asks: ${data.asks?.length || 0}`);
      } catch (err) {
        setOrderbookTest(`❌ FAILED - ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    testApi();
    testWs();
    testOrderbook();
  }, [apiUrl, wsUrl]);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Environment & Connection Debug</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-bold mb-2">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <strong>NEXT_PUBLIC_API_URL:</strong> {apiUrl || "NOT SET"}
            </div>
            <div>
              <strong>NEXT_PUBLIC_WS_URL:</strong> {wsUrl || "NOT SET"}
            </div>
            <div>
              <strong>NEXT_PUBLIC_USE_REAL_API:</strong> {useRealApi || "NOT SET"}
            </div>
          </div>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-bold mb-2">Connection Tests</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <strong>API Health:</strong> {apiHealth}
            </div>
            <div>
              <strong>WebSocket:</strong> {wsStatus}
            </div>
            <div>
              <strong>Orderbook API:</strong> {orderbookTest}
            </div>
          </div>
        </div>

        <div className="border p-4 rounded bg-yellow-50">
          <h2 className="font-bold mb-2">Instructions</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Check if all tests show ✅</li>
            <li>If API/Orderbook fails, your Railway API might be down</li>
            <li>If WebSocket fails, Railway might not support WebSockets or needs configuration</li>
            <li>Open browser console (F12) for detailed logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
