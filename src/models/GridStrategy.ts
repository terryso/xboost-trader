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

export interface IGridStrategyRow {
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
