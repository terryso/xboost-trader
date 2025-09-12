export interface IDatabaseConfig {
  path: string;
  inMemory: boolean;
  enableWAL: boolean;
  enableForeignKeys: boolean;
  maxConnections: number;
  busyTimeout: number;
}

export const databaseConfig: IDatabaseConfig = {
  path: (typeof process !== 'undefined' ? process.env.DATABASE_PATH : undefined) ?? './data/xboost-trader.db',
  inMemory: false,
  enableWAL: true,
  enableForeignKeys: true,
  maxConnections: 10,
  busyTimeout: 30000,
};

export const testDatabaseConfig: IDatabaseConfig = {
  path: ':memory:',
  inMemory: true,
  enableWAL: false,
  enableForeignKeys: true,
  maxConnections: 1,
  busyTimeout: 5000,
};
