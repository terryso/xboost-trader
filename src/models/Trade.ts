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

export interface ITradeRow {
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
