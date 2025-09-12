# Database Schema

```sql
-- 数据库初始化和配置
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- 钱包表
CREATE TABLE wallets (
    address TEXT PRIMARY KEY,
    encrypted_private_key TEXT NOT NULL,
    supported_networks TEXT NOT NULL, -- JSON 数组格式
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 网格策略表
CREATE TABLE grid_strategies (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    pair TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('linea', 'bnb', 'ethereum', 'solana')),
    grid_type TEXT NOT NULL CHECK (grid_type IN ('arithmetic', 'geometric')),
    upper_price REAL NOT NULL,
    lower_price REAL NOT NULL,
    grid_count INTEGER NOT NULL,
    base_amount REAL NOT NULL,
    stop_loss REAL,
    max_position_ratio REAL NOT NULL DEFAULT 0.8,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'stopped')) DEFAULT 'stopped',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES wallets (address) ON DELETE CASCADE
);

-- 网格订单表
CREATE TABLE grid_orders (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    price REAL NOT NULL,
    amount REAL NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'filled', 'cancelled')) DEFAULT 'pending',
    tx_hash TEXT,
    blockchain_order_id TEXT, -- OKX 或区块链返回的订单 ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    filled_at DATETIME,
    FOREIGN KEY (strategy_id) REFERENCES grid_strategies (id) ON DELETE CASCADE
);

-- 交易记录表
CREATE TABLE trades (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    order_id TEXT,
    pair TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    price REAL NOT NULL,
    amount REAL NOT NULL,
    fee REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    tx_hash TEXT NOT NULL,
    gas_used REAL,
    gas_price REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (strategy_id) REFERENCES grid_strategies (id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES grid_orders (id) ON DELETE SET NULL
);

-- 价格历史表（用于统计和分析）
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    network TEXT NOT NULL,
    price REAL NOT NULL,
    volume_24h REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统日志表
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    context TEXT, -- JSON 格式的上下文信息
    strategy_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (strategy_id) REFERENCES grid_strategies (id) ON DELETE SET NULL
);

-- 应用配置表
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 性能优化索引
CREATE INDEX idx_strategies_status ON grid_strategies (status);
CREATE INDEX idx_strategies_wallet ON grid_strategies (wallet_address);
CREATE INDEX idx_orders_strategy ON grid_orders (strategy_id);
CREATE INDEX idx_orders_status ON grid_orders (status);
CREATE INDEX idx_trades_strategy ON trades (strategy_id);
CREATE INDEX idx_trades_timestamp ON trades (timestamp);
CREATE INDEX idx_price_history_pair ON price_history (pair, network);
CREATE INDEX idx_price_history_timestamp ON price_history (timestamp);
CREATE INDEX idx_logs_timestamp ON system_logs (timestamp);
CREATE INDEX idx_logs_strategy ON system_logs (strategy_id);

-- 触发器：自动更新 updated_at 字段
CREATE TRIGGER update_strategy_timestamp 
AFTER UPDATE ON grid_strategies
FOR EACH ROW 
BEGIN
    UPDATE grid_strategies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 视图：活跃策略概览
CREATE VIEW active_strategies_overview AS
SELECT 
    s.id,
    s.pair,
    s.network,
    s.status,
    COUNT(o.id) as active_orders,
    COALESCE(SUM(t.profit), 0) as total_profit,
    COUNT(t.id) as total_trades,
    s.created_at,
    MAX(t.timestamp) as last_trade_time
FROM grid_strategies s
LEFT JOIN grid_orders o ON s.id = o.strategy_id AND o.status = 'pending'
LEFT JOIN trades t ON s.id = t.strategy_id
WHERE s.status IN ('active', 'paused')
GROUP BY s.id;
```
