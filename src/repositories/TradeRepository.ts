import { BaseRepository } from './BaseRepository';
import { ITrade, TradeRow } from '../models/types/database.types';
import { DatabaseConnection } from '../utils/DatabaseConnection';

export class TradeRepository extends BaseRepository<ITrade, TradeRow> {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  get tableName(): string {
    return 'trades';
  }

  mapRowToEntity(row: TradeRow): ITrade {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      orderId: row.order_id,
      pair: row.pair,
      side: row.side as 'buy' | 'sell',
      price: row.price,
      amount: row.amount,
      fee: row.fee,
      profit: row.profit,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      timestamp: new Date(row.timestamp)
    };
  }

  mapEntityToRow(entity: ITrade): Partial<TradeRow> {
    return {
      id: entity.id,
      strategy_id: entity.strategyId,
      order_id: entity.orderId,
      pair: entity.pair,
      side: entity.side,
      price: entity.price,
      amount: entity.amount,
      fee: entity.fee,
      profit: entity.profit,
      tx_hash: entity.txHash,
      block_number: entity.blockNumber,
      timestamp: entity.timestamp.toISOString()
    };
  }

  protected getInsertFields(): string[] {
    return [
      'id', 'strategy_id', 'order_id', 'pair', 'side', 'price',
      'amount', 'fee', 'profit', 'tx_hash', 'block_number', 'timestamp'
    ];
  }

  protected getUpdateFields(): string[] {
    return [
      'strategy_id', 'order_id', 'pair', 'side', 'price',
      'amount', 'fee', 'profit', 'tx_hash', 'block_number', 'timestamp'
    ];
  }

  // Business-specific methods for trade management

  /**
   * Find trades by strategy ID
   */
  async findByStrategyId(strategyId: string): Promise<ITrade[]> {
    return this.findByCondition('strategy_id = ?', [strategyId]);
  }

  /**
   * Find trades by order ID
   */
  async findByOrderId(orderId: string): Promise<ITrade[]> {
    return this.findByCondition('order_id = ?', [orderId]);
  }

  /**
   * Find trades by transaction hash
   */
  async findByTxHash(txHash: string): Promise<ITrade | null> {
    return this.findOneByCondition('tx_hash = ?', [txHash]);
  }

  /**
   * Find trades by trading pair
   */
  async findByPair(pair: string): Promise<ITrade[]> {
    return this.findByCondition('pair = ?', [pair]);
  }

  /**
   * Find trades by side (buy/sell)
   */
  async findBySide(side: 'buy' | 'sell'): Promise<ITrade[]> {
    return this.findByCondition('side = ?', [side]);
  }

  /**
   * Find trades within date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<ITrade[]> {
    return this.findByCondition(
      'timestamp BETWEEN ? AND ?',
      [startDate.toISOString(), endDate.toISOString()]
    );
  }

  /**
   * Find recent trades
   */
  async findRecentTrades(limit: number = 100): Promise<ITrade[]> {
    try {
      const sql = `
        SELECT * FROM trades 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      const rows = await this.db.query<TradeRow>(sql, [limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to find recent trades: ${error.message}`);
    }
  }

  /**
   * Get profit statistics for a strategy
   */
  async getProfitStats(strategyId: string): Promise<{
    totalProfit: number;
    totalFees: number;
    totalVolume: number;
    tradeCount: number;
    averageProfit: number;
    winRate: number;
  }> {
    try {
      const sql = `
        SELECT 
          COALESCE(SUM(profit), 0) as total_profit,
          COALESCE(SUM(fee), 0) as total_fees,
          COALESCE(SUM(price * amount), 0) as total_volume,
          COUNT(*) as trade_count,
          COALESCE(AVG(profit), 0) as average_profit,
          COALESCE(
            (COUNT(CASE WHEN profit > 0 THEN 1 END) * 100.0) / NULLIF(COUNT(*), 0), 
            0
          ) as win_rate
        FROM trades
        WHERE strategy_id = ?
      `;
      
      const result = await this.db.get<{
        total_profit: number;
        total_fees: number;
        total_volume: number;
        trade_count: number;
        average_profit: number;
        win_rate: number;
      }>(sql, [strategyId]);

      return {
        totalProfit: result?.total_profit || 0,
        totalFees: result?.total_fees || 0,
        totalVolume: result?.total_volume || 0,
        tradeCount: result?.trade_count || 0,
        averageProfit: result?.average_profit || 0,
        winRate: result?.win_rate || 0
      };
    } catch (error) {
      throw new Error(`Failed to get profit statistics: ${error.message}`);
    }
  }

  /**
   * Get daily profit summary for a strategy
   */
  async getDailyProfitSummary(strategyId: string, days: number = 30): Promise<Array<{
    date: string;
    profit: number;
    volume: number;
    tradeCount: number;
  }>> {
    try {
      const sql = `
        SELECT 
          DATE(timestamp) as date,
          COALESCE(SUM(profit), 0) as profit,
          COALESCE(SUM(price * amount), 0) as volume,
          COUNT(*) as trade_count
        FROM trades
        WHERE strategy_id = ? 
          AND timestamp >= DATE('now', '-${days} days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `;
      
      const rows = await this.db.query<{
        date: string;
        profit: number;
        volume: number;
        trade_count: number;
      }>(sql, [strategyId]);

      return rows.map(row => ({
        date: row.date,
        profit: row.profit,
        volume: row.volume,
        tradeCount: row.trade_count
      }));
    } catch (error) {
      throw new Error(`Failed to get daily profit summary: ${error.message}`);
    }
  }

  /**
   * Get top performing pairs by profit
   */
  async getTopProfitablePairs(limit: number = 10): Promise<Array<{
    pair: string;
    totalProfit: number;
    tradeCount: number;
    averageProfit: number;
  }>> {
    try {
      const sql = `
        SELECT 
          pair,
          COALESCE(SUM(profit), 0) as total_profit,
          COUNT(*) as trade_count,
          COALESCE(AVG(profit), 0) as average_profit
        FROM trades
        GROUP BY pair
        HAVING total_profit > 0
        ORDER BY total_profit DESC
        LIMIT ?
      `;
      
      const rows = await this.db.query<{
        pair: string;
        total_profit: number;
        trade_count: number;
        average_profit: number;
      }>(sql, [limit]);

      return rows.map(row => ({
        pair: row.pair,
        totalProfit: row.total_profit,
        tradeCount: row.trade_count,
        averageProfit: row.average_profit
      }));
    } catch (error) {
      throw new Error(`Failed to get top profitable pairs: ${error.message}`);
    }
  }

  /**
   * Get trade volume statistics
   */
  async getVolumeStats(strategyId?: string): Promise<{
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
    averageTradeSize: number;
  }> {
    try {
      let sql = `
        SELECT 
          COALESCE(SUM(price * amount), 0) as total_volume,
          COALESCE(SUM(CASE WHEN side = 'buy' THEN price * amount ELSE 0 END), 0) as buy_volume,
          COALESCE(SUM(CASE WHEN side = 'sell' THEN price * amount ELSE 0 END), 0) as sell_volume,
          COALESCE(AVG(price * amount), 0) as average_trade_size
        FROM trades
      `;
      
      const params: any[] = [];
      
      if (strategyId) {
        sql += ' WHERE strategy_id = ?';
        params.push(strategyId);
      }

      const result = await this.db.get<{
        total_volume: number;
        buy_volume: number;
        sell_volume: number;
        average_trade_size: number;
      }>(sql, params);

      return {
        totalVolume: result?.total_volume || 0,
        buyVolume: result?.buy_volume || 0,
        sellVolume: result?.sell_volume || 0,
        averageTradeSize: result?.average_trade_size || 0
      };
    } catch (error) {
      throw new Error(`Failed to get volume statistics: ${error.message}`);
    }
  }

  /**
   * Find highest profit trade
   */
  async findHighestProfitTrade(strategyId?: string): Promise<ITrade | null> {
    try {
      let sql = 'SELECT * FROM trades WHERE profit = (SELECT MAX(profit) FROM trades';
      const params: any[] = [];
      
      if (strategyId) {
        sql += ' WHERE strategy_id = ?';
        params.push(strategyId);
      }
      
      sql += ')';
      
      if (strategyId) {
        sql += ' AND strategy_id = ?';
        params.push(strategyId);
      }
      
      sql += ' LIMIT 1';

      const row = await this.db.get<TradeRow>(sql, params);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw new Error(`Failed to find highest profit trade: ${error.message}`);
    }
  }

  /**
   * Delete trades older than specified date (cleanup)
   */
  async deleteOldTrades(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const sql = 'DELETE FROM trades WHERE timestamp < ?';
      const result = await this.db.run(sql, [cutoffDate.toISOString()]);
      return result.changes || 0;
    } catch (error) {
      throw new Error(`Failed to delete old trades: ${error.message}`);
    }
  }

  /**
   * Get monthly profit report
   */
  async getMonthlyProfitReport(year?: number): Promise<Array<{
    month: string;
    profit: number;
    volume: number;
    tradeCount: number;
  }>> {
    try {
      let sql = `
        SELECT 
          strftime('%Y-%m', timestamp) as month,
          COALESCE(SUM(profit), 0) as profit,
          COALESCE(SUM(price * amount), 0) as volume,
          COUNT(*) as trade_count
        FROM trades
      `;
      
      const params: any[] = [];
      
      if (year) {
        sql += ` WHERE strftime('%Y', timestamp) = ?`;
        params.push(year.toString());
      }
      
      sql += ` GROUP BY strftime('%Y-%m', timestamp) ORDER BY month DESC`;

      const rows = await this.db.query<{
        month: string;
        profit: number;
        volume: number;
        trade_count: number;
      }>(sql, params);

      return rows.map(row => ({
        month: row.month,
        profit: row.profit,
        volume: row.volume,
        tradeCount: row.trade_count
      }));
    } catch (error) {
      throw new Error(`Failed to get monthly profit report: ${error.message}`);
    }
  }
}