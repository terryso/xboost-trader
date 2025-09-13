import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { InputValidator } from './utils/InputValidator.js';
import { CLIErrorHandler, ErrorCode } from './utils/ErrorHandler.js';

export interface WalletConfig {
  address: string;
  networks: string[];
  encrypted_key_file: string;
}

export interface NetworkConfig {
  rpc_url: string;
  gas_price_strategy: 'slow' | 'standard' | 'fast';
}

export interface StrategyConfig {
  id: string;
  pair: string;
  network: string;
  grid_type: 'arithmetic' | 'geometric';
}

export interface AppConfig {
  wallets?: WalletConfig[];
  networks?: Record<string, NetworkConfig>;
  strategies?: StrategyConfig[];
}

export class ConfigManager {
  private static readonly DEFAULT_CONFIG_PATHS = [
    './config.yaml',
    './config.yml',
    '~/.xboost/config.yaml',
    '~/.config/xboost/config.yaml',
  ];

  private static readonly CONFIG_TEMPLATE = `# XBoost Trader Configuration File
# https://docs.xboost.io/configuration

# Wallet Configuration
wallets:
  # - address: "0x1234567890123456789012345678901234567890"
  #   networks: ["linea", "bnb"]
  #   encrypted_key_file: ".keys/wallet1.enc"

# Network Configuration
networks:
  linea:
    rpc_url: "https://rpc.linea.build"
    gas_price_strategy: "fast"
  bnb:
    rpc_url: "https://bsc-dataseed.binance.org"
    gas_price_strategy: "standard"
  ethereum:
    rpc_url: "https://eth.llamarpc.com"
    gas_price_strategy: "fast"
  arbitrum:
    rpc_url: "https://arb1.arbitrum.io/rpc"
    gas_price_strategy: "fast"

# Strategy Configuration (auto-managed)
strategies: []
`;

  private config: AppConfig | null = null;
  private configPath: string | null = null;

  constructor(private readonly customConfigPath?: string) {}

