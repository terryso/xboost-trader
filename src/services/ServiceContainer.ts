import { DatabaseConnection } from '../utils/DatabaseConnection';
import type { IStrategyEngine } from './StrategyEngine';
import { StrategyEngine } from './StrategyEngine';
import { PriceMonitor, IPriceMonitor } from './PriceMonitor';
import { RiskManager, IRiskManager } from './RiskManager';
import type { OKXConfig } from './OKXService';
import { OKXService, IOKXService } from './OKXService';

export interface ServiceConfig {
  database: {
    path: string;
    maxConnections?: number;
    timeout?: number;
  };
  okx: OKXConfig;
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
    console?: boolean;
  };
  riskLimits: {
    maxPositionRatio: number;
    maxAbsolutePosition: number;
    maxDailyTrades: number;
    maxConcurrentStrategies: number;
  };
  priceMonitoring: {
    pollingInterval: number;
    cacheTimeout: number;
  };
}

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

type ServiceFactory<T> = () => T | Promise<T>;
type ServiceInstance<T> = T | Promise<T>;

export class ServiceContainer {
  private readonly services: Map<string, ServiceInstance<unknown>> = new Map();
  private readonly factories: Map<string, ServiceFactory<unknown>> = new Map();
  private config: ServiceConfig;
  private readonly logger: Logger;
  private isInitialized: boolean = false;
  private readonly registerCoreServices: boolean;

  constructor(config: ServiceConfig, logger?: Logger, registerCoreServices: boolean = true) {
    this.config = config;
    this.logger = logger || this.createDefaultLogger();
    this.registerCoreServices = registerCoreServices;
  }

  // Service registration methods
  register<T>(name: string, factory: ServiceFactory<T>): void {
    if (this.isInitialized) {
      throw new Error('Cannot register services after container initialization');
    }

    this.factories.set(name, factory);
    this.logger.debug(`Service registered: ${name}`);
  }

  registerSingleton<T>(name: string, factory: ServiceFactory<T>): void {
    this.register(name, () => {
      if (!this.services.has(name)) {
        const instance = factory();
        this.services.set(name, instance);
      }
      return this.services.get(name)!;
    });
  }

  registerInstance<T>(name: string, instance: T): void {
    if (this.isInitialized) {
      throw new Error('Cannot register services after container initialization');
    }

    this.services.set(name, instance);
    this.logger.debug(`Service instance registered: ${name}`);
  }

