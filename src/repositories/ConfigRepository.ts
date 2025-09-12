import { BaseRepository } from './BaseRepository';
import type { IAppConfig, AppConfigRow } from '../models/types/database.types';
import type { DatabaseConnection } from '../utils/DatabaseConnection';

export class ConfigRepository extends BaseRepository<IAppConfig, AppConfigRow> {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  get tableName(): string {
    return 'app_config';
  }

  mapRowToEntity(row: AppConfigRow): IAppConfig {
    return {
      key: row.key,
      value: row.value,
      description: row.description,
      updatedAt: new Date(row.updated_at),
    };
  }

  mapEntityToRow(entity: IAppConfig): Partial<AppConfigRow> {
    return {
      key: entity.key,
      value: entity.value,
      description: entity.description,
      updated_at: entity.updatedAt.toISOString(),
    };
  }

  protected getInsertFields(): string[] {
    return ['key', 'value', 'description', 'updated_at'];
  }

  protected getUpdateFields(): string[] {
    return ['value', 'description', 'updated_at'];
  }

  // Override base methods to use 'key' instead of 'id' as primary key

  async findById(key: string): Promise<IAppConfig | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE key = ?`;
      const row = await this.db.get<AppConfigRow>(sql, [key]);

      if (!row) {
        return null;
      }

      return this.mapRowToEntity(row);
    } catch (error) {
      throw new Error(`Failed to find config by key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE key = ?`;
      const result = await this.db.run(sql, [key]);

      if (result.changes === 0) {
        throw new Error(`No config found with key ${key}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete config with key ${key}: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const sql = `SELECT 1 FROM ${this.tableName} WHERE key = ? LIMIT 1`;
      const result = await this.db.get(sql, [key]);
      return result !== null;
    } catch (error) {
      throw new Error(`Failed to check existence of config key: ${error.message}`);
    }
  }

  // Override save method to handle key-based upsert
  async save(entity: IAppConfig): Promise<void> {
    try {
      await this.db.transaction(async () => {
        const existing = await this.findById(entity.key);
        if (existing) {
          await this.updateByKey(entity);
        } else {
          await this.insert(entity);
        }
      });
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  private async updateByKey(entity: IAppConfig): Promise<void> {
    try {
      const row = this.mapEntityToRow(entity);
      const fields = this.getUpdateFields();
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => row[field]);

      // Add key to the end for WHERE clause
      values.push(entity.key);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE key = ?`;
      const result = await this.db.run(sql, values);

      if (!result || result.changes === 0) {
        throw new Error(`No config found with key ${entity.key}`);
      }
    } catch (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  // Business-specific methods for configuration management

  /**
   * Get a configuration value by key
   */
  async getValue(key: string): Promise<string | null> {
    try {
      const config = await this.findById(key);
      return config?.value || null;
    } catch (error) {
      throw new Error(`Failed to get config value: ${error.message}`);
    }
  }

  /**
   * Set a configuration value
   */
  async setValue(key: string, value: string, description?: string): Promise<void> {
    try {
      const config: IAppConfig = {
        key,
        value,
        description,
        updatedAt: new Date(),
      };

      await this.save(config);
    } catch (error) {
      throw new Error(`Failed to set config value: ${error.message}`);
    }
  }

  /**
   * Get configuration value as number
   */
  async getNumberValue(key: string): Promise<number | null> {
    try {
      const value = await this.getValue(key);
      if (value === null) return null;

      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    } catch (error) {
      throw new Error(`Failed to get numeric config value: ${error.message}`);
    }
  }

  /**
   * Set configuration value as number
   */
  async setNumberValue(key: string, value: number, description?: string): Promise<void> {
    await this.setValue(key, value.toString(), description);
  }

  /**
   * Get configuration value as boolean
   */
  async getBooleanValue(key: string): Promise<boolean | null> {
    try {
      const value = await this.getValue(key);
      if (value === null) return null;

      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return true;
      } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return false;
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to get boolean config value: ${error.message}`);
    }
  }

  /**
   * Set configuration value as boolean
   */
  async setBooleanValue(key: string, value: boolean, description?: string): Promise<void> {
    await this.setValue(key, value.toString(), description);
  }

  /**
   * Get configuration value as JSON object
   */
  async getJsonValue<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getValue(key);
      if (value === null) return null;

      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        throw new Error(`Invalid JSON in config value: ${parseError.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to get JSON config value: ${error.message}`);
    }
  }

  /**
   * Set configuration value as JSON object
   */
  async setJsonValue(key: string, value: any, description?: string): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await this.setValue(key, jsonString, description);
    } catch (error) {
      throw new Error(`Failed to set JSON config value: ${error.message}`);
    }
  }

  /**
   * Get all configuration values by key prefix
   */
  async findByKeyPrefix(prefix: string): Promise<IAppConfig[]> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE key LIKE ? ORDER BY key`;
      const rows = await this.db.query<AppConfigRow>(sql, [`${prefix}%`]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to find configs by prefix: ${error.message}`);
    }
  }

  /**
   * Get configuration values as a key-value object
   */
  async getAllAsObject(): Promise<Record<string, string>> {
    try {
      const configs = await this.findAll();
      const result: Record<string, string> = {};

      configs.forEach(config => {
        result[config.key] = config.value;
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to get all configs as object: ${error.message}`);
    }
  }

  /**
   * Bulk update multiple configuration values
   */
  async bulkUpdate(
    configs: Array<{ key: string; value: string; description?: string }>
  ): Promise<void> {
    try {
      await this.db.transaction(async () => {
        for (const config of configs) {
          await this.setValue(config.key, config.value, config.description);
        }
      });
    } catch (error) {
      throw new Error(`Failed to bulk update configs: ${error.message}`);
    }
  }

  /**
   * Get application version
   */
  async getAppVersion(): Promise<string | null> {
    return this.getValue('app_version');
  }

  /**
   * Get database version
   */
  async getDatabaseVersion(): Promise<string | null> {
    return this.getValue('db_version');
  }

  /**
   * Get default slippage value
   */
  async getDefaultSlippage(): Promise<number | null> {
    return this.getNumberValue('default_slippage');
  }

  /**
   * Get maximum gas price
   */
  async getMaxGasPrice(): Promise<number | null> {
    return this.getNumberValue('max_gas_price');
  }

  /**
   * Get price update interval
   */
  async getPriceUpdateInterval(): Promise<number | null> {
    return this.getNumberValue('price_update_interval');
  }

  /**
   * Get log level
   */
  async getLogLevel(): Promise<string | null> {
    return this.getValue('log_level');
  }

  /**
   * Check if backup is enabled
   */
  async isBackupEnabled(): Promise<boolean> {
    const enabled = await this.getBooleanValue('backup_enabled');
    return enabled || false;
  }

  /**
   * Delete configurations by key prefix (bulk delete)
   */
  async deleteByKeyPrefix(prefix: string): Promise<number> {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE key LIKE ?`;
      const result = await this.db.run(sql, [`${prefix}%`]);
      return result.changes || 0;
    } catch (error) {
      throw new Error(`Failed to delete configs by prefix: ${error.message}`);
    }
  }
}
