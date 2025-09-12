import type { Logger } from './ServiceContainer';

export interface OKXConfig {
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  sandbox?: boolean;
  rpcEndpoints?: { [network: string]: string };
  defaultSlippage?: number;
  maxGasPrice?: number;
}

export interface OrderRequest {
  pair: string;
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
  type: 'market' | 'limit';
  network: 'linea' | 'bnb' | 'ethereum' | 'solana';
  walletAddress: string;
}

export interface OrderResult {
  orderId: string;
  txHash?: string;
  status: 'pending' | 'filled' | 'failed' | 'cancelled';
  executedAmount?: string;
  executedPrice?: string;
  gasUsed?: number;
  gasPrice?: number;
  fee?: string;
  timestamp: Date;
}

export interface Balance {
  network: string;
  tokenBalances: Array<{
    symbol: string;
    balance: string;
    valueUsd: string;
  }>;
  totalValueUsd: string;
  lastUpdated: Date;
}

export interface OrderStatus {
  orderId: string;
  status: 'pending' | 'filled' | 'failed' | 'cancelled' | 'partially_filled';
  originalAmount: string;
  executedAmount: string;
  remainingAmount: string;
  averagePrice?: string;
  txHash?: string;
  gasUsed?: number;
  fee?: string;
  timestamp: Date;
  lastUpdated: Date;
}

export interface NetworkInfo {
  network: string;
  chainId: number;
  rpcEndpoint: string;
  blockExplorer: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  isEnabled: boolean;
}

export interface IOKXService {
  initialize(config: OKXConfig): Promise<void>;
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getBalance(network: string, walletAddress: string): Promise<Balance>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;
  getSupportedNetworks(): NetworkInfo[];
  getTokenPrice(tokenSymbol: string, network: string): Promise<number>;
  estimateGas(
    order: OrderRequest
  ): Promise<{ gasLimit: number; gasPrice: number; estimatedFee: string }>;
  validateOrder(order: OrderRequest): Promise<{ isValid: boolean; errors: string[] }>;
}

export class OKXService implements IOKXService {
  private config: OKXConfig = {};
  private readonly logger: Logger;
  private isInitialized: boolean = false;
  private readonly rateLimiter: Map<string, number> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_MINUTE = 100;

  // Network configurations
  private readonly SUPPORTED_NETWORKS: NetworkInfo[] = [
    {
      network: 'linea',
      chainId: 59144,
      rpcEndpoint: 'https://rpc.linea.build',
      blockExplorer: 'https://lineascan.build',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      isEnabled: true,
    },
    {
      network: 'bnb',
      chainId: 56,
      rpcEndpoint: 'https://bsc-dataseed1.binance.org',
      blockExplorer: 'https://bscscan.com',
      nativeCurrency: { symbol: 'BNB', decimals: 18 },
      isEnabled: true,
    },
    {
      network: 'ethereum',
      chainId: 1,
      rpcEndpoint: 'https://mainnet.infura.io/v3',
      blockExplorer: 'https://etherscan.io',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      isEnabled: false, // Future support
    },
    {
      network: 'solana',
      chainId: 0, // Solana doesn't use EVM chain IDs
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      blockExplorer: 'https://solscan.io',
      nativeCurrency: { symbol: 'SOL', decimals: 9 },
      isEnabled: false, // Future support
    },
  ];

  constructor(logger?: Logger) {
    this.logger = logger || console;
  }

