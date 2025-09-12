import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import type { DatabaseConfig } from '../config/database.config';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseConnection {
  private db: sqlite3.Database | null = null;
  private readonly config: DatabaseConfig;
  private isInitialized = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const dbPath = this.config.inMemory ? ':memory:' : this.config.path;

      this.db = new sqlite3.Database(dbPath, err => {
        if (err) {
          reject(new Error(`Failed to connect to database: ${err.message}`));
          return;
        }

        this.configureDatabase()
          .then(() => {
            this.isInitialized = true;
            resolve();
          })
          .catch(reject);
      });

      // Set busy timeout
      this.db.configure('busyTimeout', this.config.busyTimeout);
    });
  }

  private async configureDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const runAsync = promisify(this.db.run.bind(this.db));

    // Enable foreign keys
    if (this.config.enableForeignKeys) {
      await runAsync('PRAGMA foreign_keys = ON');
    }

    // Enable WAL mode for better concurrent access
    if (this.config.enableWAL) {
      await runAsync('PRAGMA journal_mode = WAL');
    }

    // Additional optimizations
    await runAsync('PRAGMA synchronous = NORMAL');
    await runAsync('PRAGMA temp_store = MEMORY');
    await runAsync('PRAGMA mmap_size = 268435456'); // 256MB
  }

  async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const schemaPath = join(__dirname, '../../database/schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');

      // Use exec for bulk SQL execution instead of individual statements
      const execAsync = promisify(this.db.exec.bind(this.db));

      await execAsync(schemaSql);
    } catch (error) {
      throw new Error(`Failed to initialize database schema: ${error.message}`);
    }
  }

  getDatabase(): sqlite3.Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const allAsync = promisify(this.db.all.bind(this.db));

    try {
      const rows = await allAsync(sql, params);
      return rows as T[];
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const getAsync = promisify(this.db.get.bind(this.db));

    try {
      const row = await getAsync(sql, params);
      return row as T | null;
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const runAsync = promisify(this.db.run.bind(this.db));

    try {
      return await runAsync(sql, params);
    } catch (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  async transaction<T>(callback: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const runAsync = promisify(this.db.run.bind(this.db));

    try {
      await runAsync('BEGIN TRANSACTION');
      const result = await callback(this.db);
      await runAsync('COMMIT');
      return result;
    } catch (error) {
      await runAsync('ROLLBACK');
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.db!.close(err => {
        if (err) {
          reject(new Error(`Failed to close database: ${err.message}`));
        } else {
          this.db = null;
          this.isInitialized = false;
          resolve();
        }
      });
    });
  }
}
