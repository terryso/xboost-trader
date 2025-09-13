import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CLIErrorHandler, CLIError, ErrorCode } from '../../../../src/cli/utils/ErrorHandler.js';
import { ValidationError } from '../../../../src/cli/utils/InputValidator.js';

// Mock console methods
const mockConsoleError = vi.fn();
const mockProcessExit = vi.fn();

// Create explicit mocks
const consoleMock = {
  error: mockConsoleError,
  log: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};

const processMock = {
  exit: mockProcessExit,
  env: process.env
};

vi.stubGlobal('console', consoleMock);
vi.stubGlobal('process', processMock);

describe('CLIErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createError', () => {
    it('should create CLIError with correct properties', () => {
      const error = CLIErrorHandler.createError(
        'Test error',
        ErrorCode.VALIDATION_ERROR,
        ['suggestion 1', 'suggestion 2']
      );

      expect(error).toBeInstanceOf(CLIError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.suggestions).toEqual(['suggestion 1', 'suggestion 2']);
    });
  });

  describe('specific error creators', () => {
    it('should create config error', () => {
      const error = CLIErrorHandler.configError('Config not found', ['Check path']);
      expect(error.code).toBe(ErrorCode.CONFIG_ERROR);
      expect(error.message).toBe('Config not found');
      expect(error.suggestions).toEqual(['Check path']);
    });

    it('should create network error', () => {
      const error = CLIErrorHandler.networkError('Connection failed');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Connection failed');
    });

    it('should create service error', () => {
      const error = CLIErrorHandler.serviceError('Service unavailable');
      expect(error.code).toBe(ErrorCode.SERVICE_ERROR);
      expect(error.message).toBe('Service unavailable');
    });

    it('should create file error', () => {
      const error = CLIErrorHandler.fileError('File not found');
      expect(error.code).toBe(ErrorCode.FILE_ERROR);
      expect(error.message).toBe('File not found');
    });

    it('should create auth error', () => {
      const error = CLIErrorHandler.authError('Invalid credentials');
      expect(error.code).toBe(ErrorCode.AUTH_ERROR);
      expect(error.message).toBe('Invalid credentials');
    });

    it('should create strategy error', () => {
      const error = CLIErrorHandler.strategyError('Strategy failed');
      expect(error.code).toBe(ErrorCode.STRATEGY_ERROR);
      expect(error.message).toBe('Strategy failed');
    });
  });

  describe('wrapCommand', () => {
    it('should execute function normally when no error occurs', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = CLIErrorHandler.wrapCommand(mockFn, 'test-command');

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle errors when function throws', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const wrappedFn = CLIErrorHandler.wrapCommand(mockFn, 'test-command');

      // Mock process.exit to prevent actual exit
      mockProcessExit.mockImplementation(() => {
        throw new Error('Process exit called');
      });

      await expect(wrappedFn('arg1', 'arg2')).rejects.toThrow('Process exit called');

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const networkError = new CLIError('Network error', ErrorCode.NETWORK_ERROR);
      const serviceError = new CLIError('Service error', ErrorCode.SERVICE_ERROR);

      expect(CLIErrorHandler.isRetryable(networkError)).toBe(true);
      expect(CLIErrorHandler.isRetryable(serviceError)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const validationError = new CLIError('Validation error', ErrorCode.VALIDATION_ERROR);
      const configError = new CLIError('Config error', ErrorCode.CONFIG_ERROR);
      const genericError = new Error('Generic error');

      expect(CLIErrorHandler.isRetryable(validationError)).toBe(false);
      expect(CLIErrorHandler.isRetryable(configError)).toBe(false);
      expect(CLIErrorHandler.isRetryable(genericError)).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('should return message for ValidationError', () => {
      const error = new ValidationError('Invalid input', 'field');
      expect(CLIErrorHandler.getUserMessage(error)).toBe('Invalid input');
    });

    it('should return message for CLIError', () => {
      const error = new CLIError('CLI error', ErrorCode.CONFIG_ERROR);
      expect(CLIErrorHandler.getUserMessage(error)).toBe('CLI error');
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(CLIErrorHandler.getUserMessage(error)).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('validateRequired', () => {
    it('should pass for valid values', () => {
      expect(() => CLIErrorHandler.validateRequired('value', 'field')).not.toThrow();
      expect(() => CLIErrorHandler.validateRequired(123, 'field')).not.toThrow();
      expect(() => CLIErrorHandler.validateRequired(false, 'field')).not.toThrow();
    });

    it('should throw ValidationError for invalid values', () => {
      expect(() => CLIErrorHandler.validateRequired(undefined, 'field')).toThrow(ValidationError);
      expect(() => CLIErrorHandler.validateRequired(null, 'field')).toThrow(ValidationError);
      expect(() => CLIErrorHandler.validateRequired('', 'field')).toThrow(ValidationError);
    });

    it('should include field name in error message', () => {
      try {
        CLIErrorHandler.validateRequired(undefined, 'username');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('username');
        expect((error as ValidationError).field).toBe('username');
      }
    });
  });
});