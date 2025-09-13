import { ValidationError } from './InputValidator.js';
import chalk from 'chalk';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  STRATEGY_ERROR = 'STRATEGY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class CLIError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public suggestions: string[] = [],
    public cause?: Error
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class CLIErrorHandler {
  private static logError(error: Error, requestId: string): void {
    console.error(chalk.gray(`[${requestId}] Error logged:`, error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static handleError(error: Error, command?: string): never {
    const requestId = CLIErrorHandler.generateRequestId();

    // Log the error for debugging
    CLIErrorHandler.logError(error, requestId);

    if (error instanceof ValidationError) {
      CLIErrorHandler.handleValidationError(error, requestId);
    } else if (error instanceof CLIError) {
      CLIErrorHandler.handleCLIError(error, requestId);
    } else {
      CLIErrorHandler.handleUnknownError(error, requestId, command);
    }

    process.exit(1);
  }

  private static handleValidationError(error: ValidationError, requestId: string): void {
    console.error(chalk.red('❌ Validation Error'));
    console.error(chalk.yellow(`Field: ${error.field}`));
    console.error(chalk.white(`Message: ${error.message}`));

    if (error.suggestions.length > 0) {
      console.error(chalk.cyan('\n💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.error(chalk.cyan(`  • ${suggestion}`));
      });
    }

    console.error(chalk.gray(`\nRequest ID: ${requestId}`));
  }

  private static handleCLIError(error: CLIError, requestId: string): void {
    const iconMap = {
      [ErrorCode.VALIDATION_ERROR]: '❌',
      [ErrorCode.CONFIG_ERROR]: '⚙️',
      [ErrorCode.NETWORK_ERROR]: '🌐',
      [ErrorCode.SERVICE_ERROR]: '🔧',
      [ErrorCode.FILE_ERROR]: '📁',
      [ErrorCode.AUTH_ERROR]: '🔒',
      [ErrorCode.STRATEGY_ERROR]: '📊',
      [ErrorCode.UNKNOWN_ERROR]: '❓',
    };

    const icon = iconMap[error.code] || '❌';
    console.error(chalk.red(`${icon} ${error.code.replace('_', ' ')}`));
    console.error(chalk.white(`Message: ${error.message}`));

    if (error.suggestions.length > 0) {
      console.error(chalk.cyan('\n💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.error(chalk.cyan(`  • ${suggestion}`));
      });
    }

    if (error.cause) {
      console.error(chalk.gray(`\nCaused by: ${error.cause.message}`));
    }

    console.error(chalk.gray(`\nRequest ID: ${requestId}`));
  }

  private static handleUnknownError(error: Error, requestId: string, command?: string): void {
    console.error(chalk.red('❓ Unexpected Error'));
    console.error(chalk.white(`Message: ${error.message}`));

    if (command) {
      console.error(chalk.yellow(`Command: ${command}`));
    }

    console.error(chalk.cyan('\n💡 Suggestions:'));
    console.error(chalk.cyan('  • Check if all required dependencies are installed'));
    console.error(chalk.cyan('  • Verify your configuration file is valid'));
    console.error(chalk.cyan('  • Try running with --verbose for more details'));
    console.error(chalk.cyan('  • Report this issue if it persists'));

    console.error(chalk.gray(`\nRequest ID: ${requestId}`));
  }

  static wrapCommand<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    commandName: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        CLIErrorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          commandName
        );
      }
    };
  }

  static createError(
    message: string,
    code: ErrorCode,
    suggestions: string[] = [],
    cause?: Error
  ): CLIError {
    return new CLIError(message, code, suggestions, cause);
  }

  // Specific error creators for common scenarios
  static configError(message: string, suggestions: string[] = []): CLIError {
    return CLIErrorHandler.createError(message, ErrorCode.CONFIG_ERROR, suggestions);
  }

  static networkError(message: string, suggestions: string[] = []): CLIError {
    return CLIErrorHandler.createError(message, ErrorCode.NETWORK_ERROR, suggestions);
  }

  static serviceError(message: string, suggestions: string[] = []): CLIError {
    return CLIErrorHandler.createError(message, ErrorCode.SERVICE_ERROR, suggestions);
  }

  static fileError(message: string, suggestions: string[] = []): CLIError {
    return CLIErrorHandler.createError(message, ErrorCode.FILE_ERROR, suggestions);
  }

  static authError(message: string, suggestions: string[] = []): CLIError {
    return CLIErrorHandler.createError(message, ErrorCode.AUTH_ERROR, suggestions);
  }

  static strategyError(message: string, suggestions: string[] = []): CLIError {
    return CLIErrorHandler.createError(message, ErrorCode.STRATEGY_ERROR, suggestions);
  }

  // Helper method to check if error should be retried
  static isRetryable(error: Error): boolean {
    if (error instanceof CLIError) {
      return error.code === ErrorCode.NETWORK_ERROR || error.code === ErrorCode.SERVICE_ERROR;
    }
    return false;
  }

  // Helper method to extract user-friendly message
  static getUserMessage(error: Error): string {
    if (error instanceof ValidationError || error instanceof CLIError) {
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }

  // Helper method for command validation
  static validateRequired(
    value: unknown,
    fieldName: string
  ): asserts value is NonNullable<typeof value> {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${fieldName} is required`, fieldName, [
        `Please provide a valid ${fieldName}`,
      ]);
    }
  }
}
