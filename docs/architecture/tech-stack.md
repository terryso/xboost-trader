# Tech Stack

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | ^5.0.0 | CLI 应用开发语言 | 类型安全，减少运行时错误，与 OKX SDK 兼容 |
| CLI Framework | Commander.js | ^11.0.0 | 命令行界面构建 | 成熟稳定，支持复杂命令结构和参数验证 |
| UI Component Library | 不适用 | - | CLI 应用无 UI 组件 | 专注命令行交互 |
| State Management | 内置状态管理 | - | 应用状态管理 | 简单的内存状态，无需复杂框架 |
| Backend Language | TypeScript | ^5.0.0 | 核心业务逻辑 | 与前端语言统一，便于代码共享 |
| Backend Framework | 原生 Node.js | ^18.0.0 | 运行时环境 | 轻量级，无 HTTP 服务需求 |
| API Style | 直接 SDK 调用 | - | OKX DEX SDK 集成 | 无需 REST/GraphQL，直接调用交易接口 |
| Database | SQLite | ^3.42.0 | 本地数据存储 | 轻量级，无服务器，完美适配本地应用 |
| Cache | 内存缓存 | - | 价格数据和策略状态缓存 | 简单高效，避免额外依赖 |
| File Storage | 本地文件系统 | - | 配置文件和私钥存储 | 安全性最高，无网络传输风险 |
| Authentication | AES-256 加密 | - | 私钥保护 | 军用级加密标准，保护用户资产安全 |
| Frontend Testing | 不适用 | - | 无前端界面 | CLI 应用专注后端逻辑测试 |
| Backend Testing | Vitest | ^1.0.0 | 单元和集成测试 | 快速的 Vite 原生测试框架，与 TypeScript 深度集成 |
| E2E Testing | 自定义脚本 | - | 交易流程端到端测试 | 模拟真实交易场景验证 |
| Build Tool | tsc (TypeScript) | ^5.0.0 | TypeScript 编译 | 官方编译器，性能最优 |
| Bundler | 不需要 | - | Node.js 直接运行 | 避免打包复杂性 |
| IaC Tool | 不适用 | - | 本地运行无需基础设施 | 简化部署流程 |
| CI/CD | GitHub Actions | - | 自动化测试和构建 | 开源友好，集成便利 |
| Monitoring | Winston | ^3.10.0 | 日志记录和监控 | 结构化日志，支持多种输出格式 |
| Logging | Winston + 本地文件 | ^3.10.0 | 交易日志持久化 | 完整审计跟踪，便于问题排查 |
| CSS Framework | 不适用 | - | CLI 应用无样式需求 | 专注功能实现 |