  async loadConfig(): Promise<AppConfig> {
    try {
      const configPath = await this.findConfigFile();
      this.configPath = configPath;

      const configContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = this.parseConfig(configContent);

      this.config = InputValidator.validateConfigFile(parsedConfig);
      return this.config;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw CLIErrorHandler.configError('Configuration file not found', [
          'Run "xboost init" to create a configuration file',
          'Or specify config path with --config option',
          `Searched paths: ${this.getSearchPaths().join(', ')}`,
        ]);
      }

      if (error instanceof Error) {
        throw CLIErrorHandler.configError(`Failed to load configuration: ${error.message}`, [
          'Check if configuration file is valid YAML',
          'Verify file permissions',
          'Run "xboost config validate" to check syntax',
        ]);
      }
      throw error;
    }
  }

  async createConfig(configPath?: string): Promise<string> {
    const targetPath = configPath || './config.yaml';

    try {
      // Check if file already exists
      try {
        await fs.access(targetPath);
        throw CLIErrorHandler.configError(`Configuration file already exists: ${targetPath}`, [
          'Use --force to overwrite existing config',
          'Or specify a different path with --config',
        ]);
      } catch (error) {
        if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) {
          throw error;
        }
        // File doesn't exist, which is what we want
      }

      // Ensure directory exists
      const configDir = path.dirname(targetPath);
      await fs.mkdir(configDir, { recursive: true });

      // Write template
      await fs.writeFile(targetPath, ConfigManager.CONFIG_TEMPLATE, 'utf-8');

      this.configPath = targetPath;
      return targetPath;
    } catch (error) {
      if (error instanceof Error) {
        throw CLIErrorHandler.fileError(`Failed to create configuration file: ${error.message}`, [
          'Check directory permissions',
          'Ensure parent directory exists',
          'Try a different path',
        ]);
      }
      throw error;
    }
  }

  async saveConfig(config?: AppConfig): Promise<void> {
    const configToSave = config || this.config;

    if (!configToSave) {
      throw CLIErrorHandler.configError('No configuration to save', [
        'Load or create a configuration first',
      ]);
    }

    if (!this.configPath) {
      throw CLIErrorHandler.configError('No configuration path set', [
        'Load an existing config or create a new one first',
      ]);
    }

    try {
      const yamlContent = yaml.dump(configToSave, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"',
        forceQuotes: false,
      });

      await fs.writeFile(this.configPath, yamlContent, 'utf-8');
    } catch (error) {
      if (error instanceof Error) {
        throw CLIErrorHandler.fileError(`Failed to save configuration: ${error.message}`, [
          'Check file permissions',
          'Ensure disk space is available',
          'Verify configuration path is valid',
        ]);
      }
      throw error;
    }
  }

  async addWallet(wallet: WalletConfig): Promise<void> {
    await this.ensureConfigLoaded();

    if (!this.config!.wallets) {
      this.config!.wallets = [];
    }

    // Check for duplicate address
    const existingWallet = this.config!.wallets.find(w => w.address === wallet.address);
    if (existingWallet) {
      throw CLIErrorHandler.configError(`Wallet address already exists: ${wallet.address}`, [
        'Use "xboost config update-wallet" to modify existing wallet',
        'Remove existing wallet first with "xboost config remove-wallet"',
      ]);
    }

    this.config!.wallets.push(wallet);
    await this.saveConfig();
  }

  async removeWallet(address: string): Promise<void> {
    await this.ensureConfigLoaded();

    if (!this.config!.wallets) {
      throw CLIErrorHandler.configError('No wallets configured', [
        'Add a wallet first with "xboost config add-wallet"',
      ]);
    }

    const walletIndex = this.config!.wallets.findIndex(w => w.address === address);
    if (walletIndex === -1) {
      throw CLIErrorHandler.configError(`Wallet not found: ${address}`, [
        'List wallets with "xboost config list-wallets"',
      ]);
    }

    this.config!.wallets.splice(walletIndex, 1);
    await this.saveConfig();
  }

  async setNetwork(network: string): Promise<void> {
    await this.ensureConfigLoaded();

    if (!this.config!.networks) {
      this.config!.networks = {};
    }

    // Add default network config if not exists
    if (!this.config!.networks[network]) {
      const defaultConfigs: Record<string, NetworkConfig> = {
        linea: {
          rpc_url: 'https://rpc.linea.build',
          gas_price_strategy: 'fast',
        },
        bnb: {
          rpc_url: 'https://bsc-dataseed.binance.org',
          gas_price_strategy: 'standard',
        },
        ethereum: {
          rpc_url: 'https://eth.llamarpc.com',
          gas_price_strategy: 'fast',
        },
        arbitrum: {
          rpc_url: 'https://arb1.arbitrum.io/rpc',
          gas_price_strategy: 'fast',
        },
      };

      if (defaultConfigs[network]) {
        this.config!.networks[network] = defaultConfigs[network];
        await this.saveConfig();
      } else {
        throw CLIErrorHandler.configError(`Unsupported network: ${network}`, [
          `Supported networks: ${Object.keys(defaultConfigs).join(', ')}`,
          'Add custom network configuration manually',
        ]);
      }
    }
  }

  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await this.ensureConfigLoaded();
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { valid: false, errors: [errorMessage] };
    }
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  getConfigPath(): string | null {
    return this.configPath;
  }

  private async findConfigFile(): Promise<string> {
    const searchPaths = this.getSearchPaths();

    for (const configPath of searchPaths) {
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
        // File doesn't exist, try next path
      }
    }

    throw new Error(`Configuration file not found in any of: ${searchPaths.join(', ')}`);
  }

  private getSearchPaths(): string[] {
    if (this.customConfigPath) {
      return [this.customConfigPath];
    }

    return ConfigManager.DEFAULT_CONFIG_PATHS.map(p =>
      p.startsWith('~') ? p.replace('~', process.env.HOME || '') : p
    );
  }

  private parseConfig(content: string): unknown {
    try {
      return yaml.load(content);
    } catch (error) {
      if (error instanceof Error) {
        throw CLIErrorHandler.configError(`Invalid YAML syntax: ${error.message}`, [
          'Check YAML syntax with online validator',
          'Verify indentation uses spaces, not tabs',
          'Ensure proper quoting of string values',
        ]);
      }
      throw error;
    }
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }
  }

  // Merge configurations from multiple sources
  static mergeConfigs(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    return {
      wallets: override.wallets || base.wallets,
      networks: { ...base.networks, ...override.networks },
      strategies: override.strategies || base.strategies,
    };
  }

  // Environment variable overrides
  static getEnvironmentOverrides(): Partial<AppConfig> {
    const overrides: Partial<AppConfig> = {};

    // Override network configurations from environment
    const networks: Record<string, NetworkConfig> = {};

    if (process.env.LINEA_RPC_URL) {
      networks.linea = {
        rpc_url: process.env.LINEA_RPC_URL,
        gas_price_strategy: (process.env.LINEA_GAS_STRATEGY as any) || 'fast',
      };
    }

    if (process.env.BNB_RPC_URL) {
      networks.bnb = {
        rpc_url: process.env.BNB_RPC_URL,
        gas_price_strategy: (process.env.BNB_GAS_STRATEGY as any) || 'standard',
      };
    }

    if (Object.keys(networks).length > 0) {
      overrides.networks = networks;
    }

    return overrides;
  }
}
