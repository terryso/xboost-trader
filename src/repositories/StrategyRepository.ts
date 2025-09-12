import { BaseRepository } from './BaseRepository';
import type { IGridStrategy, GridStrategyRow } from '../models/types/database.types';
import type { DatabaseConnection } from '../utils/DatabaseConnection';

export class StrategyRepository extends BaseRepository<IGridStrategy, GridStrategyRow> {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  get tableName(): string {
    return 'grid_strategies';
  }

  mapRowToEntity(row: GridStrategyRow): IGridStrategy {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      pair: row.pair,
      network: row.network as 'linea' | 'bnb' | 'ethereum' | 'solana',
      gridType: row.grid_type as 'arithmetic' | 'geometric',
      upperPrice: row.upper_price,
      lowerPrice: row.lower_price,
      gridCount: row.grid_count,
      baseAmount: row.base_amount,
      stopLoss: row.stop_loss,
      maxPositionRatio: row.max_position_ratio,
      status: row.status as 'active' | 'paused' | 'stopped',
      totalProfit: row.total_profit,
      executedOrdersCount: row.executed_orders_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  mapEntityToRow(entity: IGridStrategy): Partial<GridStrategyRow> {
    return {
      id: entity.id,
      wallet_address: entity.walletAddress,
      pair: entity.pair,
      network: entity.network,
      grid_type: entity.gridType,
      upper_price: entity.upperPrice,
      lower_price: entity.lowerPrice,
      grid_count: entity.gridCount,
      base_amount: entity.baseAmount,
      stop_loss: entity.stopLoss,
      max_position_ratio: entity.maxPositionRatio,
      status: entity.status,
      total_profit: entity.totalProfit,
      executed_orders_count: entity.executedOrdersCount,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };
  }

  protected getInsertFields(): string[] {
    return [
      'id',
      'wallet_address',
      'pair',
      'network',
      'grid_type',
      'upper_price',
      'lower_price',
      'grid_count',
      'base_amount',
      'stop_loss',
      'max_position_ratio',
      'status',
      'total_profit',
      'executed_orders_count',
      'created_at',
      'updated_at',
    ];
  }

  protected getUpdateFields(): string[] {
    return [
      'wallet_address',
      'pair',
      'network',
      'grid_type',
      'upper_price',
      'lower_price',
      'grid_count',
      'base_amount',
      'stop_loss',
      'max_position_ratio',
      'status',
      'total_profit',
      'executed_orders_count',
      'updated_at',
    ];
  }

  // Business-specific methods for grid strategies

  /**
   * Find strategies by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<IGridStrategy[]> {
    return this.findByCondition('wallet_address = ?', [walletAddress]);
  }

  /**
   * Find active strategies
   */
  async findActiveStrategies(): Promise<IGridStrategy[]> {
    return this.findByCondition('status = ?', ['active']);
  }

  /**
   * Find strategies by pair and network
   */
  async findByPairAndNetwork(pair: string, network: string): Promise<IGridStrategy[]> {
    return this.findByCondition('pair = ? AND network = ?', [pair, network]);
  }

  /**
   * Find strategies by status
   */
  async findByStatus(status: 'active' | 'paused' | 'stopped'): Promise<IGridStrategy[]> {
    return this.findByCondition('status = ?', [status]);
  }

  /**
   * Update strategy status
   */
  async updateStatus(strategyId: string, status: 'active' | 'paused' | 'stopped'): Promise<void> {
    try {
      const sql =
        'UPDATE grid_strategies SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      const result = await this.db.run(sql, [status, strategyId]);

      if (result.changes === 0) {
        throw new Error(`No strategy found with ID ${strategyId}`);
      }
    } catch (error) {
      throw new Error(`Failed to update strategy status: ${error.message}`);
    }
  }

  /**
   * Update strategy profit and order count (called when a trade is executed)
   */
  async updateProfitAndOrderCount(strategyId: string, profitDelta: number): Promise<void> {
    try {
      const sql = `
        UPDATE grid_strategies 
        SET total_profit = total_profit + ?, 
            executed_orders_count = executed_orders_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const result = await this.db.run(sql, [profitDelta, strategyId]);

      if (result.changes === 0) {
        throw new Error(`No strategy found with ID ${strategyId}`);
      }
    } catch (error) {
      throw new Error(`Failed to update strategy profit: ${error.message}`);
    }
  }

  /**
   * Get strategies with summary statistics
   */
  async getStrategySummaries(
    walletAddress?: string
  ): Promise<Array<IGridStrategy & { pendingOrders: number; filledOrders: number }>> {
    try {
      let sql = `
        SELECT 
          gs.*,
          COUNT(CASE WHEN go.status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN go.status = 'filled' THEN 1 END) as filled_orders
        FROM grid_strategies gs
        LEFT JOIN grid_orders go ON gs.id = go.strategy_id
      `;

      const params: any[] = [];

      if (walletAddress) {
        sql += ' WHERE gs.wallet_address = ?';
        params.push(walletAddress);
      }

      sql += ' GROUP BY gs.id ORDER BY gs.created_at DESC';

      const rows = await this.db.query<
        GridStrategyRow & { pending_orders: number; filled_orders: number }
      >(sql, params);

      return rows.map(row => ({
        ...this.mapRowToEntity(row),
        pendingOrders: row.pending_orders,
        filledOrders: row.filled_orders,
      }));
    } catch (error) {
      throw new Error(`Failed to get strategy summaries: ${error.message}`);
    }
  }

  /**
   * Get top performing strategies
   */
  async getTopPerformingStrategies(limit: number = 10): Promise<IGridStrategy[]> {
    try {
      const sql = `
        SELECT * FROM grid_strategies 
        WHERE status IN ('active', 'paused')
        ORDER BY total_profit DESC 
        LIMIT ?
      `;

      const rows = await this.db.query<GridStrategyRow>(sql, [limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to get top performing strategies: ${error.message}`);
    }
  }

  /**
   * Count strategies by status
   */
  async countByStatus(): Promise<{ active: number; paused: number; stopped: number }> {
    try {
      const sql = `
        SELECT 
          status,
          COUNT(*) as count
        FROM grid_strategies
        GROUP BY status
      `;

      const rows = await this.db.query<{ status: string; count: number }>(sql);

      const result = { active: 0, paused: 0, stopped: 0 };
      rows.forEach(row => {
        if (row.status === 'active') result.active = row.count;
        else if (row.status === 'paused') result.paused = row.count;
        else if (row.status === 'stopped') result.stopped = row.count;
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to count strategies by status: ${error.message}`);
    }
  }

  /**
   * Delete strategy and all related orders/trades (cascade delete should handle this)
   */
  async deleteWithRelatedData(strategyId: string): Promise<void> {
    try {
      // The database schema has CASCADE DELETE, so this will remove all related data
      await this.delete(strategyId);
    } catch (error) {
      throw new Error(`Failed to delete strategy with related data: ${error.message}`);
    }
  }
}
