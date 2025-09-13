import { ConfigManager } from '../services/ConfigManager';

/**
 * Controller for handling configuration-related operations.
 */
export class ConfigController {
  constructor(private configManager: ConfigManager) {}

  /**
   * Sets a secret value in the secure configuration.
   * @param key The secret key.
   * @param value The secret value.
   * @param password The master password for encryption.
   */
  public async setSecret(key: string, value: string, password: string): Promise<void> {
    await this.configManager.setSecret(key, value, password);
    console.log(`Secret '${key}' has been set.`);
  }

  /**
   * Gets a secret value from the secure configuration.
   * @param key The secret key.
   * @param password The master password for decryption.
   */
  public async getSecret(key: string, password: string): Promise<void> {
    const value = await this.configManager.getSecret(key, password);
    if (value) {
      console.log(`Secret '${key}': ${value}`);
    } else {
      console.log(`Secret '${key}' not found.`);
    }
  }
}
