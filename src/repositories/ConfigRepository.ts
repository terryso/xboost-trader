import { BaseRepository } from './BaseRepository';
import { IConfig } from '../models/types/database.types';

export class ConfigRepository extends BaseRepository<IConfig> {
  get tableName(): string {
    return 'app_config';
  }

  constructor(db: any) {
    super(db);
  }

  mapRowToEntity(row: any): IConfig {
    return {
      key: row.key,
      value: row.value,
      description: row.description,
    };
  }

  mapEntityToRow(entity: IConfig): any {
    return {
      key: entity.key,
      value: entity.value,
      description: entity.description,
    };
  }

  protected getInsertFields(): string[] {
    return ['key', 'value', 'description'];
  }

  protected getUpdateFields(): string[] {
    return ['value', 'description'];
  }

  async getValue(key: string): Promise<string | undefined> {
    const row = await this.db.get(`SELECT value FROM ${this.tableName} WHERE key = ?`, key);
    return row?.value;
  }

  async setValue(key: string, value: string, description?: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.db.run(
        `INSERT OR REPLACE INTO ${this.tableName} (key, value, description) VALUES (?, ?, ?)`,
        [key, value, description]
      );
    });
  }

  async setNumberValue(key: string, value: number, description?: string): Promise<void> {
    await this.setValue(key, value.toString(), description);
  }

  async setBooleanValue(key: string, value: boolean, description?: string): Promise<void> {
    await this.setValue(key, value.toString(), description);
  }

  async setJsonValue(key: string, value: any, description?: string): Promise<void> {
    await this.setValue(key, JSON.stringify(value), description);
  }

  async getNumberValue(key: string): Promise<number | null> {
    const value = await this.getValue(key);
    return value ? parseFloat(value) : null;
  }

  async getBooleanValue(key: string): Promise<boolean | null> {
    const value = await this.getValue(key);
    return value ? value === 'true' : null;
  }

  async getJsonValue<T>(key: string): Promise<T | null> {
    const value = await this.getValue(key);
    return value ? JSON.parse(value) : null;
  }

  async findByKeyPrefix(prefix: string): Promise<IConfig[]> {
    return this.db.query(`SELECT * FROM ${this.tableName} WHERE key LIKE ?`, `${prefix}%`);
  }

  // Need to override findById for a non-standard primary key 'key'
  async findById(key: string): Promise<IConfig | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE key = ?`;
      const row = await this.db.get<any>(sql, [key]);

      if (!row) {
        return null;
      }

      return this.mapRowToEntity(row);
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by ID ${key}: ${error.message}`);
    }
  }
}