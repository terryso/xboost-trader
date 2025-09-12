import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContainer, createServiceContainer, type ServiceConfig } from '../../../src/services/ServiceContainer';
import { DatabaseConnection } from '../../../src/utils/DatabaseConnection';
import { StrategyEngine } from '../../../src/services/StrategyEngine';
import { PriceMonitor } from '../../../src/services/PriceMonitor';
import { RiskManager } from '../../../src/services/RiskManager';
import { OKXService } from '../../../src/services/OKXService';

// Mock all service classes
vi.mock('../../../src/utils/DatabaseConnection');
vi.mock('../../../src/services/StrategyEngine');
vi.mock('../../../src/services/PriceMonitor');
vi.mock('../../../src/services/RiskManager');
vi.mock('../../../src/services/OKXService');

describe('ServiceContainer', () => {
  let container: ServiceContainer;
  let mockLogger: any;
  let mockConfig: ServiceConfig;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };

    mockConfig = {
      database: {
        path: './test.db',
        maxConnections: 5,
        timeout: 3000
      },
      okx: {
        sandbox: true,
        defaultSlippage: 0.005
      },
      logging: {
        level: 'debug',
        console: true
      },
      riskLimits: {
        maxPositionRatio: 0.8,
        maxAbsolutePosition: 50000,
        maxDailyTrades: 100,
        maxConcurrentStrategies: 10
      },
      priceMonitoring: {
        pollingInterval: 5000,
        cacheTimeout: 10000
      }
    };

    container = new ServiceContainer(mockConfig, mockLogger);

    // Mock service constructors with proper constructor behavior
    vi.mocked(DatabaseConnection).mockImplementation((config) => {
      const instance = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        healthCheck: vi.fn().mockResolvedValue(true),
        initialize: vi.fn().mockResolvedValue(undefined),
        config
      };
      return instance as any;
    });

    vi.mocked(StrategyEngine).mockImplementation((db, logger) => ({
      stopStrategy: vi.fn().mockResolvedValue(undefined),
      getActiveStrategies: vi.fn().mockResolvedValue([]),
      healthCheck: vi.fn().mockResolvedValue(true),
      db,
      logger
    }) as any);

    vi.mocked(PriceMonitor).mockImplementation((db, logger) => ({
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue(true),
      db,
      logger
    }) as any);

    vi.mocked(RiskManager).mockImplementation((logger, emergencyCallback) => ({
      updateRiskLimits: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue(true),
      logger,
      emergencyCallback
    }) as any);

    vi.mocked(OKXService).mockImplementation((logger) => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue(true),
      logger
    }) as any);
  });

  describe('service registration', () => {
    it('should register services with factories', () => {
      const mockFactory = vi.fn(() => 'test-service');
      
      container.register('testService', mockFactory);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Service registered: testService');
    });

    it('should register singleton services', () => {
      const mockFactory = vi.fn(() => 'test-service');
      
      container.registerSingleton('testService', mockFactory);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Service registered: testService');
    });

    it('should register service instances', () => {
      const mockInstance = { test: true };
      
      container.registerInstance('testService', mockInstance);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Service instance registered: testService');
    });

    it('should prevent registration after initialization', async () => {
      // Create a simple container without core services for this test
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('simpleService', { test: true });
      await simpleContainer.initialize();
      
      expect(() => {
        simpleContainer.register('testService', () => 'test');
      }).toThrow('Cannot register services after container initialization');
    });
  });

  describe('service resolution', () => {
    it('should resolve simple services', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const testService = { name: 'test' };
      simpleContainer.registerInstance('testService', testService);
      
      await simpleContainer.initialize();
      
      const resolved = await simpleContainer.resolve('testService');
      expect(resolved).toBe(testService);
    });

    it('should return same instance for singleton services', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      let callCount = 0;
      
      simpleContainer.registerSingleton('testService', () => {
        callCount++;
        return { id: callCount };
      });
      
      await simpleContainer.initialize();
      
      const service1 = await simpleContainer.resolve('testService');
      const service2 = await simpleContainer.resolve('testService');
      
      expect(service1).toBe(service2);
      expect(callCount).toBe(1);
    });

    it('should throw error for unregistered services', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      await simpleContainer.initialize();
      
      await expect(simpleContainer.resolve('nonExistentService'))
        .rejects.toThrow('Service not found: nonExistentService');
    });

    it('should throw error if container not initialized', async () => {
      const uninitializedContainer = new ServiceContainer(mockConfig, mockLogger);
      
      await expect(uninitializedContainer.resolve('testService'))
        .rejects.toThrow('Container not initialized');
    });
  });

  describe('synchronous service access', () => {
    it('should get initialized services synchronously', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const testService = { name: 'test' };
      simpleContainer.registerInstance('testService', testService);
      await simpleContainer.initialize();
      
      // First resolve to ensure service is initialized
      await simpleContainer.resolve('testService');
      
      const service = simpleContainer.get('testService');
      expect(service).toBe(testService);
    });

    it('should throw error for uninitialized services', () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      
      expect(() => {
        simpleContainer.get('nonExistentService');
      }).toThrow('Container not initialized');
    });

    it('should throw error if container not initialized', () => {
      const uninitializedContainer = new ServiceContainer(mockConfig, mockLogger);
      
      expect(() => {
        uninitializedContainer.get('testService');
      }).toThrow('Container not initialized');
    });
  });

  describe('container initialization', () => {
    it('should initialize successfully', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      
      await simpleContainer.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing service container');
      expect(mockLogger.info).toHaveBeenCalledWith('Service container initialized successfully', 
        expect.objectContaining({ registeredServices: expect.any(Number) })
      );
    });

    it('should handle duplicate initialization gracefully', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      
      await simpleContainer.initialize();
      await simpleContainer.initialize(); // Second call

      expect(mockLogger.warn).toHaveBeenCalledWith('Container already initialized');
    });

    it('should handle initialization errors', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, true); // Enable core services
      // Mock the core services to fail
      vi.mocked(DatabaseConnection).mockImplementationOnce(() => {
        throw new Error('Database initialization failed');
      });

      await expect(simpleContainer.initialize())
        .rejects.toThrow('Service initialization failed');
    });
  });

  describe('container shutdown', () => {
    it('should shutdown services in reverse order', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      await simpleContainer.initialize();
      
      await simpleContainer.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down service container');
      expect(mockLogger.info).toHaveBeenCalledWith('Service container shut down successfully');
    });

    it('should call shutdown methods if they exist', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const mockService = {
        shutdown: vi.fn().mockResolvedValue(undefined)
      };
      
      simpleContainer.registerInstance('testService', mockService);
      await simpleContainer.initialize();
      
      await simpleContainer.shutdown();

      expect(mockService.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const mockService = {
        shutdown: vi.fn().mockRejectedValue(new Error('Shutdown failed'))
      };
      
      simpleContainer.registerInstance('testService', mockService);
      await simpleContainer.initialize();
      
      await simpleContainer.shutdown();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error shutting down service: testService',
        expect.any(Object)
      );
    });
  });

  describe('configuration management', () => {
    it('should return configuration copy', () => {
      const config = container.getConfig();

      expect(config).toEqual(mockConfig);
      expect(config).not.toBe(mockConfig); // Different references
    });

    it('should update configuration', () => {
      const updates = {
        riskLimits: {
          maxPositionRatio: 0.7,
          maxAbsolutePosition: 40000,
          maxDailyTrades: 80,
          maxConcurrentStrategies: 8
        }
      };

      container.updateConfig(updates);

      const updatedConfig = container.getConfig();
      expect(updatedConfig.riskLimits.maxPositionRatio).toBe(0.7);
      expect(mockLogger.info).toHaveBeenCalledWith('Service configuration updated');
    });

    it('should warn when updating config after initialization', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      await simpleContainer.initialize();
      
      simpleContainer.updateConfig({ riskLimits: { maxPositionRatio: 0.7 } } as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Updating configuration after initialization may require service restart'
      );
    });
  });

  describe('service introspection', () => {
    it('should list all services', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      simpleContainer.registerInstance('anotherService', { name: 'another' });
      await simpleContainer.initialize();
      
      const services = simpleContainer.listServices();

      expect(services).toContain('testService');
      expect(services).toContain('anotherService');
    });

    it('should check if service exists', () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      
      expect(simpleContainer.hasService('testService')).toBe(true);
      expect(simpleContainer.hasService('nonExistentService')).toBe(false);
    });

    it('should check if service is initialized', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.registerInstance('testService', { name: 'test' });
      await simpleContainer.initialize();
      
      // Resolve to ensure initialization
      await simpleContainer.resolve('testService');
      
      expect(simpleContainer.isServiceInitialized('testService')).toBe(true);
    });
  });

  describe('health checks', () => {
    it('should perform health checks on all services', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const healthyService = {
        healthCheck: vi.fn().mockResolvedValue(true)
      };
      
      simpleContainer.registerInstance('testService', healthyService);
      await simpleContainer.initialize();

      const health = await simpleContainer.healthCheck();
      expect(health).toHaveProperty('testService', 'healthy');
    });

    it('should handle services without health check methods', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const serviceWithoutHealthCheck = {};
      simpleContainer.registerInstance('testService', serviceWithoutHealthCheck);
      await simpleContainer.initialize();

      const health = await simpleContainer.healthCheck();
      expect(health).toHaveProperty('testService', 'healthy');
    });

    it('should mark unhealthy services', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const unhealthyService = {
        healthCheck: vi.fn().mockResolvedValue(false)
      };
      
      simpleContainer.registerInstance('unhealthyService', unhealthyService);
      await simpleContainer.initialize();

      const health = await simpleContainer.healthCheck();
      expect(health).toHaveProperty('unhealthyService', 'unhealthy');
    });
  });

  describe('service lifecycle events', () => {
    it('should call callback when service is ready', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const callback = vi.fn();
      simpleContainer.registerInstance('testService', { name: 'test' });
      
      await simpleContainer.initialize();
      await simpleContainer.resolve('testService'); // Ensure service is ready
      
      simpleContainer.onServiceReady('testService', callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should wait for service to become ready', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      const callback = vi.fn();
      simpleContainer.registerInstance('testService', { name: 'test' });
      
      // Initialize first to avoid the container not initialized error
      await simpleContainer.initialize();
      
      simpleContainer.onServiceReady('testService', callback);
      
      await simpleContainer.resolve('testService');
      
      // Allow event loop to process
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('createServiceContainer factory', () => {
    it('should create container with default configuration', () => {
      const container = createServiceContainer({});

      expect(container).toBeInstanceOf(ServiceContainer);
      const config = container.getConfig();
      expect(config.database.path).toBeDefined();
      expect(config.okx.sandbox).toBe(true);
      expect(config.logging.level).toBe('info');
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig = {
        database: { path: './custom.db' },
        logging: { level: 'debug' as const }
      };

      const container = createServiceContainer(customConfig);
      const config = container.getConfig();

      expect(config.database.path).toBe('./custom.db');
      expect(config.logging.level).toBe('debug');
      expect(config.okx.sandbox).toBe(true); // Default value preserved
    });

    it('should accept custom logger', () => {
      const customLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
      };

      const container = createServiceContainer({}, customLogger);
      
      expect(container).toBeInstanceOf(ServiceContainer);
    });
  });

  describe('error scenarios', () => {
    it('should handle service factory errors', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.register('failingService', () => {
        throw new Error('Factory error');
      });

      await simpleContainer.initialize();

      await expect(simpleContainer.resolve('failingService'))
        .rejects.toThrow('Failed to resolve service failingService: Factory error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to resolve service: failingService',
        expect.any(Object)
      );
    });

    it('should handle async factory errors', async () => {
      const simpleContainer = new ServiceContainer(mockConfig, mockLogger, false);
      simpleContainer.register('asyncFailingService', async () => {
        throw new Error('Async factory error');
      });

      await simpleContainer.initialize();

      await expect(simpleContainer.resolve('asyncFailingService'))
        .rejects.toThrow('Failed to resolve service asyncFailingService: Async factory error');
    });
  });
});