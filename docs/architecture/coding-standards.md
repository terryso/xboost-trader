# Coding Standards

## Critical Fullstack Rules

- **TypeScript First:** 所有代码必须使用 TypeScript，严禁 any 类型，使用 strict 模式 - _原因：类型安全是金融应用的基础要求_
- **Error Handling:** 所有异步操作必须包含 try-catch，使用自定义错误类型，记录完整错误上下文 - _原因：交易失败必须可追踪和恢复_
- **Private Key Security:** 私钥仅能在内存中存在，禁止日志记录，使用后立即清零 - _原因：资产安全是最高优先级_
- **Database Transactions:** 所有数据修改操作必须使用事务，确保策略状态一致性 - _原因：避免策略状态不一致导致的资金损失_
- **Input Validation:** 所有用户输入和外部 API 响应必须验证，使用 Zod schema - _原因：防止恶意输入和数据污染_
- **Logging Standards:** 交易相关操作必须记录结构化日志，包含 requestId 用于追踪 - _原因：监管合规和问题排查需求_
- **Rate Limiting:** 所有外部 API 调用必须实现速率限制，避免触发服务商限制 - _原因：保护 API 额度和服务稳定性_
- **Configuration Management:** 禁止硬编码配置值，所有配置通过 config 对象访问 - _原因：环境隔离和安全性_
- **Async/Await Only:** 禁止使用 Promise.then()，统一使用 async/await 语法 - _原因：代码一致性和错误处理标准化_
- **Test Coverage:** 核心交易逻辑必须达到 100% 测试覆盖率，包含异常场景 - _原因：金融逻辑不容出错_

## Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Classes | PascalCase | PascalCase | `StrategyEngine`, `GridCalculator` |
| Functions | camelCase | camelCase | `createStrategy`, `calculateProfit` |
| CLI Commands | kebab-case | - | `grid-create`, `config-add-wallet` |
| Database Tables | - | snake_case | `grid_strategies`, `trade_history` |
| Environment Variables | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE | `OKX_API_KEY`, `DATABASE_PATH` |
| File Names | kebab-case | kebab-case | `strategy-engine.ts`, `grid-calculator.ts` |
| Interface/Types | PascalCase with I prefix | PascalCase with I prefix | `IGridStrategy`, `ITradeResult` |
| Constants | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE | `MAX_GRID_COUNT`, `DEFAULT_SLIPPAGE` |
