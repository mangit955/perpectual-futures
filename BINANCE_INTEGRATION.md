# Binance Real Price Integration

This document explains how real-time SOL prices from Binance are integrated into the orderbook.

## Overview

The system now fetches **real SOL/USDT prices from Binance** and uses them to generate orderbook entries, while keeping your own matching engine for trades.

## Architecture

### Components

1. **Binance Price Fetcher** (`apps/web/lib/binance-price.ts`)
   - Fetches initial SOL price from Binance REST API
   - Maintains WebSocket connection to Binance for real-time updates
   - Provides singleton `BinancePriceStream` for the entire app
   - Auto-reconnects on connection failures with exponential backoff

2. **Mock Market Feed** (`apps/web/lib/mock/websocket.ts`)
   - Subscribes to Binance price stream
   - Regenerates orderbook around real SOL price
   - Creates realistic spread (±$0.15 from mid price)
   - Updates quantities every 500ms for "living" orderbook feel

3. **Market Data Generator** (`apps/web/lib/mock/market-data.ts`)
   - Generates asks/bids around provided mid price
   - Supports micro-changes mode (quantity updates only)
   - Syncs candle data with real prices

## Data Flow

```
Binance WebSocket (SOL/USDT ticker)
    ↓
BinancePriceStream
    ↓
MockMarketFeed.lastPrice
    ↓
generateOrderBook(realPrice, 15 levels)
    ↓
Frontend Orderbook Display
```

## Key Features

✅ **Real-time price sync** - WebSocket updates from Binance every ~250ms  
✅ **Stable on refresh** - Price persists across page reloads (uses same Binance source)  
✅ **Realistic spread** - Orderbook has ±15 ticks ($0.15) spread around real price  
✅ **Own trades** - Your matching engine still handles user orders  
✅ **Fallback** - Defaults to $70.00 if Binance is unreachable  
✅ **Auto-reconnect** - WebSocket reconnects automatically with exponential backoff  

## Configuration

The system uses these Binance endpoints:

- **REST API**: `https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT`
- **WebSocket**: `wss://stream.binance.com:9443/ws/solusdt@ticker`

No API key required - these are public endpoints.

## Orderbook Generation

When Binance price = **$150.23**, the orderbook generates:

**Asks (sellers)**:
- $150.24 - 1,250 SOL
- $150.25 - 2,100 SOL
- $150.26 - 890 SOL
- ... (up to 15 levels)

**Bids (buyers)**:
- $150.22 - 1,840 SOL
- $150.21 - 945 SOL
- $150.20 - 2,300 SOL
- ... (up to 15 levels)

## Matching Engine Integration

When users place orders:
1. ✅ Order goes to your matching engine
2. ✅ Matches against other user orders
3. ✅ Real trades execute at matched prices
4. ✅ Trade events published via WebSocket

The Binance price is **only used for display orderbook**, not for matching logic.

## Testing

To verify the integration:

1. Open browser console
2. Look for: `✅ Initialized with Binance SOL price: $XXX.XX`
3. Watch for: `📊 Updated orderbook with Binance price: $XXX.XX`
4. Refresh the page - price should be consistent (from Binance)
5. Wait 10-30 seconds - price should update as SOL moves

## Troubleshooting

### Price not updating?
- Check console for WebSocket errors
- Verify Binance API is accessible: `curl https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT`
- Check if WebSocket is blocked by firewall/proxy

### Price shows $70.00?
- This is the fallback when Binance is unreachable
- Check network connectivity
- Binance may be rate-limiting (rare for public endpoints)

### Orderbook changes on refresh?
- This should **no longer happen** - price comes from Binance
- If it still changes, check console for Binance connection errors

## Future Enhancements

Potential improvements:
- [ ] Add BTC-PERP using BTC/USDT from Binance
- [ ] Add ETH-PERP using ETH/USDT from Binance
- [ ] Show Binance connection status in UI
- [ ] Add price chart with real historical data
- [ ] Support other exchanges (Coinbase, Kraken)

## Code Locations

- `apps/web/lib/binance-price.ts` - Binance integration
- `apps/web/lib/mock/websocket.ts` - Market feed orchestrator
- `apps/web/lib/mock/market-data.ts` - Orderbook generators
- `apps/web/hooks/use-market-feed.ts` - React hooks for components
- `apps/web/components/trading/order-book.tsx` - Orderbook UI

## License

Same as parent project.
