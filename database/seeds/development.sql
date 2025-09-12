-- Development Seed Data
-- Test data for local development and testing

-- Sample wallet for development
INSERT OR IGNORE INTO wallets (address, encrypted_private_key, supported_networks, is_default) VALUES
('0x742d35Cc6634C0532925a3b8D45c0532925a3b8D4569E01a', 'AES256:encrypted_private_key_placeholder_for_development', '["linea", "ethereum"]', 1),
('0x8ba1f109551bD432803012645Hac189451b934c4', 'AES256:another_encrypted_key_for_testing_purposes', '["bnb", "ethereum"]', 0);

-- Sample grid strategies for testing
INSERT OR IGNORE INTO grid_strategies (
    id, wallet_address, pair, network, grid_type, upper_price, lower_price, 
    grid_count, base_amount, stop_loss, max_position_ratio, status, 
    total_profit, executed_orders_count
) VALUES
('strategy-001', '0x742d35Cc6634C0532925a3b8D45c0532925a3b8D4569E01a', 'ETH/USDC', 'linea', 'arithmetic', 2500.00, 1500.00, 20, 1000.00, 1200.00, 0.8, 'active', 125.50, 5),
('strategy-002', '0x742d35Cc6634C0532925a3b8D45c0532925a3b8D4569E01a', 'BTC/USDT', 'ethereum', 'geometric', 45000.00, 35000.00, 15, 2000.00, 30000.00, 0.7, 'paused', -50.25, 3),
('strategy-003', '0x8ba1f109551bD432803012645Hac189451b934c4', 'BNB/BUSD', 'bnb', 'arithmetic', 350.00, 250.00, 25, 500.00, NULL, 0.9, 'active', 75.80, 8);

-- Sample grid orders for the strategies
INSERT OR IGNORE INTO grid_orders (
    id, strategy_id, price, amount, side, status, tx_hash, created_at
) VALUES
('order-001', 'strategy-001', 2000.00, 0.5, 'buy', 'filled', '0x123...abc', '2024-09-01 10:00:00'),
('order-002', 'strategy-001', 2100.00, 0.5, 'sell', 'filled', '0x456...def', '2024-09-02 11:30:00'),
('order-003', 'strategy-001', 1900.00, 0.5, 'buy', 'pending', NULL, '2024-09-03 09:15:00'),
('order-004', 'strategy-002', 40000.00, 0.05, 'buy', 'cancelled', NULL, '2024-09-01 14:20:00'),
('order-005', 'strategy-003', 300.00, 1.0, 'buy', 'filled', '0x789...ghi', '2024-09-02 16:45:00');

-- Sample trades from filled orders
INSERT OR IGNORE INTO trades (
    id, strategy_id, order_id, pair, side, price, amount, fee, profit, tx_hash, timestamp
) VALUES
('trade-001', 'strategy-001', 'order-001', 'ETH/USDC', 'buy', 2000.00, 0.5, 2.50, 0.00, '0x123...abc', '2024-09-01 10:05:00'),
('trade-002', 'strategy-001', 'order-002', 'ETH/USDC', 'sell', 2100.00, 0.5, 2.625, 47.50, '0x456...def', '2024-09-02 11:35:00'),
('trade-003', 'strategy-003', 'order-005', 'BNB/BUSD', 'buy', 300.00, 1.0, 1.50, 0.00, '0x789...ghi', '2024-09-02 16:50:00');

-- Sample price history data
INSERT OR IGNORE INTO price_history (pair, price, volume_24h, timestamp) VALUES
('ETH/USDC', 2050.00, 150000000.00, '2024-09-12 12:00:00'),
('ETH/USDC', 2048.50, 148500000.00, '2024-09-12 12:05:00'),
('ETH/USDC', 2052.25, 151200000.00, '2024-09-12 12:10:00'),
('BTC/USDT', 42000.00, 2500000000.00, '2024-09-12 12:00:00'),
('BNB/BUSD', 310.00, 85000000.00, '2024-09-12 12:00:00');

-- Sample system logs
INSERT OR IGNORE INTO system_logs (level, message, metadata, request_id, timestamp) VALUES
('info', 'Grid strategy created successfully', '{"strategyId": "strategy-001", "userId": "dev-user"}', 'req-001', '2024-09-01 10:00:00'),
('warn', 'Price deviation detected', '{"pair": "ETH/USDC", "deviation": "5.2%"}', 'req-002', '2024-09-02 11:30:00'),
('error', 'Order execution failed', '{"orderId": "order-004", "error": "Insufficient balance"}', 'req-003', '2024-09-01 14:20:00'),
('debug', 'Price update received', '{"pair": "BTC/USDT", "price": 42000.00}', 'req-004', '2024-09-12 12:00:00');

-- Update app config with development values
INSERT OR REPLACE INTO app_config (key, value, description) VALUES
('environment', 'development', 'Current application environment'),
('debug_mode', 'true', 'Enable debug logging and features'),
('mock_trading', 'true', 'Use mock trading instead of real transactions'),
('test_wallet_enabled', 'true', 'Enable test wallet functionality'),
('price_simulation', 'true', 'Use simulated price data for testing');