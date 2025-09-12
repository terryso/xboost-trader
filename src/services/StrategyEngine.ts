import type { IGridStrategy } from '../models/types/database.types';
import { StrategyRepository } from '../repositories/StrategyRepository';
import type { DatabaseConnection } from '../utils/DatabaseConnection';
import type { Logger } from './ServiceContainer';

export interface GridStrategyConfig {
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
}

export interface StrategyStatus {
  id: string;
  status: 'active' | 'paused' | 'stopped';
  totalProfit: number;
  executedOrdersCount: number;
  pendingOrders?: number;
  filledOrders?: number;
  lastUpdated: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IStrategyEngine {
  createStrategy(config: GridStrategyConfig): Promise<IGridStrategy>;
  startStrategy(strategyId: string): Promise<void>;
  stopStrategy(strategyId: string): Promise<void>;
  pauseStrategy(strategyId: string): Promise<void>;
  getStrategyStatus(strategyId: string): Promise<StrategyStatus>;
  getStrategiesByWallet(walletAddress: string): Promise<IGridStrategy[]>;
  getActiveStrategies(): Promise<IGridStrategy[]>;
  validateStrategyConfig(config: GridStrategyConfig): ValidationResult;
  deleteStrategy(strategyId: string): Promise<void>;
}

export class StrategyEngine implements IStrategyEngine {
  private readonly strategyRepository: StrategyRepository;
  private readonly logger: Logger; // Will be injected

  constructor(db: DatabaseConnection, logger?: Logger) {
    this.strategyRepository = new StrategyRepository(db);
    this.logger = logger || console;
  }

