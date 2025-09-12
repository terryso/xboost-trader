import { DatabaseConnection } from '../utils/DatabaseConnection';
import sqlite3 from 'sqlite3';

export abstract class BaseRepository<TEntity, TRow = any> {
  protected db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  // Abstract methods that must be implemented by concrete repositories
  abstract get tableName(): string;
  abstract mapRowToEntity(row: TRow): TEntity;
  abstract mapEntityToRow(entity: TEntity): Partial<TRow>;
  protected abstract getInsertFields(): string[];
  protected abstract getUpdateFields(): string[];

  // Common CRUD operations
  async findById(id: string): Promise<TEntity | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const row = await this.db.get<TRow>(sql, [id]);
      
      if (!row) {
        return null;
      }

      return this.mapRowToEntity(row);
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by ID ${id}: ${error.message}`);
    }
  }

  async findAll(limit?: number, offset?: number): Promise<TEntity[]> {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);

        if (offset) {
          sql += ' OFFSET ?';
          params.push(offset);
        }
      }

      const rows = await this.db.query<TRow>(sql, params);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to find all ${this.tableName}: ${error.message}`);
    }
  }

  async save(entity: TEntity): Promise<void> {
    try {
      await this.db.transaction(async () => {
        // Check if entity exists (assuming 'id' field exists)
        const entityWithId = entity as any;
        if (entityWithId.id) {
          const existing = await this.findById(entityWithId.id);
          if (existing) {
            await this.update(entity);
          } else {
            await this.insert(entity);
          }
        } else {
          await this.insert(entity);
        }
      });
    } catch (error) {
      throw new Error(`Failed to save ${this.tableName}: ${error.message}`);
    }
  }

  protected async insert(entity: TEntity): Promise<void> {
    try {
      const row = this.mapEntityToRow(entity);
      const allFields = this.getInsertFields();
      
      // Filter out fields that are undefined/null to let database handle defaults
      const definedFields = allFields.filter(field => row[field] !== undefined && row[field] !== null);
      const values = definedFields.map(field => row[field]);
      const placeholders = definedFields.map(() => '?').join(', ');

      const sql = `INSERT INTO ${this.tableName} (${definedFields.join(', ')}) VALUES (${placeholders})`;
      await this.db.run(sql, values);
    } catch (error) {
      throw new Error(`Failed to insert into ${this.tableName}: ${error.message}`);
    }
  }

  protected async update(entity: TEntity): Promise<void> {
    try {
      const row = this.mapEntityToRow(entity);
      const fields = this.getUpdateFields();
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => row[field]);
      
      // Add ID to the end for WHERE clause
      const entityWithId = entity as any;
      values.push(entityWithId.id);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
      const result = await this.db.run(sql, values);

      if (!result || result.changes === 0) {
        throw new Error(`No ${this.tableName} found with the given ID`);
      }
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const result = await this.db.run(sql, [id]);

      if (!result || result.changes === 0) {
        throw new Error(`No ${this.tableName} found with ID ${id}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName} with ID ${id}: ${error.message}`);
    }
  }

  async count(): Promise<number> {
    try {
      const sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const result = await this.db.get<{ count: number }>(sql);
      return result?.count ?? 0;
    } catch (error) {
      throw new Error(`Failed to count ${this.tableName}: ${error.message}`);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
      const result = await this.db.get(sql, [id]);
      return result !== null;
    } catch (error) {
      throw new Error(`Failed to check existence in ${this.tableName}: ${error.message}`);
    }
  }

  // Utility method for custom queries
  protected async findByCondition(
    condition: string, 
    params: any[], 
    limit?: number
  ): Promise<TEntity[]> {
    try {
      let sql = `SELECT * FROM ${this.tableName} WHERE ${condition}`;
      
      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const rows = await this.db.query<TRow>(sql, params);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by condition: ${error.message}`);
    }
  }

  // Utility method for single result by condition
  protected async findOneByCondition(condition: string, params: any[]): Promise<TEntity | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${condition} LIMIT 1`;
      const row = await this.db.get<TRow>(sql, params);
      
      if (!row) {
        return null;
      }

      return this.mapRowToEntity(row);
    } catch (error) {
      throw new Error(`Failed to find one ${this.tableName} by condition: ${error.message}`);
    }
  }

  // Transaction support for complex operations
  async executeInTransaction<T>(callback: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    return await this.db.transaction(callback);
  }

  // Helper method to parse SQLite dates
  protected parseDate(dateString: string | null | undefined): Date | undefined {
    if (!dateString) return undefined;
    return new Date(dateString);
  }

  // Helper method to format dates for SQLite
  protected formatDate(date: Date | undefined): string | undefined {
    if (!date) return undefined;
    return date.toISOString();
  }

  // Helper method to parse JSON fields
  protected parseJson<T>(jsonString: string | null | undefined): T | undefined {
    if (!jsonString) return undefined;
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  // Helper method to stringify JSON fields
  protected stringifyJson(obj: any): string | undefined {
    if (!obj) return undefined;
    try {
      return JSON.stringify(obj);
    } catch (error) {
      throw new Error(`Failed to stringify JSON: ${error.message}`);
    }
  }
}