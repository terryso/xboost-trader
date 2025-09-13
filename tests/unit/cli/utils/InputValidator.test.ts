import { describe, it, expect } from 'vitest';
import { InputValidator, ValidationError } from '../../../../src/cli/utils/InputValidator.js';

describe('InputValidator', () => {
  describe('validateNetworkParam', () => {
    it('should validate supported networks', () => {
      expect(InputValidator.validateNetworkParam('linea')).toBe('linea');
      expect(InputValidator.validateNetworkParam('bnb')).toBe('bnb');
      expect(InputValidator.validateNetworkParam('ethereum')).toBe('ethereum');
      expect(InputValidator.validateNetworkParam('arbitrum')).toBe('arbitrum');
    });

    it('should throw ValidationError for unsupported network', () => {
      expect(() => InputValidator.validateNetworkParam('unsupported')).toThrow(ValidationError);
    });

    it('should provide suggestions for similar network names', () => {
      try {
        InputValidator.validateNetworkParam('lin');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).suggestions).toContain('Did you mean: linea?');
      }
    });
  });

  describe('validateTradingPair', () => {
    it('should validate correct trading pair format', () => {
      expect(InputValidator.validateTradingPair('ETH/USDC')).toBe('ETH/USDC');
      expect(InputValidator.validateTradingPair('btc/usdt')).toBe('BTC/USDT');
    });

    it('should throw ValidationError for invalid format', () => {
      expect(() => InputValidator.validateTradingPair('ETHUSDC')).toThrow(ValidationError);
      expect(() => InputValidator.validateTradingPair('ETH-USDC')).toThrow(ValidationError);
    });

    it('should throw ValidationError for same base and quote', () => {
      expect(() => InputValidator.validateTradingPair('ETH/ETH')).toThrow(ValidationError);
    });

    it('should provide helpful suggestions', () => {
      try {
        InputValidator.validateTradingPair('ETHUSDC');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).suggestions).toContain('Example: ETH/USDC, BTC/USDT, SOL/USDC');
      }
    });
  });

  describe('validatePrice', () => {
    it('should validate positive numbers', () => {
      expect(InputValidator.validatePrice('100.50', 'price')).toBe(100.50);
      expect(InputValidator.validatePrice(0.001, 'price')).toBe(0.001);
    });

    it('should throw ValidationError for negative prices', () => {
      expect(() => InputValidator.validatePrice('-100', 'price')).toThrow(ValidationError);
    });

    it('should throw ValidationError for very small prices', () => {
      expect(() => InputValidator.validatePrice('0.0000001', 'price')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid numbers', () => {
      expect(() => InputValidator.validatePrice('abc', 'price')).toThrow(ValidationError);
    });
  });

  describe('validateGridCount', () => {
    it('should validate valid grid counts', () => {
      expect(InputValidator.validateGridCount('5')).toBe(5);
      expect(InputValidator.validateGridCount(20)).toBe(20);
    });

    it('should throw ValidationError for count less than 3', () => {
      expect(() => InputValidator.validateGridCount('2')).toThrow(ValidationError);
    });

    it('should throw ValidationError for count greater than 200', () => {
      expect(() => InputValidator.validateGridCount('201')).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-integers', () => {
      expect(() => InputValidator.validateGridCount('5.5')).toThrow(ValidationError);
    });
  });

  describe('validateWalletAddress', () => {
    it('should validate correct wallet address format', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(InputValidator.validateWalletAddress(address)).toBe(address);
    });

    it('should throw ValidationError for invalid format', () => {
      expect(() => InputValidator.validateWalletAddress('0x123')).toThrow(ValidationError);
      expect(() => InputValidator.validateWalletAddress('1234567890123456789012345678901234567890')).toThrow(ValidationError);
    });
  });

  describe('validateStrategyId', () => {
    it('should validate correct strategy IDs', () => {
      expect(InputValidator.validateStrategyId('eth-usdc-grid-1')).toBe('eth-usdc-grid-1');
      expect(InputValidator.validateStrategyId('my_strategy_001')).toBe('my_strategy_001');
    });

    it('should throw ValidationError for empty ID', () => {
      expect(() => InputValidator.validateStrategyId('')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid characters', () => {
      expect(() => InputValidator.validateStrategyId('strategy with spaces')).toThrow(ValidationError);
      expect(() => InputValidator.validateStrategyId('strategy@#$')).toThrow(ValidationError);
    });
  });

  describe('validateGridCreateParams', () => {
    it('should validate valid grid creation parameters', () => {
      const params = {
        pair: 'ETH/USDC',
        upper: 3000,
        lower: 2000,
        grids: 10,
        amount: 1000
      };
      
      const result = InputValidator.validateGridCreateParams(params);
      expect(result).toEqual(params);
    });

    it('should throw ValidationError when upper <= lower', () => {
      const params = {
        pair: 'ETH/USDC',
        upper: 2000,
        lower: 3000,
        grids: 10
      };
      
      expect(() => InputValidator.validateGridCreateParams(params)).toThrow(ValidationError);
    });
  });

  describe('validateConfigFile', () => {
    it('should validate correct configuration', () => {
      const config = {
        wallets: [{
          address: '0x1234567890123456789012345678901234567890',
          networks: ['linea'],
          encrypted_key_file: 'wallet.enc'
        }],
        networks: {
          linea: {
            rpc_url: 'https://rpc.linea.build',
            gas_price_strategy: 'fast' as const
          }
        }
      };
      
      const result = InputValidator.validateConfigFile(config);
      expect(result).toEqual(config);
    });

    it('should throw ValidationError for invalid configuration', () => {
      const config = {
        wallets: [{
          address: 'invalid-address',
          networks: ['unsupported'],
          encrypted_key_file: ''
        }]
      };
      
      expect(() => InputValidator.validateConfigFile(config)).toThrow(ValidationError);
    });
  });

  describe('sanitization methods', () => {
    it('should sanitize general input', () => {
      expect(InputValidator.sanitizeInput('  <script>alert("xss")</script>  ')).toBe('scriptalert(xss)/script');
    });

    it('should sanitize numeric input', () => {
      expect(InputValidator.sanitizeNumericInput('abc123.45def')).toBe('123.45');
    });

    it('should sanitize alphanumeric input', () => {
      expect(InputValidator.sanitizeAlphanumericInput('test@#$123_value')).toBe('test123_value');
    });
  });
});