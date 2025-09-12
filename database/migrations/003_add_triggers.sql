-- Database Triggers Migration
-- Version: 003
-- Description: Add triggers for automatic updates and calculations

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

-- Create monitoring view
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

-- Insert default configuration data
INSERT OR IGNORE INTO app_config (key, value, description) VALUES
('db_version', '1.0', 'Database schema version'),
('app_name', 'XBoost Trader', 'Application name'),
('default_slippage', '0.005', 'Default slippage tolerance (0.5%)'),
('max_gas_price', '100', 'Maximum gas price in gwei'),
('price_update_interval', '5000', 'Price update interval in milliseconds'),
('log_level', 'info', 'Application log level'),
('backup_enabled', 'true', 'Enable automatic database backups');