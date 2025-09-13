import { z } from 'zod';

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InputValidator {
  // Network validation
  static readonly supportedNetworks = ['linea', 'bnb', 'ethereum', 'arbitrum'] as const;
  static readonly networkSchema = z.enum(InputValidator.supportedNetworks, {
    errorMap: () => ({
      message: `Network must be one of: ${InputValidator.supportedNetworks.join(', ')}`,
    }),
  });

  // Trading pair validation
  static readonly tradingPairSchema = z
    .string()
    .regex(
      /^[A-Z]{2,10}\/[A-Z]{2,10}$/,
      'Trading pair must be in format: BASE/QUOTE (e.g., ETH/USDC)'
    )
    .refine(pair => {
      const [base, quote] = pair.split('/');
      return base !== quote;
    }, 'Base and quote currencies must be different');

  // Price validation
  static readonly priceSchema = z
    .number()
    .positive('Price must be positive')
    .finite('Price must be a valid number')
    .refine(price => price > 0.000001, 'Price too small, minimum 0.000001');

  // Grid count validation
  static readonly gridCountSchema = z
    .number()
    .int('Grid count must be an integer')
    .min(3, 'Minimum 3 grids required')
    .max(200, 'Maximum 200 grids allowed');

  // Wallet address validation
  static readonly walletAddressSchema = z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address format');

  // Strategy ID validation
  static readonly strategyIdSchema = z
    .string()
    .min(1, 'Strategy ID cannot be empty')
    .max(100, 'Strategy ID too long')
    .regex(
      /^[a-zA-Z0-9\-_]+$/,
      'Strategy ID can only contain letters, numbers, hyphens, and underscores'
    );

  // Amount validation
  static readonly amountSchema = z
    .number()
    .positive('Amount must be positive')
    .finite('Amount must be a valid number');

  // File path validation
  static readonly filePathSchema = z
    .string()
    .min(1, 'File path cannot be empty')
    .refine(path => !path.includes('..'), 'File path cannot contain relative references');

  // Configuration validation schemas
  static readonly configWalletSchema = z.object({
    address: InputValidator.walletAddressSchema,
    networks: z.array(InputValidator.networkSchema).min(1, 'At least one network required'),
    encrypted_key_file: InputValidator.filePathSchema,
  });

  static readonly configNetworkSchema = z.object({
    rpc_url: z.string().url('Invalid RPC URL'),
    gas_price_strategy: z.enum(['slow', 'standard', 'fast'], {
      errorMap: () => ({ message: 'Gas price strategy must be: slow, standard, or fast' }),
    }),
  });

  static readonly configStrategySchema = z.object({
    id: InputValidator.strategyIdSchema,
    pair: InputValidator.tradingPairSchema,
    network: InputValidator.networkSchema,
    grid_type: z.enum(['arithmetic', 'geometric'], {
      errorMap: () => ({ message: 'Grid type must be: arithmetic or geometric' }),
    }),
  });

  static readonly configFileSchema = z.object({
    wallets: z.array(InputValidator.configWalletSchema).optional(),
    networks: z.record(z.string(), InputValidator.configNetworkSchema).optional(),
    strategies: z.array(InputValidator.configStrategySchema).optional(),
  });

  // Grid creation command validation
  static readonly gridCreateSchema = z
    .object({
      pair: InputValidator.tradingPairSchema,
      upper: InputValidator.priceSchema,
      lower: InputValidator.priceSchema,
      grids: InputValidator.gridCountSchema,
      amount: InputValidator.amountSchema.optional(),
    })
    .refine(data => data.upper > data.lower, {
      message: 'Upper price must be greater than lower price',
      path: ['upper'],
    });

  // Command parameter validation
  static validateNetworkParam(network: string): string {
    try {
      return InputValidator.networkSchema.parse(network);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const suggestions = InputValidator.supportedNetworks.filter(n =>
          n.toLowerCase().includes(network.toLowerCase())
        );
        const errorMessage = error.errors && error.errors.length > 0 
          ? error.errors[0].message 
          : `Network must be one of: ${InputValidator.supportedNetworks.join(', ')}`;
        throw new ValidationError(
          errorMessage,
          'network',
          suggestions.length > 0 ? [`Did you mean: ${suggestions.join(', ')}?`] : []
        );
      }
      throw error;
    }
  }

  static validateTradingPair(pair: string): string {
    try {
      return InputValidator.tradingPairSchema.parse(pair.toUpperCase());
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors && error.errors.length > 0 
          ? error.errors[0].message 
          : 'Trading pair must be in format: BASE/QUOTE (e.g., ETH/USDC)';
        throw new ValidationError(errorMessage, 'pair', [
          'Example: ETH/USDC, BTC/USDT, SOL/USDC',
        ]);
      }
      throw error;
    }
  }

  static validatePrice(price: string | number, fieldName: string): number {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;

    if (isNaN(numPrice)) {
      throw new ValidationError('Price must be a valid number', fieldName, [
        'Example: 2500.50, 0.001, 100',
      ]);
    }

    try {
      return InputValidator.priceSchema.parse(numPrice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors && error.errors.length > 0 
          ? error.errors[0].message 
          : 'Price must be positive and greater than 0.000001';
        throw new ValidationError(errorMessage, fieldName, [
          'Price must be positive and greater than 0.000001',
        ]);
      }
      throw error;
    }
  }

  static validateGridCount(count: string | number): number {
    let numCount: number;
    
    if (typeof count === 'string') {
      // Check if string contains decimal point (not an integer)
      if (count.includes('.')) {
        throw new ValidationError('Grid count must be a valid integer', 'grids', [
          'Example: 5, 10, 20, 50',
        ]);
      }
      numCount = parseInt(count);
    } else {
      numCount = count;
    }

    if (isNaN(numCount)) {
      throw new ValidationError('Grid count must be a valid integer', 'grids', [
        'Example: 5, 10, 20, 50',
      ]);
    }

    try {
      return InputValidator.gridCountSchema.parse(numCount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors && error.errors.length > 0 
          ? error.errors[0].message 
          : 'Grid count must be between 3 and 200';
        throw new ValidationError(errorMessage, 'grids', [
          'Recommended: 5-50 grids for most strategies',
        ]);
      }
      throw error;
    }
  }

  static validateWalletAddress(address: string): string {
    try {
      return InputValidator.walletAddressSchema.parse(address);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors && error.errors.length > 0 
          ? error.errors[0].message 
          : 'Invalid wallet address format';
        throw new ValidationError(errorMessage, 'address', [
          'Address should start with 0x followed by 40 hexadecimal characters',
        ]);
      }
      throw error;
    }
  }

  static validateStrategyId(id: string): string {
    try {
      return InputValidator.strategyIdSchema.parse(id);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors && error.errors.length > 0 
          ? error.errors[0].message 
          : 'Strategy ID can only contain letters, numbers, hyphens, and underscores';
        throw new ValidationError(errorMessage, 'strategy-id', [
          'Example: eth-usdc-grid-1, my_strategy_001, btc-grid',
        ]);
      }
      throw error;
    }
  }

  static validateConfigFile(configData: unknown): z.infer<typeof InputValidator.configFileSchema> {
    try {
      return InputValidator.configFileSchema.parse(configData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors && error.errors.length > 0 ? error.errors[0] : null;
        if (firstError) {
          throw new ValidationError(
            `Configuration error at ${firstError.path.join('.')}: ${firstError.message}`,
            firstError.path.join('.'),
            ['Check the configuration file format in docs/configuration.md']
          );
        } else {
          throw new ValidationError(
            'Invalid configuration file format',
            'config',
            ['Check the configuration file format in docs/configuration.md']
          );
        }
      }
      throw error;
    }
  }

  static validateGridCreateParams(
    params: unknown
  ): z.infer<typeof InputValidator.gridCreateSchema> {
    try {
      return InputValidator.gridCreateSchema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors && error.errors.length > 0 ? error.errors[0] : null;
        if (firstError) {
          throw new ValidationError(firstError.message, firstError.path.join('.'), [
            'Example: xboost grid create ETH/USDC --upper 3000 --lower 2000 --grids 10',
          ]);
        } else {
          throw new ValidationError('Invalid grid creation parameters', 'params', [
            'Example: xboost grid create ETH/USDC --upper 3000 --lower 2000 --grids 10',
          ]);
        }
      }
      throw error;
    }
  }

  // Sanitization utilities
  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>'"&]/g, '');
  }

  static sanitizeNumericInput(input: string): string {
    return input.replace(/[^0-9.-]/g, '');
  }

  static sanitizeAlphanumericInput(input: string): string {
    return input.replace(/[^a-zA-Z0-9\-_]/g, '');
  }
}
