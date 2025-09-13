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

export interface IGridOrderRow {
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
