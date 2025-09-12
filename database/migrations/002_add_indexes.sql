-- Performance Indexes Migration
-- Version: 002
-- Description: Add performance indexes for query optimization

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