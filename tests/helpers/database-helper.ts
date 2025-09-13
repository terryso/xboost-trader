import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-database.db');
const SCHEMA_PATH = path.join(__dirname, '../../database/schema.sql');

export class DatabaseTestHelper {
  private db;

  async setupTestDatabase() {
    // Ensure the data directory exists
    await fs.mkdir(path.dirname(TEST_DB_PATH), { recursive: true });

    this.db = await open({
      filename: TEST_DB_PATH,
      driver: sqlite3.Database,
    });

    await this.resetDatabase();
    return this.db;
  }

  async resetDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized. Call setupTestDatabase first.');
    }
    const schema = await fs.readFile(SCHEMA_PATH, 'utf-8');
    await this.db.exec('PRAGMA writable_schema = 1;');
    await this.db.exec('DELETE FROM sqlite_master WHERE type IN (\'table\', \'index\', \'trigger\');');
    await this.db.exec('PRAGMA writable_schema = 0;');
    await this.db.exec('VACUUM;');
    await this.db.exec(schema);
  }

  async cleanup() {
    if (this.db) {
      await this.db.close();
    }
    try {
      await fs.unlink(TEST_DB_PATH);
    } catch (error) {
      // Ignore errors if the file doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not initialized. Call setupTestDatabase first.');
    }
    return this.db;
  }
}
