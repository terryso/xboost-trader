// Database entity interfaces for XBoost Trader
// These interfaces represent the data models as they exist in the database

export interface IPriceHistory {
  id: number;
  pair: string;
  price: number;
  volume24h: number;
  timestamp: Date;
}

export interface ISystemLog {
  id: number;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  metadata?: string; // JSON string
  requestId?: string;
  timestamp: Date;
}

export interface IAppConfig {
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
}

// Database row types - raw data from SQLite

export interface IPriceHistoryRow {
  id: number;
  pair: string;
  price: number;
  volume_24h: number;
  timestamp: string;
}

export interface ISystemLogRow {
  id: number;
  level: string;
  message: string;
  metadata?: string;
  request_id?: string;
  timestamp: string;
}

export interface IAppConfigRow {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}
