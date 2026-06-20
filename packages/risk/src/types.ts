export type PositionSide = "LONG" | "SHORT" | "FLAT";
export type TradeSide = "BUY" | "SELL";
export type LedgerEntryType =
  | "DEPOSIT"
  | "TRADING_FEE"
  | "REALIZED_PNL"
  | "FUNDING_PAYMENT"
  | "LIQUIDATION_LOSS"
  | "INSURANCE_FUND_TRANSFER"
  | "INSURANCE_FUND_CREDIT"
  | "ADL_SETTLEMENT";
export type LiquidationStatus =
  | "TRIGGERED"
  | "LIQUIDATING"
  | "CLOSED"
  | "INSURANCE_FUND_USED"
  | "ADL_USED"
  | "FAILED";

export interface MarketRiskConfig {
  marketId: string;
  tickSize: number;
  lotSize: number;
  maxLeverage: number;
  initialMarginRate: number;
  maintenanceMarginRate: number;
  makerFeeRate: number;
  takerFeeRate: number;
}

export interface FundingMarketConfig {
  marketId: string;
  fundingIntervalHours: number;
  fundingRateCap: number;
}

export interface Position {
  userId: string;
  marketId: string;
  quantity: number;
  entryPrice: number;
  realizedPnl: number;
  leverage: number;
}

export interface PositionView extends Position {
  side: PositionSide;
  notional: number;
  unrealizedPnl: number;
  initialMargin: number;
  maintenanceMargin: number;
}

export interface FillInput {
  userId: string;
  marketId: string;
  side: TradeSide;
  price: number;
  quantity: number;
  fee: number;
}

export interface PositionUpdateResult {
  previous: Position;
  next: Position;
  closedQuantity: number;
  openedQuantity: number;
  realizedPnlDelta: number;
  feePaid: number;
}

export interface Balance {
  userId: string;
  asset: string;
  total: number;
  locked: number;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  asset: string;
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  referenceId?: string;
  createdAt: number;
}

export interface AccountState {
  userId: string;
  collateralAsset: string;
  walletBalance: number;
  positions: Position[];
  openOrders: OpenOrderRisk[];
}

export interface OpenOrderRisk {
  marketId: string;
  side: TradeSide;
  price: number;
  quantity: number;
  reduceOnly: boolean;
  estimatedFeeRate: number;
  leverage: number;
}

export interface MarkPrice {
  marketId: string;
  price: number;
}

export interface FundingPriceInput {
  marketId: string;
  markPrice: number;
  indexPrice: number;
  timestamp: number;
}

export interface FundingPayment {
  id: string;
  eventId: string;
  userId: string;
  marketId: string;
  positionQuantity: number;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  paymentAmount: number;
  fundingTime: number;
}

export interface FundingExecution {
  eventId: string;
  marketId: string;
  markPrice: number;
  indexPrice: number;
  premiumIndex: number;
  fundingRate: number;
  fundingTime: number;
  payments: FundingPayment[];
}

export interface MarginSummary {
  userId: string;
  collateralAsset: string;
  walletBalance: number;
  unrealizedPnl: number;
  accountEquity: number;
  initialMargin: number;
  maintenanceMargin: number;
  openOrderInitialMargin: number;
  openOrderFees: number;
  availableMargin: number;
  marginRatio: number | null;
}

export interface OrderMarginCheck {
  ok: boolean;
  requiredInitialMargin: number;
  requiredFee: number;
  availableMargin: number;
  reason?: "INSUFFICIENT_MARGIN" | "INVALID_LEVERAGE" | "UNKNOWN_MARKET";
}

export interface LiquidationOrder {
  orderId: string;
  userId: string;
  marketId: string;
  side: TradeSide;
  quantity: number;
  limitPrice: number;
  reduceOnly: true;
}

export interface LiquidationTrigger {
  eventId: string;
  userId: string;
  marketId: string;
  positionQuantity: number;
  markPrice: number;
  maintenanceMargin: number;
  accountEquity: number;
  status: LiquidationStatus;
  order: LiquidationOrder;
  createdAt: number;
}

export interface InsuranceFund {
  asset: string;
  balance: number;
}

export interface InsuranceFundUsage {
  asset: string;
  requested: number;
  used: number;
  remainingDeficit: number;
  nextFundBalance: number;
}

export interface AdlCandidate {
  userId: string;
  position: Position;
  markPrice: number;
  accountEquity: number;
}

export interface AdlAction {
  userId: string;
  marketId: string;
  side: TradeSide;
  quantity: number;
  price: number;
  score: number;
}

export interface DeficitSettlement {
  insuranceFund: InsuranceFundUsage;
  adlActions: AdlAction[];
  unresolvedDeficit: number;
  status: "INSURANCE_FUND_USED" | "ADL_USED" | "FAILED";
}
