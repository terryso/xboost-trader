
import { IConfig } from '../models/types/database.types';
import { ConfigRepository } from '../repositories/ConfigRepository';
import { CryptoUtils } from '../utils/CryptoUtils';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';

export interface IConfigManager {
  loadConfig(filePath: string): Promise<void>;
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): Promise<void>;
  getSecret(key: string, password: string): Promise<string | undefined>;
  setSecret(key: string, value: string, password: string): Promise<void>;
}

export class ConfigManager implements IConfigManager {
  private config: Record<string, any> = {};
  private secureConfig: Record<string, any> = {};
  private secureConfigPath: string = './data/secure.conf.json';
  private configRepository: ConfigRepository;

  constructor(db: any) {
    this.configRepository = new ConfigRepository(db);
  }

  async loadConfig(filePath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      this.config = yaml.load(fileContent) as Record<string, any>;
    } catch (error) {
      console.warn(`Warning: Could not load config file from ${filePath}. Using default values.`);
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    return this.config[key] || defaultValue;
  }

  async set(key: string, value: any): Promise<void> {
    this.config[key] = value;
    // Note: This only updates the in-memory config. A save method would be needed to persist.
  }

  private async loadSecureConfig(password: string): Promise<void> {
    try {
      const encryptedContent = await fs.readFile(this.secureConfigPath, 'utf8');
      const encryptedData = JSON.parse(encryptedContent);
      const decryptedContent = CryptoUtils.decryptPrivateKey(encryptedData, password);
      this.secureConfig = JSON.parse(decryptedContent.toString('utf8'));
      decryptedContent.fill(0);
    } catch (error) {
      // If file doesn't exist or password is wrong, start with an empty config
      this.secureConfig = {};
    }
  }

  private async saveSecureConfig(password: string): Promise<void> {
    const content = JSON.stringify(this.secureConfig);
    const encryptedData = CryptoUtils.encryptPrivateKey(content, password);
    await fs.writeFile(this.secureConfigPath, JSON.stringify(encryptedData, null, 2), { mode: 0o600 });
  }

  async getSecret(key: string, password: string): Promise<string | undefined> {
    await this.loadSecureConfig(password);
    return this.secureConfig[key];
  }

  async setSecret(key: string, value: string, password: string): Promise<void> {
    await this.loadSecureConfig(password);
    this.secureConfig[key] = value;
    await this.saveSecureConfig(password);
  }
}