  async createStrategy(config: GridStrategyConfig): Promise<IGridStrategy> {
    const requestId = `create_strategy_${Date.now()}`;

    try {
      this.logger.info('Creating new grid strategy', { requestId, config });

      const validation = this.validateStrategyConfig(config);
      if (!validation.isValid) {
        throw new Error(`Strategy configuration invalid: ${validation.errors.join(', ')}`);
      }

      const strategyId = this.generateStrategyId();
      const now = new Date();

      const strategy: IGridStrategy = {
        id: strategyId,
        walletAddress: config.walletAddress,
        pair: config.pair,
        network: config.network,
        gridType: config.gridType,
        upperPrice: config.upperPrice,
        lowerPrice: config.lowerPrice,
        gridCount: config.gridCount,
        baseAmount: config.baseAmount,
        stopLoss: config.stopLoss,
        maxPositionRatio: config.maxPositionRatio,
        status: 'stopped', // Created strategies start as stopped
        totalProfit: 0,
        executedOrdersCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      const createdStrategy = await this.strategyRepository.create(strategy);

      this.logger.info('Grid strategy created successfully', {
        requestId,
        strategyId: createdStrategy.id,
        pair: createdStrategy.pair,
        network: createdStrategy.network,
      });

      return createdStrategy;
    } catch (error) {
      this.logger.error('Failed to create strategy', {
        requestId,
        error: error.message,
        config: this.sanitizeConfig(config),
      });
      throw error;
    }
  }

  async startStrategy(strategyId: string): Promise<void> {
    const requestId = `start_strategy_${Date.now()}`;

    try {
      this.logger.info('Starting strategy', { requestId, strategyId });

      const strategy = await this.strategyRepository.findById(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      if (strategy.status === 'active') {
        this.logger.warn('Strategy already active', { requestId, strategyId });
        return;
      }

      await this.strategyRepository.updateStatus(strategyId, 'active');

      this.logger.info('Strategy started successfully', {
        requestId,
        strategyId,
        pair: strategy.pair,
        network: strategy.network,
      });
    } catch (error) {
      this.logger.error('Failed to start strategy', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  async stopStrategy(strategyId: string): Promise<void> {
    const requestId = `stop_strategy_${Date.now()}`;

    try {
      this.logger.info('Stopping strategy', { requestId, strategyId });

      const strategy = await this.strategyRepository.findById(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      if (strategy.status === 'stopped') {
        this.logger.warn('Strategy already stopped', { requestId, strategyId });
        return;
      }

      await this.strategyRepository.updateStatus(strategyId, 'stopped');

      this.logger.info('Strategy stopped successfully', {
        requestId,
        strategyId,
        pair: strategy.pair,
        network: strategy.network,
      });
    } catch (error) {
      this.logger.error('Failed to stop strategy', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  async pauseStrategy(strategyId: string): Promise<void> {
    const requestId = `pause_strategy_${Date.now()}`;

    try {
      this.logger.info('Pausing strategy', { requestId, strategyId });

      const strategy = await this.strategyRepository.findById(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      if (strategy.status !== 'active') {
        throw new Error(`Cannot pause strategy with status: ${strategy.status}`);
      }

      await this.strategyRepository.updateStatus(strategyId, 'paused');

      this.logger.info('Strategy paused successfully', {
        requestId,
        strategyId,
        pair: strategy.pair,
        network: strategy.network,
      });
    } catch (error) {
      this.logger.error('Failed to pause strategy', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  async getStrategyStatus(strategyId: string): Promise<StrategyStatus> {
    const requestId = `get_strategy_status_${Date.now()}`;

    try {
      this.logger.debug('Getting strategy status', { requestId, strategyId });

      const strategies = await this.strategyRepository.getStrategySummaries();
      const strategy = strategies.find(s => s.id === strategyId);

      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      return {
        id: strategy.id,
        status: strategy.status,
        totalProfit: strategy.totalProfit,
        executedOrdersCount: strategy.executedOrdersCount,
        pendingOrders: strategy.pendingOrders,
        filledOrders: strategy.filledOrders,
        lastUpdated: strategy.updatedAt,
      };
    } catch (error) {
      this.logger.error('Failed to get strategy status', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  async getStrategiesByWallet(walletAddress: string): Promise<IGridStrategy[]> {
    const requestId = `get_strategies_by_wallet_${Date.now()}`;

    try {
      this.logger.debug('Getting strategies by wallet', { requestId, walletAddress });

      const strategies = await this.strategyRepository.findByWalletAddress(walletAddress);

      this.logger.debug('Retrieved strategies by wallet', {
        requestId,
        walletAddress,
        count: strategies.length,
      });

      return strategies;
    } catch (error) {
      this.logger.error('Failed to get strategies by wallet', {
        requestId,
        walletAddress,
        error: error.message,
      });
      throw error;
    }
  }

  async getActiveStrategies(): Promise<IGridStrategy[]> {
    const requestId = `get_active_strategies_${Date.now()}`;

    try {
      this.logger.debug('Getting active strategies', { requestId });

      const strategies = await this.strategyRepository.findActiveStrategies();

      this.logger.debug('Retrieved active strategies', {
        requestId,
        count: strategies.length,
      });

      return strategies;
    } catch (error) {
      this.logger.error('Failed to get active strategies', {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  validateStrategyConfig(config: GridStrategyConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!config.walletAddress?.trim()) {
      errors.push('Wallet address is required');
    }

    if (!config.pair?.trim()) {
      errors.push('Trading pair is required');
    }

    if (!config.network) {
      errors.push('Network is required');
    }

    // Price validation
    if (!config.upperPrice || config.upperPrice <= 0) {
      errors.push('Upper price must be greater than 0');
    }

    if (!config.lowerPrice || config.lowerPrice <= 0) {
      errors.push('Lower price must be greater than 0');
    }

    if (config.upperPrice <= config.lowerPrice) {
      errors.push('Upper price must be greater than lower price');
    }

    // Grid configuration validation
    if (!config.gridCount || config.gridCount < 2) {
      errors.push('Grid count must be at least 2');
    }

    if (config.gridCount > 100) {
      warnings.push('Grid count > 100 may impact performance');
    }

    // Amount validation
    if (!config.baseAmount || config.baseAmount <= 0) {
      errors.push('Base amount must be greater than 0');
    }

    // Position ratio validation
    if (!config.maxPositionRatio || config.maxPositionRatio <= 0 || config.maxPositionRatio > 1) {
      errors.push('Max position ratio must be between 0 and 1');
    }

    // Stop loss validation
    if (config.stopLoss !== undefined) {
      if (config.stopLoss >= config.lowerPrice) {
        errors.push('Stop loss must be below lower price');
      }
      if (config.stopLoss <= 0) {
        errors.push('Stop loss must be greater than 0');
      }
    }

    // Price range validation
    const priceRange = config.upperPrice - config.lowerPrice;
    const gridSpacing = priceRange / config.gridCount;

    if (gridSpacing < 0.01) {
      warnings.push('Grid spacing is very small, may result in frequent trades');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async deleteStrategy(strategyId: string): Promise<void> {
    const requestId = `delete_strategy_${Date.now()}`;

    try {
      this.logger.info('Deleting strategy', { requestId, strategyId });

      const strategy = await this.strategyRepository.findById(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      if (strategy.status === 'active') {
        throw new Error('Cannot delete active strategy. Stop the strategy first.');
      }

      await this.strategyRepository.deleteWithRelatedData(strategyId);

      this.logger.info('Strategy deleted successfully', {
        requestId,
        strategyId,
        pair: strategy.pair,
        network: strategy.network,
      });
    } catch (error) {
      this.logger.error('Failed to delete strategy', {
        requestId,
        strategyId,
        error: error.message,
      });
      throw error;
    }
  }

  private generateStrategyId(): string {
    return `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeConfig(config: GridStrategyConfig): Partial<GridStrategyConfig> {
    return {
      pair: config.pair,
      network: config.network,
      gridType: config.gridType,
      upperPrice: config.upperPrice,
      lowerPrice: config.lowerPrice,
      gridCount: config.gridCount,
      baseAmount: config.baseAmount,
      maxPositionRatio: config.maxPositionRatio,
    };
  }
}