  // Service resolution methods
  async resolve<T>(name: string): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Container not initialized. Call initialize() first.');
    }

    // Check if instance already exists
    if (this.services.has(name)) {
      const service = this.services.get(name)!;
      return service instanceof Promise ? await service : service;
    }

    // Check if factory exists
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service not found: ${name}`);
    }

    try {
      const instance = factory();

      // Handle async factories
      if (instance instanceof Promise) {
        const resolvedInstance = await instance;
        this.services.set(name, resolvedInstance);
        return resolvedInstance;
      } else {
        this.services.set(name, instance);
        return instance;
      }
    } catch (error) {
      this.logger.error(`Failed to resolve service: ${name}`, { error: error.message });
      throw new Error(`Failed to resolve service ${name}: ${error.message}`);
    }
  }

  // Synchronous resolution for already initialized services
  get<T>(name: string): T {
    if (!this.isInitialized) {
      throw new Error('Container not initialized. Call initialize() first.');
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found or not yet initialized: ${name}`);
    }

    if (service instanceof Promise) {
      throw new Error(`Service ${name} is still initializing. Use resolve() instead.`);
    }

    return service;
  }

  // Container initialization
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Container already initialized');
      return;
    }

    try {
      this.logger.info('Initializing service container');

      // Register core services if enabled
      if (this.registerCoreServices) {
        await this.registerCoreServicesInternal();
      }

      // Initialize services in dependency order
      await this.initializeServices();

      this.isInitialized = true;

      this.logger.info('Service container initialized successfully', {
        registeredServices: Array.from(this.services.keys()).length,
      });
    } catch (error) {
      this.logger.error('Failed to initialize service container', { error: error.message });
      throw error;
    }
  }

  // Cleanup and shutdown
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down service container');

    try {
      // Shutdown services in reverse order
      const serviceNames = Array.from(this.services.keys()).reverse();

      for (const serviceName of serviceNames) {
        try {
          const service = await this.resolve(serviceName);

          // Call shutdown method if it exists
          if (service && typeof service.shutdown === 'function') {
            await service.shutdown();
            this.logger.debug(`Service shut down: ${serviceName}`);
          }
        } catch (error) {
          this.logger.error(`Error shutting down service: ${serviceName}`, {
            error: error.message,
          });
        }
      }

      // Clear all services
      this.services.clear();
      this.factories.clear();
      this.isInitialized = false;

      this.logger.info('Service container shut down successfully');
    } catch (error) {
      this.logger.error('Error during container shutdown', { error: error.message });
      throw error;
    }
  }

  // Configuration access
  getConfig(): ServiceConfig {
    return { ...this.config }; // Return copy to prevent modification
  }

  updateConfig(newConfig: Partial<ServiceConfig>): void {
    if (this.isInitialized) {
      this.logger.warn('Updating configuration after initialization may require service restart');
    }

    this.config = { ...this.config, ...newConfig };
    this.logger.info('Service configuration updated');
  }

  // Service introspection
  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  hasService(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  isServiceInitialized(name: string): boolean {
    const service = this.services.get(name);
    return service !== undefined && !(service instanceof Promise);
  }

  // Private methods
  private async registerCoreServicesInternal(): Promise<void> {
    // Database Connection
    this.registerSingleton('database', () => {
      this.logger.debug('Creating database connection');
      const dbConfig = {
        filename: this.config.database.path,
        maxConnections: this.config.database.maxConnections || 10,
        timeout: this.config.database.timeout || 5000,
      };
      return new DatabaseConnection(dbConfig);
    });

    // Strategy Engine
    this.registerSingleton('strategyEngine', async () => {
      this.logger.debug('Creating strategy engine');
      const db = await this.resolve<DatabaseConnection>('database');
      return new StrategyEngine(db, this.logger);
    });

    // Price Monitor
    this.registerSingleton('priceMonitor', async () => {
      this.logger.debug('Creating price monitor');
      const db = await this.resolve<DatabaseConnection>('database');
      return new PriceMonitor(db, this.logger);
    });

    // Risk Manager
    this.registerSingleton('riskManager', async () => {
      this.logger.debug('Creating risk manager');
      const strategyEngine = await this.resolve<IStrategyEngine>('strategyEngine');

      // Create emergency stop callback
      const emergencyStopCallback = async (strategyId?: string) => {
        if (strategyId) {
          await strategyEngine.stopStrategy(strategyId);
        } else {
          const activeStrategies = await strategyEngine.getActiveStrategies();
          await Promise.all(
            activeStrategies.map(strategy => strategyEngine.stopStrategy(strategy.id))
          );
        }
      };

      const riskManager = new RiskManager(this.logger, emergencyStopCallback);

      // Apply risk limits from configuration
      await riskManager.updateRiskLimits(this.config.riskLimits);

      return riskManager;
    });

    // OKX Service
    this.registerSingleton('okxService', async () => {
      this.logger.debug('Creating OKX service');
      const okxService = new OKXService(this.logger);
      await okxService.initialize(this.config.okx);
      return okxService;
    });
  }

  private async initializeServices(): Promise<void> {
    if (this.registerCoreServices) {
      // Initialize core services in dependency order
      const initializationOrder = [
        'database',
        'strategyEngine',
        'priceMonitor',
        'riskManager',
        'okxService',
      ];

      for (const serviceName of initializationOrder) {
        try {
          this.logger.debug(`Initializing service: ${serviceName}`);
          await this.resolve(serviceName);
          this.logger.debug(`Service initialized: ${serviceName}`);
        } catch (error) {
          this.logger.error(`Failed to initialize service: ${serviceName}`, {
            error: error.message,
          });
          throw new Error(`Service initialization failed: ${serviceName}`);
        }
      }
    }
    // For non-core services, they will be initialized on-demand via resolve()
  }

  private createDefaultLogger(): Logger {
    const logLevel = this.config.logging?.level || 'info';
    const shouldLog = this.config.logging?.console !== false;

    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[logLevel];

    const log = (level: string, message: string, meta?: Record<string, unknown>) => {
      if (!shouldLog || logLevels[level] > currentLevel) return;

      const timestamp = new Date().toISOString();
      const logEntry = meta
        ? `[${timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify(meta)}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`;

      console.log(logEntry);
    };

    return {
      error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
      warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
      info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
      debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
    };
  }

  // Health check methods
  async healthCheck(): Promise<{ [serviceName: string]: 'healthy' | 'unhealthy' | 'unknown' }> {
    const health: { [serviceName: string]: 'healthy' | 'unhealthy' | 'unknown' } = {};

    for (const serviceName of this.listServices()) {
      try {
        const service = await this.resolve(serviceName);

        // Check if service has a health check method
        if (service && typeof service.healthCheck === 'function') {
          const isHealthy = await service.healthCheck();
          health[serviceName] = isHealthy ? 'healthy' : 'unhealthy';
        } else {
          // If no health check method, assume healthy if resolvable
          health[serviceName] = 'healthy';
        }
      } catch (error) {
        this.logger.error(`Health check failed for service: ${serviceName}`, {
          error: error.message,
        });
        health[serviceName] = 'unhealthy';
      }
    }

    return health;
  }

  // Service lifecycle events
  onServiceReady(serviceName: string, callback: (service: unknown) => void): void {
    if (this.isServiceInitialized(serviceName)) {
      // Service already ready
      const service = this.get(serviceName);
      callback(service);
    } else {
      // Wait for service to be ready
      const checkInterval = setInterval(async () => {
        try {
          if (this.isServiceInitialized(serviceName)) {
            clearInterval(checkInterval);
            const service = this.get(serviceName);
            callback(service);
          }
        } catch (error) {
          clearInterval(checkInterval);
          this.logger.error(`Error waiting for service: ${serviceName}`, { error: error.message });
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.logger.error(`Timeout waiting for service: ${serviceName}`);
      }, 30000);
    }
  }
}

// Factory function for creating container with default configuration
export function createServiceContainer(
  config: Partial<ServiceConfig>,
  logger?: Logger
): ServiceContainer {
  const defaultConfig: ServiceConfig = {
    database: {
      path: './data/xboost-trader.db',
      maxConnections: 10,
      timeout: 5000,
    },
    okx: {
      sandbox: true,
      defaultSlippage: 0.005,
      maxGasPrice: 50000000000,
    },
    logging: {
      level: 'info',
      console: true,
    },
    riskLimits: {
      maxPositionRatio: 0.8,
      maxAbsolutePosition: 50000,
      maxDailyTrades: 100,
      maxConcurrentStrategies: 10,
    },
    priceMonitoring: {
      pollingInterval: 5000,
      cacheTimeout: 10000,
    },
  };

  const mergedConfig = { ...defaultConfig, ...config };
  return new ServiceContainer(mergedConfig, logger);
}
