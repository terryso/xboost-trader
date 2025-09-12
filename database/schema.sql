-- XBoost Trader Database Schema
-- SQLite Database Schema for Trading Strategy Management
-- Version: 1.0
-- Date: 2024-09-12

-- Enable SQLite optimizations and features
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB

-- ==========================================
-- CORE TABLES
-- ==========================================

-- Wallets table for storing encrypted wallet information
CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    supported_networks TEXT NOT NULL, -- JSON array of supported networks
    is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Grid strategies configuration table
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

-- Grid orders table for tracking individual orders in strategies
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

-- Trades table for completed transactions
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

-- Price history table for market data caching
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    price REAL NOT NULL CHECK (price > 0),
    volume_24h REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System logs table for application logging
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    metadata TEXT, -- JSON data for structured logging
    request_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Application configuration table for system settings
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_is_default ON wallets(is_default) WHERE is_default = 1;
CREATE INDEX IF NOT EXISTS idx_wallets_created_at ON wallets(created_at);

-- Grid strategies indexes
CREATE INDEX IF NOT EXISTS idx_grid_strategies_wallet_address ON grid_strategies(wallet_address);
CREATE INDEX IF NOT EXISTS idx_grid_strategies_status ON grid_strategies(status);
CREATE INDEX IF NOT EXISTS idx_grid_strategies_pair_network ON grid_strategies(pair, network);
CREATE INDEX IF NOT EXISTS idx_grid_strategies_updated_at ON grid_strategies(updated_at);

-- Grid orders indexes
CREATE INDEX IF NOT EXISTS idx_grid_orders_strategy_id ON grid_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_grid_orders_status ON grid_orders(status);
CREATE INDEX IF NOT EXISTS idx_grid_orders_price_side ON grid_orders(price, side);
CREATE INDEX IF NOT EXISTS idx_grid_orders_created_at ON grid_orders(created_at);

-- Trades indexes
CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash);

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_pair ON price_history(pair);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_pair_timestamp ON price_history(pair, timestamp);

-- System logs indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);

-- App config indexes
CREATE INDEX IF NOT EXISTS idx_app_config_updated_at ON app_config(updated_at);

-- ==========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ==========================================

-- Trigger to update grid_strategies.updated_at automatically
CREATE TRIGGER IF NOT EXISTS update_grid_strategies_updated_at
    AFTER UPDATE ON grid_strategies
    FOR EACH ROW
BEGIN
    UPDATE grid_strategies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update app_config.updated_at automatically
CREATE TRIGGER IF NOT EXISTS update_app_config_updated_at
    AFTER UPDATE ON app_config
    FOR EACH ROW
BEGIN
    UPDATE app_config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

-- Trigger to update strategy profit when trade is inserted
CREATE TRIGGER IF NOT EXISTS update_strategy_profit_on_trade
    AFTER INSERT ON trades
    FOR EACH ROW
BEGIN
    UPDATE grid_strategies 
    SET total_profit = total_profit + NEW.profit,
        executed_orders_count = executed_orders_count + 1
    WHERE id = NEW.strategy_id;
END;

-- ==========================================
-- VIEWS FOR MONITORING
-- ==========================================

-- Active strategies overview for monitoring dashboard
CREATE VIEW IF NOT EXISTS active_strategies_overview AS
SELECT 
    gs.id,
    gs.pair,
    gs.network,
    gs.status,
    gs.total_profit,
    gs.executed_orders_count,
    COUNT(CASE WHEN go.status = 'pending' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN go.status = 'filled' THEN 1 END) as filled_orders,
    gs.created_at,
    gs.updated_at
FROM grid_strategies gs
LEFT JOIN grid_orders go ON gs.id = go.strategy_id
WHERE gs.status IN ('active', 'paused')
GROUP BY gs.id;

-- ==========================================
-- DEFAULT CONFIGURATION DATA
-- ==========================================

-- Insert default application configuration
INSERT OR IGNORE INTO app_config (key, value, description) VALUES
('db_version', '1.0', 'Database schema version'),
('app_name', 'XBoost Trader', 'Application name'),
('default_slippage', '0.005', 'Default slippage tolerance (0.5%)'),
('max_gas_price', '100', 'Maximum gas price in gwei'),
('price_update_interval', '5000', 'Price update interval in milliseconds'),
('log_level', 'info', 'Application log level'),
('backup_enabled', 'true', 'Enable automatic database backups');