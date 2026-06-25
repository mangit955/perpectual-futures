/**
 * Binance Price Fetcher
 * 
 * Fetches real-time SOL/USDT price from Binance API and WebSocket
 */

const BINANCE_API_URL = "https://api.binance.com/api/v3";
const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws";

export interface BinancePrice {
  symbol: string;
  price: number;
  timestamp: number;
}

/**
 * Fetch current SOL price from Binance REST API
 */
export async function fetchBinanceSOLPrice(): Promise<number> {
  try {
    const response = await fetch(`${BINANCE_API_URL}/ticker/price?symbol=SOLUSDT`);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json() as { symbol: string; price: string };
    const price = parseFloat(data.price);
    
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Invalid price from Binance");
    }
    
    return price;
  } catch (error) {
    console.error("Failed to fetch Binance SOL price:", error);
    // Fallback to a reasonable default if Binance is unavailable
    return 70.0;
  }
}

/**
 * Binance WebSocket price stream for real-time updates
 */
export class BinancePriceStream {
  private ws: WebSocket | null = null;
  private listeners: Set<(price: number) => void> = new Set();
  private currentPrice: number = 70.0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isIntentionallyClosed: boolean = false;

  constructor() {
    this.connect();
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      // Subscribe to SOL/USDT price stream
      this.ws = new WebSocket(`${BINANCE_WS_URL}/solusdt@ticker`);

      this.ws.onopen = () => {
        console.log("✅ Binance WebSocket connected");
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            e: string; // Event type
            s: string; // Symbol
            c: string; // Close price (current price)
            E: number; // Event time
          };

          if (data.e === "24hrTicker" && data.s === "SOLUSDT") {
            const price = parseFloat(data.c);
            
            if (Number.isFinite(price) && price > 0) {
              this.currentPrice = price;
              this.notifyListeners(price);
            }
          }
        } catch (error) {
          console.error("Error parsing Binance message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Binance WebSocket error:", error);
      };

      this.ws.onclose = () => {
        if (!this.isIntentionallyClosed) {
          console.log("Binance WebSocket closed, attempting to reconnect...");
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error("Failed to create Binance WebSocket:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached for Binance WebSocket");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting to Binance in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private notifyListeners(price: number): void {
    for (const listener of this.listeners) {
      try {
        listener(price);
      } catch (error) {
        console.error("Error in Binance price listener:", error);
      }
    }
  }

  /**
   * Subscribe to real-time price updates
   */
  subscribe(callback: (price: number) => void): () => void {
    this.listeners.add(callback);
    
    // Immediately call with current price
    callback(this.currentPrice);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get the current cached price
   */
  getCurrentPrice(): number {
    return this.currentPrice;
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.listeners.clear();
  }
}

// Singleton instance for the app
let priceStreamInstance: BinancePriceStream | null = null;

export function getBinancePriceStream(): BinancePriceStream {
  if (!priceStreamInstance) {
    priceStreamInstance = new BinancePriceStream();
  }
  return priceStreamInstance;
}

/**
 * React hook for using Binance price in components
 */
export function useBinancePrice(): number {
  if (typeof window === "undefined") {
    // Server-side rendering
    return 70.0;
  }

  const stream = getBinancePriceStream();
  return stream.getCurrentPrice();
}
