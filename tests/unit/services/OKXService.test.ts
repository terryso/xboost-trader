import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OKXService, type OKXConfig, type OrderRequest } from '../../../src/services/OKXService';

describe('OKXService', () => {
  let okxService: OKXService;
  let mockLogger: any;

  const validConfig: OKXConfig = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    apiPassphrase: 'test-passphrase',
    sandbox: true,
    defaultSlippage: 0.005,
    maxGasPrice: 50000000000
  };

  const validOrder: OrderRequest = {
    pair: 'ETH/USDT',
    side: 'buy',
    amount: '1.0',
    price: '1800.0',
    type: 'limit',
    network: 'linea',
    walletAddress: '0x123456789abcdef123456789abcdef123456789a'
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    okxService = new OKXService(mockLogger);
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      await okxService.initialize(validConfig);

      expect(mockLogger.info).toHaveBeenCalledWith('OKX service initialized successfully', expect.any(Object));
    });

    it('should initialize without API credentials for testing', async () => {
      const minimalConfig: OKXConfig = {
        sandbox: true
      };

      await okxService.initialize(minimalConfig);

      expect(mockLogger.info).toHaveBeenCalledWith('OKX service initialized successfully', expect.any(Object));
    });

    it('should apply default configuration values', async () => {
      const minimalConfig: OKXConfig = {};

      await okxService.initialize(minimalConfig);

      // Verify defaults were applied (we can't directly access private config, but initialization should succeed)
      expect(mockLogger.info).toHaveBeenCalledWith('OKX service initialized successfully', expect.any(Object));
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        apiKey: 'test-key',
        // Missing apiSecret when apiKey is provided
      };

      await expect(okxService.initialize(invalidConfig))
        .rejects.toThrow('API secret is required when API key is provided');
    });

    it('should reject config with API key but no passphrase', async () => {
      const invalidConfig = {
        apiKey: 'test-key',
        apiSecret: 'test-secret'
        // Missing apiPassphrase
      };

      await expect(okxService.initialize(invalidConfig))
        .rejects.toThrow('API passphrase is required when API key is provided');
    });
  });

  describe('order operations', () => {
    beforeEach(async () => {
      await okxService.initialize(validConfig);
    });

    describe('placeOrder', () => {
      it('should place a valid limit order', async () => {
        const result = await okxService.placeOrder(validOrder);

        expect(result).toMatchObject({
          orderId: expect.stringMatching(/^okx_/),
          txHash: expect.stringMatching(/^0x/),
          status: 'pending',
          executedAmount: '0',
          gasUsed: expect.any(Number),
          gasPrice: expect.any(Number),
          fee: expect.any(String),
          timestamp: expect.any(Date)
        });

        expect(mockLogger.info).toHaveBeenCalledWith('Order placed successfully', expect.any(Object));
      });

      it('should place a valid market order', async () => {
        const marketOrder = {
          ...validOrder,
          type: 'market' as const,
          price: undefined
        };

        const result = await okxService.placeOrder(marketOrder);

        expect(result.orderId).toMatch(/^okx_/);
        expect(mockLogger.info).toHaveBeenCalledWith('Order placed successfully', expect.any(Object));
      });

      it('should reject orders for unsupported networks', async () => {
        const unsupportedNetworkOrder = {
          ...validOrder,
          network: 'ethereum' as const // Not enabled in test config
        };

        await expect(okxService.placeOrder(unsupportedNetworkOrder))
          .rejects.toThrow('Order validation failed: Network ethereum is not supported');
      });

      it('should validate order before placement', async () => {
        const invalidOrder = {
          ...validOrder,
          amount: '-1.0' // Invalid negative amount
        };

        await expect(okxService.placeOrder(invalidOrder))
          .rejects.toThrow('Order validation failed');
      });

      it('should handle service not initialized error', async () => {
        const uninitializedService = new OKXService(mockLogger);

        await expect(uninitializedService.placeOrder(validOrder))
          .rejects.toThrow('OKX service not initialized');
      });
    });

    describe('cancelOrder', () => {
      it('should cancel an existing order', async () => {
        const orderId = 'okx_test_order_123';

        await okxService.cancelOrder(orderId);

        expect(mockLogger.info).toHaveBeenCalledWith('Order cancelled successfully', 
          expect.objectContaining({ orderId })
        );
      });

      it('should handle cancellation errors gracefully', async () => {
        // Test with service not initialized
        const uninitializedService = new OKXService(mockLogger);

        await expect(uninitializedService.cancelOrder('test_order'))
          .rejects.toThrow('OKX service not initialized');
      });
    });

    describe('getOrderStatus', () => {
      it('should return order status', async () => {
        const orderId = 'okx_test_order_123';

        const status = await okxService.getOrderStatus(orderId);

        expect(status).toMatchObject({
          orderId,
          status: expect.any(String),
          originalAmount: expect.any(String),
          executedAmount: expect.any(String),
          remainingAmount: expect.any(String),
          timestamp: expect.any(Date),
          lastUpdated: expect.any(Date)
        });

        expect(['pending', 'filled', 'failed', 'cancelled', 'partially_filled'])
          .toContain(status.status);
      });

      it('should handle errors when fetching order status', async () => {
        const uninitializedService = new OKXService(mockLogger);

        await expect(uninitializedService.getOrderStatus('test_order'))
          .rejects.toThrow('OKX service not initialized');
      });
    });
  });

  describe('balance operations', () => {
    beforeEach(async () => {
      await okxService.initialize(validConfig);
    });

    it('should get wallet balance for supported network', async () => {
      const walletAddress = '0x123456789abcdef123456789abcdef123456789a';

      const balance = await okxService.getBalance('linea', walletAddress);

      expect(balance).toMatchObject({
        network: 'linea',
        tokenBalances: expect.arrayContaining([
          expect.objectContaining({
            symbol: expect.any(String),
            balance: expect.any(String),
            valueUsd: expect.any(String)
          })
        ]),
        totalValueUsd: expect.any(String),
        lastUpdated: expect.any(Date)
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Balance retrieved successfully', expect.any(Object));
    });

    it('should reject balance requests for unsupported networks', async () => {
      const walletAddress = '0x123456789abcdef123456789abcdef123456789a';

      await expect(okxService.getBalance('ethereum', walletAddress))
        .rejects.toThrow('Network ethereum is not currently supported');
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await okxService.initialize(validConfig);
    });

    describe('getSupportedNetworks', () => {
      it('should return list of supported networks', () => {
        const networks = okxService.getSupportedNetworks();

        expect(networks).toBeInstanceOf(Array);
        expect(networks.length).toBeGreaterThan(0);
        
        networks.forEach(network => {
          expect(network).toMatchObject({
            network: expect.any(String),
            chainId: expect.any(Number),
            rpcEndpoint: expect.any(String),
            blockExplorer: expect.any(String),
            nativeCurrency: {
              symbol: expect.any(String),
              decimals: expect.any(Number)
            },
            isEnabled: expect.any(Boolean)
          });
        });
      });

      it('should return a copy of networks (not reference)', () => {
        const networks1 = okxService.getSupportedNetworks();
        const networks2 = okxService.getSupportedNetworks();

        expect(networks1).not.toBe(networks2); // Different references
        expect(networks1).toEqual(networks2); // Same content
      });
    });

    describe('getTokenPrice', () => {
      it('should return token price', async () => {
        const price = await okxService.getTokenPrice('ETH', 'linea');

        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThan(0);
        expect(mockLogger.debug).toHaveBeenCalledWith('Token price retrieved', expect.any(Object));
      });

      it('should handle unknown tokens', async () => {
        const price = await okxService.getTokenPrice('UNKNOWN_TOKEN', 'linea');

        expect(price).toBe(0);
      });
    });

    describe('estimateGas', () => {
      it('should estimate gas for limit order', async () => {
        const gasEstimate = await okxService.estimateGas(validOrder);

        expect(gasEstimate).toMatchObject({
          gasLimit: expect.any(Number),
          gasPrice: expect.any(Number),
          estimatedFee: expect.any(String)
        });

        expect(gasEstimate.gasLimit).toBeGreaterThan(0);
        expect(gasEstimate.gasPrice).toBeGreaterThan(0);
        expect(mockLogger.debug).toHaveBeenCalledWith('Gas estimation completed', expect.any(Object));
      });

      it('should estimate gas for market order', async () => {
        const marketOrder = {
          ...validOrder,
          type: 'market' as const,
          price: undefined
        };

        const gasEstimate = await okxService.estimateGas(marketOrder);

        expect(gasEstimate.gasLimit).toBeGreaterThan(0);
        // Market orders might have different gas limits than limit orders
        expect(gasEstimate.gasLimit).toBeLessThanOrEqual(200000);
      });

      it('should respect max gas price limits', async () => {
        const gasEstimate = await okxService.estimateGas(validOrder);

        // Should not exceed the configured max gas price
        expect(gasEstimate.gasPrice).toBeLessThanOrEqual(validConfig.maxGasPrice!);
      });
    });

    describe('validateOrder', () => {
      it('should validate correct order', async () => {
        const validation = await okxService.validateOrder(validOrder);

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject order with missing required fields', async () => {
        const invalidOrder = {
          ...validOrder,
          pair: '',
          amount: ''
        };

        const validation = await okxService.validateOrder(invalidOrder);

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Trading pair is required');
        expect(validation.errors).toContain('Order amount must be greater than 0');
      });

      it('should reject order with invalid side', async () => {
        const invalidOrder = {
          ...validOrder,
          side: 'invalid' as any
        };

        const validation = await okxService.validateOrder(invalidOrder);

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Order side must be "buy" or "sell"');
      });

      it('should reject limit order without price', async () => {
        const invalidOrder = {
          ...validOrder,
          type: 'limit' as const,
          price: undefined
        };

        const validation = await okxService.validateOrder(invalidOrder);

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Limit orders require a valid price');
      });

      it('should reject order with invalid amount precision', async () => {
        const invalidOrder = {
          ...validOrder,
          amount: '1.' + '0'.repeat(25) // Too many decimal places
        };

        const validation = await okxService.validateOrder(invalidOrder);

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Invalid amount precision');
      });

      it('should reject order for unsupported network', async () => {
        const invalidOrder = {
          ...validOrder,
          network: 'ethereum' as const // Not enabled
        };

        const validation = await okxService.validateOrder(invalidOrder);

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Network ethereum is not supported');
      });

      it('should accept market order without price', async () => {
        const marketOrder = {
          ...validOrder,
          type: 'market' as const,
          price: undefined
        };

        const validation = await okxService.validateOrder(marketOrder);

        expect(validation.isValid).toBe(true);
      });
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      await okxService.initialize(validConfig);
    });

    it('should allow requests within rate limits', async () => {
      // Make several requests (should be within limits)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(okxService.getTokenPrice('ETH', 'linea'));
      }

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle rate limit errors gracefully', async () => {
      // This is difficult to test without mocking internal rate limiter
      // In a real scenario, you would mock the rate limiter or use longer test timeouts
      const price = await okxService.getTokenPrice('ETH', 'linea');
      expect(typeof price).toBe('number');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await okxService.initialize(validConfig);
    });

    it('should log errors appropriately', async () => {
      // Test with invalid order that will cause validation error
      const invalidOrder = { ...validOrder, pair: '' };

      await expect(okxService.placeOrder(invalidOrder))
        .rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to place order', expect.any(Object));
    });

    it('should sanitize sensitive data in logs', async () => {
      const invalidOrder = { ...validOrder, pair: '' };

      await expect(okxService.placeOrder(invalidOrder))
        .rejects.toThrow();

      // Check that wallet address is not logged
      const logCalls = mockLogger.error.mock.calls;
      const errorLog = logCalls.find(call => call[0] === 'Failed to place order');
      
      expect(errorLog).toBeDefined();
      expect(JSON.stringify(errorLog[1])).not.toContain(validOrder.walletAddress);
    });
  });
});