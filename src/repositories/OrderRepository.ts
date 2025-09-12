import { BaseRepository } from './BaseRepository';
import { IGridOrder, GridOrderRow } from '../models/types/database.types';
import { DatabaseConnection } from '../utils/DatabaseConnection';

export class OrderRepository extends BaseRepository<IGridOrder, GridOrderRow> {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  get tableName(): string {
    return 'grid_orders';
  }

  mapRowToEntity(row: GridOrderRow): IGridOrder {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      price: row.price,
      amount: row.amount,
      side: row.side as 'buy' | 'sell',
      status: row.status as 'pending' | 'filled' | 'cancelled',
      txHash: row.tx_hash,
      gasUsed: row.gas_used,
      gasPrice: row.gas_price,
      createdAt: new Date(row.created_at),
      filledAt: row.filled_at ? new Date(row.filled_at) : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined
    };
  }

  mapEntityToRow(entity: IGridOrder): Partial<GridOrderRow> {
    return {
      id: entity.id,
      strategy_id: entity.strategyId,
      price: entity.price,
      amount: entity.amount,
      side: entity.side,
      status: entity.status,
      tx_hash: entity.txHash,
      gas_used: entity.gasUsed,
      gas_price: entity.gasPrice,
      created_at: entity.createdAt.toISOString(),
      filled_at: entity.filledAt?.toISOString(),
      cancelled_at: entity.cancelledAt?.toISOString()
    };
  }

  protected getInsertFields(): string[] {
    return [
      'id', 'strategy_id', 'price', 'amount', 'side', 'status', 'created_at'
    ];
  }

  protected getUpdateFields(): string[] {
    return [
      'strategy_id', 'price', 'amount', 'side', 'status',
      'tx_hash', 'gas_used', 'gas_price', 'filled_at', 'cancelled_at'
    ];
  }

  // Business-specific methods for order management

  /**
   * Find orders by strategy ID
   */
  async findByStrategyId(strategyId: string): Promise<IGridOrder[]> {
    return this.findByCondition('strategy_id = ?', [strategyId]);
  }

  /**
   * Find orders by status
   */
  async findByStatus(status: 'pending' | 'filled' | 'cancelled'): Promise<IGridOrder[]> {
    return this.findByCondition('status = ?', [status]);
  }

  /**
   * Find pending orders by strategy
   */
  async findPendingOrdersByStrategy(strategyId: string): Promise<IGridOrder[]> {
    return this.findByCondition('strategy_id = ? AND status = ?', [strategyId, 'pending']);
  }

  /**
   * Find filled orders by strategy
   */
  async findFilledOrdersByStrategy(strategyId: string): Promise<IGridOrder[]> {
    return this.findByCondition('strategy_id = ? AND status = ?', [strategyId, 'filled']);
  }

  /**
   * Find orders by side (buy/sell) and strategy
   */
  async findBySideAndStrategy(strategyId: string, side: 'buy' | 'sell'): Promise<IGridOrder[]> {
    return this.findByCondition('strategy_id = ? AND side = ?', [strategyId, side]);
  }

  /**
   * Find orders within price range for a strategy
   */
  async findByPriceRange(strategyId: string, minPrice: number, maxPrice: number): Promise<IGridOrder[]> {
    return this.findByCondition(
      'strategy_id = ? AND price BETWEEN ? AND ?',
      [strategyId, minPrice, maxPrice]
    );
  }

  /**
   * Update order status to filled
   */
  async markAsFilled(orderId: string, txHash: string, gasUsed?: number, gasPrice?: number): Promise<void> {
    try {
      const sql = `
        UPDATE grid_orders 
        SET status = 'filled', 
            tx_hash = ?, 
            gas_used = ?,
            gas_price = ?,
            filled_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `;
      const result = await this.db.run(sql, [txHash, gasUsed, gasPrice, orderId]);

      if (!result || result.changes === 0) {
        throw new Error(`No pending order found with ID ${orderId}`);
      }
    } catch (error) {
      throw new Error(`Failed to mark order as filled: ${error.message}`);
    }
  }

  /**
   * Update order status to cancelled
   */
  async markAsCancelled(orderId: string): Promise<void> {
    try {
      const sql = `
        UPDATE grid_orders 
        SET status = 'cancelled', 
            cancelled_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `;
      const result = await this.db.run(sql, [orderId]);

      if (!result || result.changes === 0) {
        throw new Error(`No pending order found with ID ${orderId}`);
      }
    } catch (error) {
      throw new Error(`Failed to mark order as cancelled: ${error.message}`);
    }
  }

  /**
   * Cancel all pending orders for a strategy
   */
  async cancelAllPendingForStrategy(strategyId: string): Promise<number> {
    try {
      const sql = `
        UPDATE grid_orders 
        SET status = 'cancelled', 
            cancelled_at = CURRENT_TIMESTAMP
        WHERE strategy_id = ? AND status = 'pending'
      `;
      const result = await this.db.run(sql, [strategyId]);
      return result.changes || 0;
    } catch (error) {
      throw new Error(`Failed to cancel pending orders for strategy: ${error.message}`);
    }
  }

  /**
   * Get order statistics for a strategy
   */
  async getOrderStats(strategyId: string): Promise<{
    total: number;
    pending: number;
    filled: number;
    cancelled: number;
    totalVolume: number;
    averagePrice: number;
  }> {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          COALESCE(SUM(CASE WHEN status = 'filled' THEN price * amount ELSE 0 END), 0) as total_volume,
          COALESCE(AVG(CASE WHEN status = 'filled' THEN price ELSE NULL END), 0) as average_price
        FROM grid_orders
        WHERE strategy_id = ?
      `;
      
      const result = await this.db.get<{
        total: number;
        pending: number;
        filled: number;
        cancelled: number;
        total_volume: number;
        average_price: number;
      }>(sql, [strategyId]);

      return {
        total: result?.total || 0,
        pending: result?.pending || 0,
        filled: result?.filled || 0,
        cancelled: result?.cancelled || 0,
        totalVolume: result?.total_volume || 0,
        averagePrice: result?.average_price || 0
      };
    } catch (error) {
      throw new Error(`Failed to get order statistics: ${error.message}`);
    }
  }

  /**
   * Find recent orders (for monitoring)
   */
  async findRecentOrders(limit: number = 50): Promise<IGridOrder[]> {
    try {
      const sql = `
        SELECT * FROM grid_orders 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      const rows = await this.db.query<GridOrderRow>(sql, [limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to find recent orders: ${error.message}`);
    }
  }

  /**
   * Find orders by transaction hash
   */
  async findByTxHash(txHash: string): Promise<IGridOrder | null> {
    return this.findOneByCondition('tx_hash = ?', [txHash]);
  }

  /**
   * Get next buy order price for a strategy (for grid trading logic)
   */
  async getNextBuyOrderPrice(strategyId: string, currentPrice: number): Promise<number | null> {
    try {
      const sql = `
        SELECT price FROM grid_orders 
        WHERE strategy_id = ? 
          AND side = 'buy' 
          AND status = 'pending' 
          AND price < ?
        ORDER BY price DESC 
        LIMIT 1
      `;
      
      const result = await this.db.get<{ price: number }>(sql, [strategyId, currentPrice]);
      return result?.price || null;
    } catch (error) {
      throw new Error(`Failed to get next buy order price: ${error.message}`);
    }
  }

  /**
   * Get next sell order price for a strategy (for grid trading logic)
   */
  async getNextSellOrderPrice(strategyId: string, currentPrice: number): Promise<number | null> {
    try {
      const sql = `
        SELECT price FROM grid_orders 
        WHERE strategy_id = ? 
          AND side = 'sell' 
          AND status = 'pending' 
          AND price > ?
        ORDER BY price ASC 
        LIMIT 1
      `;
      
      const result = await this.db.get<{ price: number }>(sql, [strategyId, currentPrice]);
      return result?.price || null;
    } catch (error) {
      throw new Error(`Failed to get next sell order price: ${error.message}`);
    }
  }

  /**
   * Delete orders older than specified date (cleanup)
   */
  async deleteOldOrders(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const sql = `
        DELETE FROM grid_orders 
        WHERE status IN ('filled', 'cancelled') 
          AND created_at < ?
      `;
      
      const result = await this.db.run(sql, [cutoffDate.toISOString()]);
      return result.changes || 0;
    } catch (error) {
      throw new Error(`Failed to delete old orders: ${error.message}`);
    }
  }
}