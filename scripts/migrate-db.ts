#!/usr/bin/env ts-node

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { DatabaseConnection } from '../src/utils/DatabaseConnection';
import { databaseConfig, testDatabaseConfig } from '../src/config/database.config';

interface Migration {
  id: string;
  filename: string;
  sql: string;
  timestamp: Date;
}

interface MigrationRecord {
  id: string;
  filename: string;
  applied_at: string;
}

class DatabaseMigrator {
  private db: DatabaseConnection;
  private migrationsPath: string;
  private isTest: boolean;

  constructor(isTest: boolean = false) {
    this.isTest = isTest;
    this.db = new DatabaseConnection(isTest ? testDatabaseConfig : databaseConfig);
    this.migrationsPath = resolve(__dirname, '../database/migrations');
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
    await this.createMigrationTable();
  }

  private async createMigrationTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await this.db.run(sql);
  }

  private loadMigrations(): Migration[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(filename => {
        const filePath = join(this.migrationsPath, filename);
        const stats = statSync(filePath);
        const sql = readFileSync(filePath, 'utf8');
        
        // Extract ID from filename (e.g., 001_initial_schema.sql -> 001)
        const id = filename.split('_')[0];
        
        return {
          id,
          filename,
          sql,
          timestamp: stats.birthtime
        };
      });
    } catch (error) {
      throw new Error(`Failed to load migrations: ${error.message}`);
    }
  }

  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const sql = 'SELECT * FROM _migrations ORDER BY id';
      return await this.db.query<MigrationRecord>(sql);
    } catch (error) {
      throw new Error(`Failed to get applied migrations: ${error.message}`);
    }
  }

  async migrate(): Promise<void> {
    console.log('🚀 Starting database migration...');
    
    try {
      const migrations = this.loadMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedIds = new Set(appliedMigrations.map(m => m.id));

      const pendingMigrations = migrations.filter(m => !appliedIds.has(m.id));

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations found.');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
      pendingMigrations.forEach(m => {
        console.log(`   - ${m.filename}`);
      });

      for (const migration of pendingMigrations) {
        console.log(`\n🔄 Applying migration: ${migration.filename}...`);
        
        await this.db.transaction(async () => {
          // Execute migration SQL
          const statements = migration.sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

          for (const statement of statements) {
            await this.db.run(statement);
          }

          // Record migration as applied
          await this.db.run(
            'INSERT INTO _migrations (id, filename) VALUES (?, ?)',
            [migration.id, migration.filename]
          );
        });

        console.log(`✅ Applied migration: ${migration.filename}`);
      }

      console.log(`\n🎉 Successfully applied ${pendingMigrations.length} migration(s)!`);
    } catch (error) {
      console.error(`❌ Migration failed: ${error.message}`);
      throw error;
    }
  }

  async rollback(targetId?: string): Promise<void> {
    console.log('🔄 Starting database rollback...');
    
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (appliedMigrations.length === 0) {
        console.log('⚠️  No migrations to rollback.');
        return;
      }

      // Determine which migrations to rollback
      let migrationsToRollback: MigrationRecord[];
      
      if (targetId) {
        const targetIndex = appliedMigrations.findIndex(m => m.id === targetId);
        if (targetIndex === -1) {
          throw new Error(`Migration with ID ${targetId} not found in applied migrations`);
        }
        migrationsToRollback = appliedMigrations.slice(targetIndex);
      } else {
        // Rollback only the last migration
        migrationsToRollback = [appliedMigrations[appliedMigrations.length - 1]];
      }

      console.log(`📋 Rolling back ${migrationsToRollback.length} migration(s):`);
      migrationsToRollback.reverse().forEach(m => {
        console.log(`   - ${m.filename}`);
      });

      // For now, we'll just remove migration records (destructive rollback)
      // In a production system, you'd want to have down migrations
      for (const migration of migrationsToRollback) {
        console.log(`\n🔄 Rolling back migration: ${migration.filename}...`);
        
        await this.db.run(
          'DELETE FROM _migrations WHERE id = ?',
          [migration.id]
        );

        console.log(`✅ Rolled back migration: ${migration.filename}`);
      }

      console.log(`\n⚠️  WARNING: This was a destructive rollback. Database schema changes were not reverted.`);
      console.log(`   You may need to manually restore your database or recreate it from scratch.`);
    } catch (error) {
      console.error(`❌ Rollback failed: ${error.message}`);
      throw error;
    }
  }

  async status(): Promise<void> {
    try {
      const migrations = this.loadMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedIds = new Set(appliedMigrations.map(m => m.id));

      console.log('📊 Migration Status:');
      console.log('==================');

      if (migrations.length === 0) {
        console.log('No migration files found.');
        return;
      }

      migrations.forEach(migration => {
        const status = appliedIds.has(migration.id) ? '✅ Applied' : '⏳ Pending';
        const appliedDate = appliedIds.has(migration.id) 
          ? appliedMigrations.find(m => m.id === migration.id)?.applied_at 
          : null;
        
        console.log(`${status} - ${migration.filename}`);
        if (appliedDate) {
          console.log(`           Applied at: ${appliedDate}`);
        }
      });

      const pendingCount = migrations.filter(m => !appliedIds.has(m.id)).length;
      const appliedCount = appliedMigrations.length;

      console.log('\n📈 Summary:');
      console.log(`   Applied: ${appliedCount}`);
      console.log(`   Pending: ${pendingCount}`);
      console.log(`   Total:   ${migrations.length}`);
    } catch (error) {
      console.error(`❌ Failed to get migration status: ${error.message}`);
      throw error;
    }
  }

  async reset(): Promise<void> {
    console.log('🔄 Resetting database...');
    
    try {
      // Drop all tables except _migrations to track what we're doing
      const tables = await this.db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      await this.db.transaction(async () => {
        for (const table of tables) {
          if (table.name !== '_migrations') {
            await this.db.run(`DROP TABLE IF EXISTS ${table.name}`);
            console.log(`🗑️  Dropped table: ${table.name}`);
          }
        }

        // Clear migration records
        await this.db.run('DELETE FROM _migrations');
        console.log('🗑️  Cleared migration records');
      });

      console.log('✅ Database reset complete. Run migrate to recreate schema.');
    } catch (error) {
      console.error(`❌ Database reset failed: ${error.message}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  const isTest = process.env.NODE_ENV === 'test' || process.argv.includes('--test');

  if (isTest) {
    console.log('🧪 Running in test mode');
  }

  const migrator = new DatabaseMigrator(isTest);

  try {
    await migrator.initialize();

    switch (command) {
      case 'migrate':
      case 'up':
        await migrator.migrate();
        break;

      case 'rollback':
      case 'down':
        await migrator.rollback(arg);
        break;

      case 'status':
        await migrator.status();
        break;

      case 'reset':
        if (process.argv.includes('--force')) {
          await migrator.reset();
        } else {
          console.log('⚠️  Database reset requires --force flag for safety');
          console.log('   Usage: npm run db:reset -- --force');
          process.exit(1);
        }
        break;

      default:
        console.log('XBoost Trader Database Migrator');
        console.log('===============================');
        console.log('');
        console.log('Usage:');
        console.log('  npm run db:migrate     - Apply all pending migrations');
        console.log('  npm run db:rollback    - Rollback last migration');
        console.log('  npm run db:status      - Show migration status');
        console.log('  npm run db:reset       - Reset database (requires --force)');
        console.log('');
        console.log('Options:');
        console.log('  --test                 - Run against test database');
        console.log('  --force                - Force destructive operations');
        console.log('');
        console.log('Examples:');
        console.log('  npm run db:migrate');
        console.log('  npm run db:rollback 002');
        console.log('  npm run db:reset -- --force');
        process.exit(0);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { DatabaseMigrator };