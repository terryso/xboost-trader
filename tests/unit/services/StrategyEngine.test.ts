import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyEngine, type GridStrategyConfig } from '../../../src/services/StrategyEngine';
import { StrategyRepository } from '../../../src/repositories/StrategyRepository';
import { DatabaseConnection } from '../../../src/utils/DatabaseConnection';
import { IGridStrategy } from '../../../src/models/types/database.types';

// Mock dependencies
vi.mock('../../../src/repositories/StrategyRepository');
vi.mock('../../../src/utils/DatabaseConnection');

describe('StrategyEngine', () => {
  let strategyEngine: StrategyEngine;
  let mockStrategyRepository: vi.Mocked<StrategyRepository>;
  let mockDb: vi.Mocked<DatabaseConnection>;
  let mockLogger: any;

  const validConfig: GridStrategyConfig = {
    walletAddress: '0x123456789abcdef',
    pair: 'ETH/USDT',
    network: 'linea',
    gridType: 'arithmetic',
    upperPrice: 2000,
    lowerPrice: 1500,
    gridCount: 10,
    baseAmount: 1000,
    maxPositionRatio: 0.8,
    stopLoss: 1400
  };

  const mockStrategy: IGridStrategy = {
    id: 'strategy_123',
    walletAddress: '0x123456789abcdef',
    pair: 'ETH/USDT',
    network: 'linea',
    gridType: 'arithmetic',
    upperPrice: 2000,
    lowerPrice: 1500,
    gridCount: 10,
    baseAmount: 1000,
    stopLoss: 1400,
    maxPositionRatio: 0.8,
    status: 'stopped',
    totalProfit: 0,
    executedOrdersCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockDb = {} as vi.Mocked<DatabaseConnection>;
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockStrategyRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
      findByWalletAddress: vi.fn(),
      findActiveStrategies: vi.fn(),
      getStrategySummaries: vi.fn(),
      deleteWithRelatedData: vi.fn()
    } as any;

    vi.mocked(StrategyRepository).mockImplementation(() => mockStrategyRepository);
    
    strategyEngine = new StrategyEngine(mockDb, mockLogger);
  });

  describe('createStrategy', () => {
    it('should create a valid strategy successfully', async () => {
      mockStrategyRepository.create.mockResolvedValue(mockStrategy);

      const result = await strategyEngine.createStrategy(validConfig);

      expect(result).toEqual(mockStrategy);
      expect(mockStrategyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: validConfig.walletAddress,
          pair: validConfig.pair,
          network: validConfig.network,
          gridType: validConfig.gridType,
          upperPrice: validConfig.upperPrice,
          lowerPrice: validConfig.lowerPrice,
          gridCount: validConfig.gridCount,
          baseAmount: validConfig.baseAmount,
          stopLoss: validConfig.stopLoss,
          maxPositionRatio: validConfig.maxPositionRatio,
          status: 'stopped',
          totalProfit: 0,
          executedOrdersCount: 0
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new grid strategy', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('Grid strategy created successfully', expect.any(Object));
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        ...validConfig,
        upperPrice: 1000, // Less than lowerPrice
        lowerPrice: 1500
      };

      await expect(strategyEngine.createStrategy(invalidConfig))
        .rejects.toThrow('Strategy configuration invalid');
      
      expect(mockStrategyRepository.create).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      mockStrategyRepository.create.mockRejectedValue(repositoryError);

      await expect(strategyEngine.createStrategy(validConfig))
        .rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create strategy', expect.any(Object));
    });
  });

  describe('startStrategy', () => {
    it('should start a stopped strategy', async () => {
      const stoppedStrategy = { ...mockStrategy, status: 'stopped' as const };
      mockStrategyRepository.findById.mockResolvedValue(stoppedStrategy);
      mockStrategyRepository.updateStatus.mockResolvedValue();

      await strategyEngine.startStrategy('strategy_123');

      expect(mockStrategyRepository.findById).toHaveBeenCalledWith('strategy_123');
      expect(mockStrategyRepository.updateStatus).toHaveBeenCalledWith('strategy_123', 'active');
      expect(mockLogger.info).toHaveBeenCalledWith('Strategy started successfully', expect.any(Object));
    });

    it('should handle already active strategy', async () => {
      const activeStrategy = { ...mockStrategy, status: 'active' as const };
      mockStrategyRepository.findById.mockResolvedValue(activeStrategy);

      await strategyEngine.startStrategy('strategy_123');

      expect(mockStrategyRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Strategy already active', expect.any(Object));
    });

    it('should throw error for non-existent strategy', async () => {
      mockStrategyRepository.findById.mockResolvedValue(null);

      await expect(strategyEngine.startStrategy('nonexistent'))
        .rejects.toThrow('Strategy not found: nonexistent');
      
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('stopStrategy', () => {
    it('should stop an active strategy', async () => {
      const activeStrategy = { ...mockStrategy, status: 'active' as const };
      mockStrategyRepository.findById.mockResolvedValue(activeStrategy);
      mockStrategyRepository.updateStatus.mockResolvedValue();

      await strategyEngine.stopStrategy('strategy_123');

      expect(mockStrategyRepository.updateStatus).toHaveBeenCalledWith('strategy_123', 'stopped');
      expect(mockLogger.info).toHaveBeenCalledWith('Strategy stopped successfully', expect.any(Object));
    });

    it('should handle already stopped strategy', async () => {
      mockStrategyRepository.findById.mockResolvedValue(mockStrategy);

      await strategyEngine.stopStrategy('strategy_123');

      expect(mockStrategyRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Strategy already stopped', expect.any(Object));
    });
  });

  describe('pauseStrategy', () => {
    it('should pause an active strategy', async () => {
      const activeStrategy = { ...mockStrategy, status: 'active' as const };
      mockStrategyRepository.findById.mockResolvedValue(activeStrategy);
      mockStrategyRepository.updateStatus.mockResolvedValue();

      await strategyEngine.pauseStrategy('strategy_123');

      expect(mockStrategyRepository.updateStatus).toHaveBeenCalledWith('strategy_123', 'paused');
      expect(mockLogger.info).toHaveBeenCalledWith('Strategy paused successfully', expect.any(Object));
    });

    it('should throw error when trying to pause non-active strategy', async () => {
      mockStrategyRepository.findById.mockResolvedValue(mockStrategy);

      await expect(strategyEngine.pauseStrategy('strategy_123'))
        .rejects.toThrow('Cannot pause strategy with status: stopped');
    });
  });

  describe('validateStrategyConfig', () => {
    it('should return valid for correct configuration', () => {
      const result = strategyEngine.validateStrategyConfig(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const invalidConfig = {
        ...validConfig,
        walletAddress: '',
        pair: ''
      };

      const result = strategyEngine.validateStrategyConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Wallet address is required');
      expect(result.errors).toContain('Trading pair is required');
    });

    it('should return errors for invalid price configuration', () => {
      const invalidConfig = {
        ...validConfig,
        upperPrice: 1000,
        lowerPrice: 1500
      };

      const result = strategyEngine.validateStrategyConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Upper price must be greater than lower price');
    });

    it('should return errors for invalid grid count', () => {
      const invalidConfig = {
        ...validConfig,
        gridCount: 1
      };

      const result = strategyEngine.validateStrategyConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Grid count must be at least 2');
    });

    it('should return warnings for extreme values', () => {
      const extremeConfig = {
        ...validConfig,
        gridCount: 150
      };

      const result = strategyEngine.validateStrategyConfig(extremeConfig);

      expect(result.warnings).toContain('Grid count > 100 may impact performance');
    });

    it('should validate stop loss configuration', () => {
      const invalidStopLossConfig = {
        ...validConfig,
        stopLoss: 1600 // Above lower price
      };

      const result = strategyEngine.validateStrategyConfig(invalidStopLossConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Stop loss must be below lower price');
    });
  });

  describe('getStrategyStatus', () => {
    it('should return strategy status with summary data', async () => {
      const strategySummary = {
        ...mockStrategy,
        pendingOrders: 5,
        filledOrders: 3
      };

      mockStrategyRepository.getStrategySummaries.mockResolvedValue([strategySummary]);

      const result = await strategyEngine.getStrategyStatus('strategy_123');

      expect(result).toEqual({
        id: mockStrategy.id,
        status: mockStrategy.status,
        totalProfit: mockStrategy.totalProfit,
        executedOrdersCount: mockStrategy.executedOrdersCount,
        pendingOrders: 5,
        filledOrders: 3,
        lastUpdated: mockStrategy.updatedAt
      });
    });

    it('should throw error for non-existent strategy', async () => {
      mockStrategyRepository.getStrategySummaries.mockResolvedValue([]);

      await expect(strategyEngine.getStrategyStatus('nonexistent'))
        .rejects.toThrow('Strategy not found: nonexistent');
    });
  });

  describe('deleteStrategy', () => {
    it('should delete a stopped strategy', async () => {
      mockStrategyRepository.findById.mockResolvedValue(mockStrategy);
      mockStrategyRepository.deleteWithRelatedData.mockResolvedValue();

      await strategyEngine.deleteStrategy('strategy_123');

      expect(mockStrategyRepository.deleteWithRelatedData).toHaveBeenCalledWith('strategy_123');
      expect(mockLogger.info).toHaveBeenCalledWith('Strategy deleted successfully', expect.any(Object));
    });

    it('should not delete active strategy', async () => {
      const activeStrategy = { ...mockStrategy, status: 'active' as const };
      mockStrategyRepository.findById.mockResolvedValue(activeStrategy);

      await expect(strategyEngine.deleteStrategy('strategy_123'))
        .rejects.toThrow('Cannot delete active strategy. Stop the strategy first.');

      expect(mockStrategyRepository.deleteWithRelatedData).not.toHaveBeenCalled();
    });
  });

  describe('getStrategiesByWallet', () => {
    it('should return strategies for wallet address', async () => {
      const strategies = [mockStrategy];
      mockStrategyRepository.findByWalletAddress.mockResolvedValue(strategies);

      const result = await strategyEngine.getStrategiesByWallet('0x123456789abcdef');

      expect(result).toEqual(strategies);
      expect(mockStrategyRepository.findByWalletAddress).toHaveBeenCalledWith('0x123456789abcdef');
    });
  });

  describe('getActiveStrategies', () => {
    it('should return active strategies', async () => {
      const activeStrategies = [{ ...mockStrategy, status: 'active' as const }];
      mockStrategyRepository.findActiveStrategies.mockResolvedValue(activeStrategies);

      const result = await strategyEngine.getActiveStrategies();

      expect(result).toEqual(activeStrategies);
      expect(mockStrategyRepository.findActiveStrategies).toHaveBeenCalled();
    });
  });
});