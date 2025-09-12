-- Initial Database Schema Migration
-- Version: 001
-- Description: Create core tables for XBoost Trader

-- Core Tables
CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    supported_networks TEXT NOT NULL,
    is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grid_strategies (
    id TEXT PRIMARY KEY NOT NULL,
    wallet_address TEXT NOT NULL,
    pair TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('linea', 'bnb', 'ethereum', 'solana')),
    grid_type TEXT NOT NULL CHECK (grid_type IN ('arithmetic', 'geometric')),
    upper_price REAL NOT NULL CHECK (upper_price > 0),
    lower_price REAL NOT NULL CHECK (lower_price > 0),
    grid_count INTEGER NOT NULL CHECK (grid_count > 0 AND grid_count <= 1000),
    base_amount REAL NOT NULL CHECK (base_amount > 0),
    stop_loss REAL CHECK (stop_loss >= 0),
    max_position_ratio REAL NOT NULL DEFAULT 0.8 CHECK (max_position_ratio > 0 AND max_position_ratio <= 1),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
    total_profit REAL DEFAULT 0,
    executed_orders_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES wallets(address) ON DELETE CASCADE,
    CHECK (upper_price > lower_price)
);

CREATE TABLE IF NOT EXISTS grid_orders (
    id TEXT PRIMARY KEY NOT NULL,
    strategy_id TEXT NOT NULL,
    price REAL NOT NULL CHECK (price > 0),
    amount REAL NOT NULL CHECK (amount > 0),
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled')),
    tx_hash TEXT,
    gas_used REAL,
    gas_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    filled_at DATETIME,
    cancelled_at DATETIME,
    FOREIGN KEY (strategy_id) REFERENCES grid_strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY NOT NULL,
    strategy_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    pair TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    price REAL NOT NULL CHECK (price > 0),
    amount REAL NOT NULL CHECK (amount > 0),
    fee REAL NOT NULL DEFAULT 0,
    profit REAL DEFAULT 0,
    tx_hash TEXT NOT NULL,
    block_number INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (strategy_id) REFERENCES grid_strategies(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES grid_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    price REAL NOT NULL CHECK (price > 0),
    volume_24h REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    metadata TEXT,
    request_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);