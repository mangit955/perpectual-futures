/**
 * Real WebSocket client for connecting to the backend
 */

// Get WebSocket URL with proper fallback
const getWebSocketUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser environment - check for runtime config
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;
    const defaultUrl = "ws://localhost:3000/ws";
    const url = envUrl || defaultUrl;
    console.log('[WebSocket] Using URL:', url, '(from env:', envUrl, ')');
    return url;
  }
  // Server environment
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000/ws";
};

const WS_URL = getWebSocketUrl();

export type Channel = "trades" | "orderbook" | "positions" | "balances" | "orders" | "mark_price" | "funding";

export interface SubscribeMessage {
  op: "subscribe";
  channel: Channel;
  market?: string;
  token?: string;
}

export interface UnsubscribeMessage {
  op: "unsubscribe";
  channel: Channel;
  market?: string;
}

export interface ServerMessage {
  type: "subscribed" | "unsubscribed" | "error" | "snapshot" | "update" | "resync";
  channel?: Channel;
  topic?: string;
  sequence?: number;
  data?: any;
  reason?: string;
}

type MessageHandler = (message: ServerMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private shouldReconnect = true;
  private subscriptions = new Map<string, SubscribeMessage>();
  private connectPromise: Promise<void> | null = null;

  constructor(private url: string = WS_URL) {}

  connect(): Promise<void> {
    // If already connected, return immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Already connected");
      return Promise.resolve();
    }
    
    // If connection is in progress, return the existing promise
    if (this.connectPromise) {
      console.log("[WebSocket] Connection already in progress, waiting...");
      return this.connectPromise;
    }
    
    // If currently connecting, wait for it
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("[WebSocket] WebSocket is connecting, creating wait promise...");
      this.connectPromise = new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            this.connectPromise = null;
            resolve();
          } else if (this.ws?.readyState === WebSocket.CLOSED || this.ws?.readyState === WebSocket.CLOSING) {
            clearInterval(checkInterval);
            this.connectPromise = null;
            reject(new Error('WebSocket connection failed'));
          }
        }, 50);
      });
      return this.connectPromise;
    }
    
    console.log(`[WebSocket] Attempting to connect to: ${this.url}`);
    
    this.connectPromise = new Promise((resolve, reject) => {
      try {
        // Validate URL before attempting connection
        try {
          const url = new URL(this.url);
          if (!url.protocol.match(/^wss?:$/)) {
            throw new Error(`Invalid WebSocket protocol: ${url.protocol}`);
          }
        } catch (urlError) {
          console.error("[WebSocket] Invalid URL:", this.url, urlError);
          reject(new Error(`Invalid WebSocket URL: ${this.url}`));
          this.connectPromise = null;
          return;
        }
        
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("[WebSocket] Connected successfully");
          console.log("[WebSocket] ReadyState after open:", this.getReadyStateText(this.ws?.readyState));
          this.reconnectAttempts = 0;
          
          // Resubscribe to previous subscriptions
          if (this.subscriptions.size > 0) {
            console.log(`[WebSocket] Resubscribing to ${this.subscriptions.size} previous subscriptions`);
            for (const [key, sub] of this.subscriptions) {
              console.log(`[WebSocket] Resubscribing to: ${key}`);
              this.send(sub);
            }
          } else {
            console.log("[WebSocket] No previous subscriptions to restore");
          }
          
          this.connectPromise = null;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
          }
        };

        this.ws.onerror = (event) => {
          console.error("[WebSocket] Error event:", {
            type: event.type,
            target: event.target,
            currentTarget: event.currentTarget,
            url: this.url,
            readyState: this.ws?.readyState,
            readyStateText: this.getReadyStateText(this.ws?.readyState)
          });
          
          // Reject with more detailed error
          const errorMsg = `WebSocket connection failed to ${this.url} (readyState: ${this.getReadyStateText(this.ws?.readyState)})`;
          this.connectPromise = null;
          reject(new Error(errorMsg));
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason || 'none'}, clean: ${event.wasClean})`);
          this.ws = null;
          this.connectPromise = null;
          
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`[WebSocket] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect().catch(err => {
                console.error("[WebSocket] Reconnection failed:", err);
              });
            }, delay);
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("[WebSocket] Max reconnection attempts reached");
          }
        };
      } catch (error) {
        console.error("[WebSocket] Failed to create WebSocket:", error);
        this.connectPromise = null;
        reject(error);
      }
    });
    
    return this.connectPromise;
  }

  private getReadyStateText(state: number | undefined): string {
    if (state === undefined) return 'undefined';
    switch (state) {
      case WebSocket.CONNECTING: return 'CONNECTING (0)';
      case WebSocket.OPEN: return 'OPEN (1)';
      case WebSocket.CLOSING: return 'CLOSING (2)';
      case WebSocket.CLOSED: return 'CLOSED (3)';
      default: return `UNKNOWN (${state})`;
    }
  }

  subscribe(channel: Channel, market?: string, token?: string): string {
    const message: SubscribeMessage = {
      op: "subscribe",
      channel,
      market,
      token,
    };
    
    const key = this.getSubscriptionKey(channel, market);
    this.subscriptions.set(key, message);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(message);
    }
    
    return key;
  }

  unsubscribe(channel: Channel, market?: string): void {
    const key = this.getSubscriptionKey(channel, market);
    this.subscriptions.delete(key);
    
    const message: UnsubscribeMessage = {
      op: "unsubscribe",
      channel,
      market,
    };
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(message);
    }
  }

  on(topic: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(topic);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(topic);
        }
      }
    };
  }

  disconnect(): void {
    console.log("[WebSocket] Disconnecting...");
    this.shouldReconnect = false;
    this.subscriptions.clear();
    this.connectPromise = null;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private send(message: SubscribeMessage | UnsubscribeMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: ServerMessage): void {
    // Emit to topic-specific handlers
    if (message.topic) {
      const handlers = this.handlers.get(message.topic);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (error) {
            console.error("Error in message handler:", error);
          }
        }
      }
    }
    
    // Also emit to channel handlers
    if (message.channel) {
      const channelHandlers = this.handlers.get(`channel:${message.channel}`);
      if (channelHandlers) {
        for (const handler of channelHandlers) {
          try {
            handler(message);
          } catch (error) {
            console.error("Error in channel handler:", error);
          }
        }
      }
    }
    
    // Emit to global handlers
    const globalHandlers = this.handlers.get("*");
    if (globalHandlers) {
      for (const handler of globalHandlers) {
        try {
          handler(message);
        } catch (error) {
          console.error("Error in global handler:", error);
        }
      }
    }
  }

  private getSubscriptionKey(channel: Channel, market?: string): string {
    return market ? `${channel}:${market}` : channel;
  }
}

// Singleton instance - only create when needed
let instance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient | null {
  // Return null in SSR - hooks will handle this gracefully
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!instance) {
    console.log('[WebSocket] Creating new WebSocketClient instance');
    instance = new WebSocketClient();
  }
  return instance;
}

export function resetWebSocketClient(): void {
  if (instance) {
    console.log('[WebSocket] Resetting WebSocketClient instance');
    instance.disconnect();
    instance = null;
  }
}
