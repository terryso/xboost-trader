// Database entity interfaces for XBoost Trader
// These interfaces represent the data models as they exist in the database

export interface IWallet {
  address: string;
  encryptedPrivateKey: string;
  supportedNetworks: ('linea' | 'bnb' | 'ethereum' | 'solana')[];
  isDefault: boolean;
  createdAt: Date;
}

export interface IGridStrategy {
  id: string;
  walletAddress: string;
  pair: string;
  network: 'linea' | 'bnb' | 'ethereum' | 'solana';
  gridType: 'arithmetic' | 'geometric';
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  baseAmount: number;
  stopLoss?: number;
  maxPositionRatio: number;
  status: 'active' | 'paused' | 'stopped';
  totalProfit: number;
  executedOrdersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGridOrder {
  id: string;
  strategyId: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  status: 'pending' | 'filled' | 'cancelled';
  txHash?: string;
  gasUsed?: number;
  gasPrice?: number;
  createdAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

export interface ITrade {
  id: string;
  strategyId: string;
  orderId: string;
  pair: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  fee: number;
  profit: number;
  txHash: string;
  blockNumber?: number;
  timestamp: Date;
}

export interface IPriceHistory {
  id: number;
  pair: string;
  price: number;
  volume24h: number;
  timestamp: Date;
}

export interface ISystemLog {
  id: number;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  metadata?: string; // JSON string
  requestId?: string;
  timestamp: Date;
}

export interface IAppConfig {
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
}

// Database row types - raw data from SQLite
export interface WalletRow {
  address: string;
  encrypted_private_key: string;
  supported_networks: string; // JSON string
  is_default: number; // SQLite boolean as integer
  created_at: string; // SQLite datetime as string
}

export interface GridStrategyRow {
  id: string;
  wallet_address: string;
  pair: string;
  network: string;
  grid_type: string;
  upper_price: number;
  lower_price: number;
  grid_count: number;
  base_amount: number;
  stop_loss?: number;
  max_position_ratio: number;
  status: string;
  total_profit: number;
  executed_orders_count: number;
  created_at: string;
  updated_at: string;
}

export interface GridOrderRow {
  id: string;
  strategy_id: string;
  price: number;
  amount: number;
  side: string;
  status: string;
  tx_hash?: string;
  gas_used?: number;
  gas_price?: number;
  created_at: string;
  filled_at?: string;
  cancelled_at?: string;
}

export interface TradeRow {
  id: string;
  strategy_id: string;
  order_id: string;
  pair: string;
  side: string;
  price: number;
  amount: number;
  fee: number;
  profit: number;
  tx_hash: string;
  block_number?: number;
  timestamp: string;
}

export interface PriceHistoryRow {
  id: number;
  pair: string;
  price: number;
  volume_24h: number;
  timestamp: string;
}

export interface SystemLogRow {
  id: number;
  level: string;
  message: string;
  metadata?: string;
  request_id?: string;
  timestamp: string;
}

export interface AppConfigRow {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}