# Unified Project Structure

```text
xboost-trader/
├── .github/                    # CI/CD 工作流
│   └── workflows/
│       ├── test.yml           # 自动化测试
│       └── release.yml        # 发布流程
├── src/                       # 源代码
│   ├── cli/                   # CLI 界面层
│   │   ├── commands/          # 命令实现
│   │   │   ├── ConfigCommand.ts
│   │   │   ├── GridCommand.ts
│   │   │   ├── MonitorCommand.ts
│   │   │   ├── StatsCommand.ts
│   │   │   └── BalanceCommand.ts
│   │   ├── utils/             # CLI 工具
│   │   │   ├── TableBuilder.ts
│   │   │   ├── ProgressBar.ts
│   │   │   ├── ColorConsole.ts
│   │   │   └── InputValidator.ts
│   │   └── CLIController.ts   # CLI 主控制器
│   ├── controllers/           # 业务控制器
│   │   ├── StrategyController.ts
│   │   ├── TradingController.ts
│   │   ├── MonitorController.ts
│   │   └── ConfigController.ts
│   ├── services/              # 核心业务服务
│   │   ├── StrategyEngine.ts  # 网格策略引擎
│   │   ├── PriceMonitor.ts    # 价格监控服务
│   │   ├── RiskManager.ts     # 风险管理服务
│   │   ├── OKXService.ts      # OKX 交易服务
│   │   ├── WalletManager.ts   # 钱包管理服务
│   │   └── NotificationService.ts # 通知服务
│   ├── repositories/          # 数据访问层
│   │   ├── BaseRepository.ts
│   │   ├── StrategyRepository.ts
│   │   ├── OrderRepository.ts
│   │   ├── TradeRepository.ts
│   │   └── ConfigRepository.ts
│   ├── models/               # 数据模型和类型定义
│   │   ├── GridStrategy.ts
│   │   ├── GridOrder.ts
│   │   ├── Trade.ts
│   │   ├── Wallet.ts
│   │   └── types/            # 类型定义
│   │       ├── api.types.ts
│   │       ├── database.types.ts
│   │       └── config.types.ts
│   ├── utils/                # 通用工具类
│   │   ├── DatabaseConnection.ts
│   │   ├── CryptoUtils.ts
│   │   ├── GridCalculator.ts
│   │   ├── Logger.ts
│   │   ├── ErrorHandler.ts
│   │   └── ConfigValidator.ts
│   ├── config/               # 配置管理
│   │   ├── database.config.ts
│   │   ├── network.config.ts
│   │   └── app.config.ts
│   └── app.ts                # 应用程序入口点
├── tests/                    # 测试文件
│   ├── unit/                 # 单元测试
│   │   ├── services/
│   │   │   ├── StrategyEngine.test.ts
│   │   │   ├── PriceMonitor.test.ts
│   │   │   └── RiskManager.test.ts
│   │   ├── utils/
│   │   │   ├── GridCalculator.test.ts
│   │   │   └── CryptoUtils.test.ts
│   │   └── repositories/
│   │       └── StrategyRepository.test.ts
│   ├── integration/          # 集成测试
│   │   ├── database.test.ts
│   │   ├── okx-service.test.ts
│   │   └── cli-commands.test.ts
│   ├── e2e/                  # 端到端测试
│   │   ├── grid-strategy-lifecycle.test.ts
│   │   └── trading-scenarios.test.ts
│   ├── fixtures/             # 测试数据
│   │   ├── strategies.json
│   │   ├── price-data.json
│   │   └── mock-responses.json
│   └── helpers/              # 测试辅助工具
│       ├── database-helper.ts
│       ├── mock-okx-client.ts
│       └── test-utils.ts
├── database/                 # 数据库相关
│   ├── migrations/           # 数据库迁移
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_indexes.sql
│   │   └── 003_add_triggers.sql
│   ├── seeds/                # 测试数据
│   │   └── development.sql
│   └── schema.sql            # 完整数据库架构
├── data/                     # 运行时数据目录
│   ├── .gitkeep              # 保持目录结构
│   └── README.md             # 数据目录说明
├── config/                   # 配置文件模板
│   ├── config.example.yaml   # 配置模板
│   ├── networks.yaml         # 网络配置
│   └── trading-pairs.yaml    # 支持的交易对
├── scripts/                  # 脚本工具
│   ├── setup.sh              # 环境安装脚本
│   ├── build.sh              # 构建脚本
│   ├── test.sh               # 测试脚本
│   ├── migrate-db.ts         # 数据库迁移脚本
│   └── backup-data.ts        # 数据备份脚本
├── docs/                     # 项目文档
│   ├── prd.md                # 产品需求文档
│   ├── architecture.md       # 架构文档（本文件）
│   ├── user-guide.md         # 用户使用指南
│   ├── api-reference.md      # API 参考
│   ├── deployment.md         # 部署说明
│   └── troubleshooting.md    # 问题排查
├── logs/                     # 日志文件目录
│   ├── .gitignore           # 忽略日志文件
│   └── README.md            # 日志说明
├── .env.example              # 环境变量模板
├── .gitignore               # Git 忽略文件
├── .npmrc                   # npm 配置
├── package.json             # 项目依赖和脚本
├── package-lock.json        # 锁定依赖版本
├── tsconfig.json            # TypeScript 配置
├── vitest.config.ts         # Vitest 测试配置
├── eslint.config.js         # ESLint 代码规范
├── prettier.config.js       # Prettier 代码格式化
├── ecosystem.config.js      # PM2 进程管理配置
└── README.md                # 项目说明文档
```
