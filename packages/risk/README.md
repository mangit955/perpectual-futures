# risk

Phase 3 positions and margin package.

This package is intentionally pure TypeScript. It does not talk to PostgreSQL,
Redis, or the matching engine directly. Workers and API services can call these
functions, then persist the resulting state through the Phase 2 persistence
layer.

## Position Model

Positions use signed quantity:

```text
positive quantity = long
negative quantity = short
zero quantity     = flat
```

Fills are applied through one path:

- Same direction fill: increase position and update weighted-average entry.
- Opposite direction fill: reduce or close position and realize PnL.
- Larger opposite fill: close old exposure, then open the remainder in the new
  direction at the fill price.

Realized PnL:

```text
long close  = (fillPrice - entryPrice) * closedQty
short close = (entryPrice - fillPrice) * closedQty
```

Fees are deducted from realized PnL when the fill is applied.

## Cross Margin

The first implementation assumes one collateral asset, USDC.

```text
unrealizedPnl       = sum((markPrice - entryPrice) * signedQty)
accountEquity      = walletBalance + unrealizedPnl
initialMargin      = sum(abs(qty) * markPrice / leverage)
maintenanceMargin  = sum(abs(qty) * markPrice * maintenanceMarginRate)
availableMargin    = accountEquity - initialMargin - openOrderMargin - fees
```

Reduce-only orders do not reserve additional margin in this phase because they
should reduce exposure. Full reduce-only enforcement against current position
size belongs in the order-risk integration path.

## Ledger

Ledger helpers update balances and emit simple ledger-entry objects for:

- deposits
- trading fees
- realized PnL
- future funding/liquidation transfers

The helper rejects entries that would make total balance negative.

## Funding

Funding uses mark price and index price:

```text
premiumIndex = (markPrice - indexPrice) / indexPrice
fundingRate  = clamp(premiumIndex, -fundingRateCap, fundingRateCap)
payment      = -signedPositionQty * markPrice * fundingRate
```

Sign convention:

- Positive funding: longs pay shorts.
- Negative funding: shorts pay longs.

The default interval is configured per market, normally 8 hours. The pure
funding helpers decide whether an interval is due, generate per-user funding
payments, and apply those payments to collateral balances through ledger
entries.

## Liquidation and ADL

Liquidation triggers when:

```text
accountEquity <= maintenanceMargin
```

The liquidation helper creates a reduce-only order for each open position in
the liquidating account:

- long position -> sell reduce-only order
- short position -> buy reduce-only order

If the liquidation leaves a deficit, settlement happens in this order:

1. Debit the insurance fund.
2. If the fund is insufficient, use simplified ADL.
3. If ADL cannot cover the remaining deficit, report unresolved deficit.

ADL candidates are opposing positions ranked by:

```text
adlScore = pnlPercent * effectiveLeverage
```

The highest score is reduced first.
