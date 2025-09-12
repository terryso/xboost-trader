# External APIs

## OKX DEX API

- **Purpose:** 核心交易执行和价格数据获取，支持多链 DeFi 交易
- **Documentation:** https://www.okx.com/web3/build/docs/waas/dex-api
- **Base URL(s):** https://www.okx.com/api/v5/dex/
- **Authentication:** API Key + Secret (应用级认证)
- **Rate Limits:** 20 请求/秒 (价格查询), 10 请求/秒 (交易执行)

**Key Endpoints Used:**
- `GET /aggregator/quote` - 获取最优交易路径和价格
- `POST /aggregator/swap` - 执行代币交换交易
- `GET /aggregator/supported/chain` - 获取支持的区块链列表
- `GET /aggregator/all-tokens` - 获取支持的代币列表

**Integration Notes:** 通过 OKX DEX SDK 封装，支持 Linea、BNB Chain、Ethereum、Solana 等网络，内置智能路由优化获取最佳价格

## Linea Network RPC

- **Purpose:** Linea Layer 2 网络的直接区块链交互，获取 gas 价格和交易状态
- **Documentation:** https://docs.linea.build/developers/quickstart/rpc
- **Base URL(s):** https://rpc.linea.build, https://linea-mainnet.infura.io/v3/
- **Authentication:** 无需认证 (公共RPC) 或 Infura Project ID
- **Rate Limits:** 100,000 请求/天 (Infura 免费套餐)

**Key Endpoints Used:**
- `eth_gasPrice` - 获取当前 gas 价格
- `eth_getTransactionReceipt` - 确认交易状态
- `eth_getBalance` - 查询账户余额
- `eth_call` - 查询智能合约状态

**Integration Notes:** 作为 OKX SDK 的补充，用于精确的 gas 估算和交易确认，确保在 Linea 网络上的最优执行

## BNB Chain RPC

- **Purpose:** BNB Smart Chain 网络交互，第二优先级网络支持
- **Documentation:** https://docs.bnbchain.org/docs/rpc
- **Base URL(s):** https://bsc-dataseed.binance.org/, https://bsc-dataseed1.defibit.io/
- **Authentication:** 无需认证 (公共RPC)
- **Rate Limits:** 无明确限制，建议不超过 100 请求/分钟

**Key Endpoints Used:**
- `eth_gasPrice` - BSC gas 价格查询
- `eth_getTransactionReceipt` - 交易确认
- `eth_estimateGas` - Gas 使用量估算

**Integration Notes:** BSC 使用 Ethereum 兼容的 JSON-RPC 接口，集成相对简单，主要用于扩展网络支持

## CoinGecko Price API (备用)

- **Purpose:** 备用价格数据源，当 OKX API 不可用时提供价格参考
- **Documentation:** https://www.coingecko.com/en/api/documentation
- **Base URL(s):** https://api.coingecko.com/api/v3/
- **Authentication:** 免费无需认证，付费 API Key 可选
- **Rate Limits:** 10-50 请求/分钟 (免费套餐)

**Key Endpoints Used:**
- `GET /simple/price` - 获取代币价格
- `GET /ping` - API 健康检查

**Integration Notes:** 仅作为价格监控的备用数据源，不用于交易执行，确保价格数据的高可用性