  async initialize(config: OKXConfig): Promise<void> {
    const requestId = `initialize_okx_${Date.now()}`;

    try {
      this.logger.info('Initializing OKX service', { requestId, sandbox: config.sandbox });

      // Validate configuration
      await this.validateConfig(config);

      // Store configuration
      this.config = {
        defaultSlippage: 0.005, // 0.5% default
        maxGasPrice: 50000000000, // 50 Gwei default
        ...config,
      };

      // Initialize OKX SDK (mock implementation)
      await this.initializeSDK();

      // Test connection
      await this.testConnection();

      this.isInitialized = true;

      this.logger.info('OKX service initialized successfully', {
        requestId,
        supportedNetworks: this.getSupportedNetworks().filter(n => n.isEnabled).length,
      });
    } catch (error) {
      this.logger.error('Failed to initialize OKX service', {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const requestId = `place_order_${Date.now()}`;

    try {
      this.logger.info('Placing order', {
        requestId,
        pair: order.pair,
        side: order.side,
        amount: order.amount,
        type: order.type,
        network: order.network,
      });

      this.ensureInitialized();
      await this.checkRateLimit('placeOrder');

      // Validate order
      const validation = await this.validateOrder(order);
      if (!validation.isValid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Check network support
      const networkInfo = this.getNetworkInfo(order.network);
      if (!networkInfo.isEnabled) {
        throw new Error(`Network ${order.network} is not currently supported`);
      }

      // Estimate gas and fees
      const gasEstimate = await this.estimateGas(order);

      // Execute order through OKX SDK (mock implementation)
      const orderResult = await this.executeOrder(order, gasEstimate);

      this.logger.info('Order placed successfully', {
        requestId,
        orderId: orderResult.orderId,
        txHash: orderResult.txHash,
        status: orderResult.status,
      });

      return orderResult;
    } catch (error) {
      this.logger.error('Failed to place order', {
        requestId,
        order: this.sanitizeOrder(order),
        error: error.message,
      });
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    const requestId = `cancel_order_${Date.now()}`;

    try {
      this.logger.info('Cancelling order', { requestId, orderId });

      this.ensureInitialized();
      await this.checkRateLimit('cancelOrder');

      // Cancel order through OKX SDK (mock implementation)
      await this.executeCancelOrder(orderId);

      this.logger.info('Order cancelled successfully', { requestId, orderId });
    } catch (error) {
      this.logger.error('Failed to cancel order', {
        requestId,
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  async getBalance(network: string, walletAddress: string): Promise<Balance> {
    const requestId = `get_balance_${Date.now()}`;

    try {
      this.logger.debug('Getting wallet balance', { requestId, network, walletAddress });

      this.ensureInitialized();
      await this.checkRateLimit('getBalance');

      // Validate network
      const networkInfo = this.getNetworkInfo(network);
      if (!networkInfo.isEnabled) {
        throw new Error(`Network ${network} is not currently supported`);
      }

      // Fetch balance from blockchain (mock implementation)
      const balance = await this.fetchWalletBalance(network, walletAddress);

      this.logger.debug('Balance retrieved successfully', {
        requestId,
        network,
        walletAddress,
        totalValueUsd: balance.totalValueUsd,
      });

      return balance;
    } catch (error) {
      this.logger.error('Failed to get balance', {
        requestId,
        network,
        walletAddress,
        error: error.message,
      });
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    const requestId = `get_order_status_${Date.now()}`;

    try {
      this.logger.debug('Getting order status', { requestId, orderId });

      this.ensureInitialized();
      await this.checkRateLimit('getOrderStatus');

      // Fetch order status from OKX (mock implementation)
      const orderStatus = await this.fetchOrderStatus(orderId);

      this.logger.debug('Order status retrieved', {
        requestId,
        orderId,
        status: orderStatus.status,
      });

      return orderStatus;
    } catch (error) {
      this.logger.error('Failed to get order status', {
        requestId,
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  getSupportedNetworks(): NetworkInfo[] {
    return [...this.SUPPORTED_NETWORKS];
  }

  async getTokenPrice(tokenSymbol: string, network: string): Promise<number> {
    const requestId = `get_token_price_${Date.now()}`;

    try {
      this.logger.debug('Getting token price', { requestId, tokenSymbol, network });

      this.ensureInitialized();
      await this.checkRateLimit('getTokenPrice');

      // Fetch price from OKX API (mock implementation)
      const price = await this.fetchTokenPrice(tokenSymbol, network);

      this.logger.debug('Token price retrieved', {
        requestId,
        tokenSymbol,
        network,
        price,
      });

      return price;
    } catch (error) {
      this.logger.error('Failed to get token price', {
        requestId,
        tokenSymbol,
        network,
        error: error.message,
      });
      throw error;
    }
  }

  async estimateGas(
    order: OrderRequest
  ): Promise<{ gasLimit: number; gasPrice: number; estimatedFee: string }> {
    const requestId = `estimate_gas_${Date.now()}`;

    try {
      this.logger.debug('Estimating gas for order', {
        requestId,
        pair: order.pair,
        network: order.network,
      });

      this.ensureInitialized();

      // Get network info
      const networkInfo = this.getNetworkInfo(order.network);

      // Estimate gas (mock implementation - would use actual RPC calls)
      const gasLimit = this.getDefaultGasLimit(order.type);
      const gasPrice = await this.getCurrentGasPrice(order.network);

      // Apply max gas price limit
      const finalGasPrice = Math.min(gasPrice, this.config.maxGasPrice!);

      const estimatedFee = this.calculateGasFee(gasLimit, finalGasPrice, networkInfo);

      this.logger.debug('Gas estimation completed', {
        requestId,
        gasLimit,
        gasPrice: finalGasPrice,
        estimatedFee,
      });

      return {
        gasLimit,
        gasPrice: finalGasPrice,
        estimatedFee,
      };
    } catch (error) {
      this.logger.error('Failed to estimate gas', {
        requestId,
        order: this.sanitizeOrder(order),
        error: error.message,
      });
      throw error;
    }
  }

  async validateOrder(order: OrderRequest): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic validation
      if (!order.pair?.trim()) {
        errors.push('Trading pair is required');
      }

      if (!order.side || !['buy', 'sell'].includes(order.side)) {
        errors.push('Order side must be "buy" or "sell"');
      }

      if (!order.amount || parseFloat(order.amount) <= 0) {
        errors.push('Order amount must be greater than 0');
      }

      if (!order.type || !['market', 'limit'].includes(order.type)) {
        errors.push('Order type must be "market" or "limit"');
      }

      if (order.type === 'limit' && (!order.price || parseFloat(order.price) <= 0)) {
        errors.push('Limit orders require a valid price');
      }

      if (!order.network) {
        errors.push('Network is required');
      } else {
        const networkInfo = this.getNetworkInfo(order.network);
        if (!networkInfo.isEnabled) {
          errors.push(`Network ${order.network} is not supported`);
        }
      }

      if (!order.walletAddress?.trim()) {
        errors.push('Wallet address is required');
      }

      // Amount precision validation
      if (order.amount && !this.isValidPrecision(order.amount)) {
        errors.push('Invalid amount precision');
      }

      // Price precision validation for limit orders
      if (order.type === 'limit' && order.price && !this.isValidPrecision(order.price)) {
        errors.push('Invalid price precision');
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors,
      };
    }
  }

  private async validateConfig(config: OKXConfig): Promise<void> {
    if (!config) {
      throw new Error('Configuration is required');
    }

    // For now, we'll allow initialization without API credentials for testing
    // In production, you might want to require them
    if (config.apiKey && !config.apiSecret) {
      throw new Error('API secret is required when API key is provided');
    }

    if (config.apiKey && !config.apiPassphrase) {
      throw new Error('API passphrase is required when API key is provided');
    }
  }

  private async initializeSDK(): Promise<void> {
    // Mock SDK initialization
    // In real implementation, this would initialize the OKX DEX SDK
    this.logger.debug('OKX SDK initialized (mock)');
  }

  private async testConnection(): Promise<void> {
    // Mock connection test
    // In real implementation, this would test the connection to OKX
    this.logger.debug('OKX connection test passed (mock)');
  }

  private async checkRateLimit(operation: string): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW;

    // Clean old entries
    for (const [key, timestamp] of this.rateLimiter.entries()) {
      if (timestamp < windowStart) {
        this.rateLimiter.delete(key);
      }
    }

    // Count current requests
    const currentRequests = this.rateLimiter.size;

    if (currentRequests >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Record this request
    this.rateLimiter.set(`${operation}_${now}`, now);
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('OKX service not initialized. Call initialize() first.');
    }
  }

  private getNetworkInfo(network: string): NetworkInfo {
    const networkInfo = this.SUPPORTED_NETWORKS.find(n => n.network === network);
    if (!networkInfo) {
      throw new Error(`Unsupported network: ${network}`);
    }
    return networkInfo;
  }

  private async executeOrder(order: OrderRequest, gasEstimate: GasEstimate): Promise<OrderResult> {
    interface GasEstimate {
      gasLimit: number;
      gasPrice: number;
      estimatedFee: string;
    }
    // Mock order execution
    const orderId = `okx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const txHash = `0x${Math.random().toString(16).substr(2, 64)}`;

    return {
      orderId,
      txHash,
      status: 'pending',
      executedAmount: '0',
      gasUsed: gasEstimate.gasLimit,
      gasPrice: gasEstimate.gasPrice,
      fee: gasEstimate.estimatedFee,
      timestamp: new Date(),
    };
  }

  private async executeCancelOrder(orderId: string): Promise<void> {
    // Mock order cancellation
    this.logger.debug('Order cancelled (mock)', { orderId });
  }

  private async fetchWalletBalance(network: string, walletAddress: string): Promise<Balance> {
    // Mock balance fetching
    return {
      network,
      tokenBalances: [
        {
          symbol: 'ETH',
          balance: '1.5',
          valueUsd: '2700.00',
        },
        {
          symbol: 'USDT',
          balance: '5000.0',
          valueUsd: '5000.00',
        },
      ],
      totalValueUsd: '7700.00',
      lastUpdated: new Date(),
    };
  }

  private async fetchOrderStatus(orderId: string): Promise<OrderStatus> {
    // Mock order status fetching
    return {
      orderId,
      status: 'filled',
      originalAmount: '1.0',
      executedAmount: '1.0',
      remainingAmount: '0.0',
      averagePrice: '1800.0',
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      gasUsed: 21000,
      fee: '0.001',
      timestamp: new Date(Date.now() - 60000), // 1 minute ago
      lastUpdated: new Date(),
    };
  }

  private async fetchTokenPrice(tokenSymbol: string, network: string): Promise<number> {
    // Mock price fetching
    const mockPrices: { [key: string]: number } = {
      ETH: 1800,
      BTC: 35000,
      USDT: 1,
      USDC: 1,
      BNB: 300,
    };

    return mockPrices[tokenSymbol] || 0;
  }

  private getDefaultGasLimit(orderType: string): number {
    // Default gas limits for different order types
    const gasLimits = {
      market: 150000,
      limit: 200000,
    };

    return gasLimits[orderType] || 150000;
  }

  private async getCurrentGasPrice(network: string): Promise<number> {
    // Mock gas price fetching (in wei)
    const mockGasPrices: { [key: string]: number } = {
      linea: 2000000000, // 2 Gwei
      bnb: 5000000000, // 5 Gwei
      ethereum: 30000000000, // 30 Gwei
      solana: 5000, // Different unit for Solana
    };

    return mockGasPrices[network] || 10000000000; // 10 Gwei default
  }

  private calculateGasFee(gasLimit: number, gasPrice: number, networkInfo: NetworkInfo): string {
    const feeInWei = gasLimit * gasPrice;
    const feeInEth = feeInWei / Math.pow(10, networkInfo.nativeCurrency.decimals);
    return feeInEth.toFixed(8);
  }

  private isValidPrecision(value: string): boolean {
    // Check if the number has reasonable precision (max 18 decimal places)
    const parts = value.split('.');
    return parts.length <= 2 && (parts[1]?.length || 0) <= 18;
  }

  private sanitizeOrder(order: OrderRequest): Partial<OrderRequest> {
    return {
      pair: order.pair,
      side: order.side,
      amount: order.amount,
      price: order.price,
      type: order.type,
      network: order.network,
      // Exclude walletAddress for security
    };
  }
}
