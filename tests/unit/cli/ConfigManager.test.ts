import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { ConfigManager, AppConfig } from '../../../src/cli/ConfigManager.js';
import { CLIError, ErrorCode } from '../../../src/cli/utils/ErrorHandler.js';

// Mock fs module
vi.mock('fs/promises');

const mockFs = vi.mocked(fs);

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadConfig', () => {
    const validConfig = `
wallets:
  - address: "0x1234567890123456789012345678901234567890"
    networks: ["linea"]
    encrypted_key_file: "wallet.enc"
networks:
  linea:
    rpc_url: "https://rpc.linea.build"
    gas_price_strategy: "fast"
`;

    it('should load valid configuration', async () => {
      mockFs.readFile.mockResolvedValue(validConfig);
      mockFs.access.mockResolvedValue(undefined);

      const config = await configManager.loadConfig();

      expect(config).toBeDefined();
      expect(config.wallets).toHaveLength(1);
      expect(config.wallets![0].address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should throw CLIError when config file not found', async () => {
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);

      await expect(configManager.loadConfig()).rejects.toThrow(CLIError);
    });

    it('should throw CLIError for invalid YAML', async () => {
      mockFs.readFile.mockResolvedValue('invalid: yaml: content: [');
      mockFs.access.mockResolvedValue(undefined);

      await expect(configManager.loadConfig()).rejects.toThrow(CLIError);
    });
  });

  describe('createConfig', () => {
    it('should create config file with template', async () => {
      // Mock file doesn't exist (access throws)
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const configPath = await configManager.createConfig('./test-config.yaml');

      expect(configPath).toBe('./test-config.yaml');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './test-config.yaml',
        expect.stringContaining('# XBoost Trader Configuration File'),
        'utf-8'
      );
    });

    it('should throw CLIError when file already exists', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists

      await expect(configManager.createConfig('./existing-config.yaml')).rejects.toThrow(CLIError);
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to file', async () => {
      const config: AppConfig = {
        wallets: [{
          address: '0x1234567890123456789012345678901234567890',
          networks: ['linea'],
          encrypted_key_file: 'wallet.enc'
        }]
      };

      // Setup config manager with a config path
      configManager['configPath'] = './test-config.yaml';
      configManager['config'] = config;
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.saveConfig();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './test-config.yaml',
        expect.stringContaining('wallets:'),
        'utf-8'
      );
    });

    it('should throw CLIError when no config path set', async () => {
      const config: AppConfig = { wallets: [] };

      await expect(configManager.saveConfig(config)).rejects.toThrow(CLIError);
    });
  });

  describe('addWallet', () => {
    beforeEach(async () => {
      // Setup loaded config
      configManager['config'] = { wallets: [] };
      configManager['configPath'] = './test-config.yaml';
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should add new wallet to config', async () => {
      const wallet = {
        address: '0x1234567890123456789012345678901234567890',
        networks: ['linea'],
        encrypted_key_file: 'wallet.enc'
      };

      await configManager.addWallet(wallet);

      const config = configManager.getConfig();
      expect(config!.wallets).toHaveLength(1);
      expect(config!.wallets![0]).toEqual(wallet);
    });

    it('should throw CLIError for duplicate wallet address', async () => {
      const wallet = {
        address: '0x1234567890123456789012345678901234567890',
        networks: ['linea'],
        encrypted_key_file: 'wallet.enc'
      };

      configManager['config'] = { wallets: [wallet] };

      await expect(configManager.addWallet(wallet)).rejects.toThrow(CLIError);
    });
  });

  describe('removeWallet', () => {
    beforeEach(async () => {
      const wallet = {
        address: '0x1234567890123456789012345678901234567890',
        networks: ['linea'],
        encrypted_key_file: 'wallet.enc'
      };
      configManager['config'] = { wallets: [wallet] };
      configManager['configPath'] = './test-config.yaml';
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should remove wallet from config', async () => {
      await configManager.removeWallet('0x1234567890123456789012345678901234567890');

      const config = configManager.getConfig();
      expect(config!.wallets).toHaveLength(0);
    });

    it('should throw CLIError for non-existent wallet', async () => {
      await expect(configManager.removeWallet('0x9999999999999999999999999999999999999999')).rejects.toThrow(CLIError);
    });
  });

  describe('setNetwork', () => {
    beforeEach(async () => {
      configManager['config'] = { networks: {} };
      configManager['configPath'] = './test-config.yaml';
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should add supported network with default config', async () => {
      await configManager.setNetwork('linea');

      const config = configManager.getConfig();
      expect(config!.networks!['linea']).toBeDefined();
      expect(config!.networks!['linea'].rpc_url).toBe('https://rpc.linea.build');
    });

    it('should throw CLIError for unsupported network', async () => {
      await expect(configManager.setNetwork('unsupported')).rejects.toThrow(CLIError);
    });
  });

  describe('validateConfig', () => {
    it('should return valid true for loaded config', async () => {
      configManager['config'] = { wallets: [] };

      const result = await configManager.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid false with errors for invalid config', async () => {
      // Mock loadConfig to throw error
      const error = new Error('Invalid config') as any;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);

      const result = await configManager.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('static methods', () => {
    describe('mergeConfigs', () => {
      it('should merge configurations correctly', () => {
        const base: AppConfig = {
          wallets: [{ address: '0x123', networks: ['linea'], encrypted_key_file: 'base.enc' }],
          networks: { linea: { rpc_url: 'https://base.rpc', gas_price_strategy: 'fast' } }
        };

        const override: Partial<AppConfig> = {
          networks: { bnb: { rpc_url: 'https://bnb.rpc', gas_price_strategy: 'standard' } }
        };

        const merged = ConfigManager.mergeConfigs(base, override);

        expect(merged.wallets).toEqual(base.wallets);
        expect(merged.networks).toEqual({
          linea: { rpc_url: 'https://base.rpc', gas_price_strategy: 'fast' },
          bnb: { rpc_url: 'https://bnb.rpc', gas_price_strategy: 'standard' }
        });
      });
    });

    describe('getEnvironmentOverrides', () => {
      it('should extract network overrides from environment', () => {
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          LINEA_RPC_URL: 'https://custom.linea.rpc',
          LINEA_GAS_STRATEGY: 'standard',
          BNB_RPC_URL: 'https://custom.bnb.rpc'
        };

        const overrides = ConfigManager.getEnvironmentOverrides();

        expect(overrides.networks!.linea).toEqual({
          rpc_url: 'https://custom.linea.rpc',
          gas_price_strategy: 'standard'
        });

        expect(overrides.networks!.bnb).toEqual({
          rpc_url: 'https://custom.bnb.rpc',
          gas_price_strategy: 'standard' // default
        });

        process.env = originalEnv;
      });

      it('should return empty overrides when no env vars set', () => {
        const originalEnv = process.env;
        process.env = {};

        const overrides = ConfigManager.getEnvironmentOverrides();

        expect(Object.keys(overrides)).toHaveLength(0);

        process.env = originalEnv;
      });
    });
  });
});