import { InputValidator, ValidationError } from './InputValidator.js';
import { CLIErrorHandler } from './ErrorHandler.js';

export interface CommandOptions {
  config?: string;
  verbose?: boolean;
  quiet?: boolean;
  logFile?: string;
}

export interface GridCreateOptions extends CommandOptions {
  upper: string;
  lower: string;
  grids: string;
  amount?: string;
  network?: string;
}

export interface GridManageOptions extends CommandOptions {
  strategy?: string;
}

export interface MonitorOptions extends CommandOptions {
  strategy?: string;
  interval?: string;
}

export interface StatsOptions extends CommandOptions {
  strategy?: string;
  days?: string;
  format?: string;
}

export interface ConfigOptions extends CommandOptions {
  network?: string;
}

export class CommandValidation {
  // Grid command validations
  static validateGridCreateCommand(
    pair: string,
    options: GridCreateOptions
  ): {
    pair: string;
    upper: number;
    lower: number;
    grids: number;
    amount?: number;
    network?: string;
  } {
    CLIErrorHandler.validateRequired(pair, 'trading pair');
    CLIErrorHandler.validateRequired(options.upper, 'upper price');
    CLIErrorHandler.validateRequired(options.lower, 'lower price');
    CLIErrorHandler.validateRequired(options.grids, 'grid count');

    const validatedPair = InputValidator.validateTradingPair(pair);
    const upperPrice = InputValidator.validatePrice(options.upper, 'upper');
    const lowerPrice = InputValidator.validatePrice(options.lower, 'lower');
    const gridCount = InputValidator.validateGridCount(options.grids);

    // Cross-field validation
    if (upperPrice <= lowerPrice) {
      throw new ValidationError('Upper price must be greater than lower price', 'upper', [
        `Lower: ${lowerPrice}, Upper: ${upperPrice}`,
        'Ensure upper > lower',
      ]);
    }

    const result: any = {
      pair: validatedPair,
      upper: upperPrice,
      lower: lowerPrice,
      grids: gridCount,
    };

    if (options.amount) {
      result.amount = InputValidator.validatePrice(options.amount, 'amount');
    }

    if (options.network) {
      result.network = InputValidator.validateNetworkParam(options.network);
    }

    return result;
  }

  static validateGridManageCommand(
    strategyId: string,
    options: GridManageOptions
  ): {
    strategyId: string;
  } {
    CLIErrorHandler.validateRequired(strategyId, 'strategy ID');

    return {
      strategyId: InputValidator.validateStrategyId(strategyId),
    };
  }

  // Config command validations
  static validateAddWalletCommand(
    address: string,
    options: ConfigOptions
  ): {
    address: string;
    network?: string;
  } {
    CLIErrorHandler.validateRequired(address, 'wallet address');

    const result: any = {
      address: InputValidator.validateWalletAddress(address),
    };

    if (options.network) {
      result.network = InputValidator.validateNetworkParam(options.network);
    }

    return result;
  }

  static validateSetNetworkCommand(network: string): {
    network: string;
  } {
    CLIErrorHandler.validateRequired(network, 'network');

    return {
      network: InputValidator.validateNetworkParam(network),
    };
  }

  // Monitor command validations
  static validateMonitorCommand(options: MonitorOptions): {
    strategy?: string;
    interval: number;
  } {
    const result: any = {
      interval: 5000, // Default 5 seconds
    };

    if (options.strategy) {
      result.strategy = InputValidator.validateStrategyId(options.strategy);
    }

    if (options.interval) {
      const intervalMs = parseInt(options.interval);
      if (isNaN(intervalMs) || intervalMs < 1000) {
        throw new ValidationError('Interval must be at least 1000ms (1 second)', 'interval', [
          'Example: --interval 5000 (5 seconds)',
          'Minimum: 1000ms',
        ]);
      }
      result.interval = intervalMs;
    }

    return result;
  }

  // Stats command validations
  static validateStatsCommand(options: StatsOptions): {
    strategy?: string;
    days: number;
    format: string;
  } {
    const result: any = {
      days: 7, // Default 7 days
      format: 'table', // Default table format
    };

    if (options.strategy) {
      result.strategy = InputValidator.validateStrategyId(options.strategy);
    }

    if (options.days) {
      const days = parseInt(options.days);
      if (isNaN(days) || days < 1 || days > 365) {
        throw new ValidationError('Days must be between 1 and 365', 'days', [
          'Example: --days 30 (30 days)',
          'Range: 1-365 days',
        ]);
      }
      result.days = days;
    }

    if (options.format) {
      const validFormats = ['table', 'json', 'csv'];
      if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`, 'format', [
          `Available: ${validFormats.join(', ')}`,
        ]);
      }
      result.format = options.format;
    }

    return result;
  }

  // Global options validation
  static validateGlobalOptions(options: CommandOptions): CommandOptions {
    const result: CommandOptions = {};

    if (options.config) {
      if (!options.config.trim()) {
        throw new ValidationError('Config file path cannot be empty', 'config', [
          'Example: --config ./config.yaml',
        ]);
      }
      result.config = options.config.trim();
    }

    if (options.logFile) {
      if (!options.logFile.trim()) {
        throw new ValidationError('Log file path cannot be empty', 'logFile', [
          'Example: --log-file ./logs/xboost.log',
        ]);
      }
      result.logFile = options.logFile.trim();
    }

    result.verbose = Boolean(options.verbose);
    result.quiet = Boolean(options.quiet);

    // Ensure verbose and quiet are not both set
    if (result.verbose && result.quiet) {
      throw new ValidationError('Cannot use both --verbose and --quiet options', 'options', [
        'Use either --verbose OR --quiet, not both',
      ]);
    }

    return result;
  }

  // Input sanitization helpers
  static sanitizeCommandInput(input: string): string {
    return InputValidator.sanitizeInput(input);
  }

  static sanitizeNumericOption(input: string): string {
    return InputValidator.sanitizeNumericInput(input);
  }

  static sanitizeAlphanumericOption(input: string): string {
    return InputValidator.sanitizeAlphanumericInput(input);
  }

  // Validation decorator for command methods
  static validateCommand<T extends unknown[], R>(validationFn: (...args: T) => any) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function (...args: T) {
        try {
          // Apply validation
          const validatedArgs = validationFn(...args);

          // Call original method with validated args
          return originalMethod.call(this, validatedArgs);
        } catch (error) {
          CLIErrorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            propertyKey
          );
        }
      };

      return descriptor;
    };
  }

  // Helper for validation error aggregation
  static aggregateValidationErrors(errors: ValidationError[]): ValidationError {
    if (errors.length === 0) {
      throw new Error('No errors to aggregate');
    }

    if (errors.length === 1) {
      return errors[0];
    }

    const messages = errors.map(e => `${e.field}: ${e.message}`);
    const allSuggestions = errors.flatMap(e => e.suggestions);

    return new ValidationError(
      `Multiple validation errors:\n  ${messages.join('\n  ')}`,
      'multiple',
      allSuggestions
    );
  }
}
