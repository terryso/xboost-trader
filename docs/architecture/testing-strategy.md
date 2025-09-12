# Testing Strategy

## Testing Pyramid

```text
        E2E Tests
       /         \
   Integration Tests  
  /                   \
Frontend Unit    Backend Unit
```

## Test Organization

### Frontend Tests

由于是CLI应用，前端测试主要聚焦于命令行交互和输出格式：

```text
tests/cli/
├── commands/                  # 命令测试
│   ├── grid-commands.test.ts     # 网格相关命令
│   ├── config-commands.test.ts   # 配置相关命令
│   ├── monitor-commands.test.ts  # 监控命令
│   └── stats-commands.test.ts    # 统计命令
├── utils/                     # CLI工具测试
│   ├── table-builder.test.ts     # 表格输出
│   ├── input-validator.test.ts   # 输入验证
│   └── color-console.test.ts     # 颜色输出
└── integration/               # CLI集成测试
    ├── command-flow.test.ts      # 命令流程测试
    └── error-handling.test.ts    # 错误处理测试
```

### Backend Tests

```text
tests/backend/
├── unit/                      # 单元测试
│   ├── services/
│   │   ├── strategy-engine.test.ts
│   │   ├── price-monitor.test.ts
│   │   ├── risk-manager.test.ts
│   │   ├── okx-service.test.ts
│   │   └── wallet-manager.test.ts
│   ├── repositories/
│   │   ├── strategy-repository.test.ts
│   │   ├── order-repository.test.ts
│   │   └── trade-repository.test.ts
│   ├── utils/
│   │   ├── grid-calculator.test.ts
│   │   ├── crypto-utils.test.ts
│   │   └── performance-monitor.test.ts
│   └── models/
│       ├── grid-strategy.test.ts
│       └── grid-order.test.ts
├── integration/               # 集成测试
│   ├── database-operations.test.ts
│   ├── okx-api-integration.test.ts
│   ├── strategy-lifecycle.test.ts
│   └── price-monitoring.test.ts
└── performance/               # 性能测试
    ├── load-testing.test.ts
    └── memory-usage.test.ts
```

### E2E Tests

```text
tests/e2e/
├── grid-strategy-lifecycle.test.ts  # 完整网格策略生命周期
├── trading-scenarios.test.ts        # 各种交易场景
├── error-recovery.test.ts           # 错误恢复场景
└── multi-strategy.test.ts           # 多策略并行测试
```

## Test Examples

### Frontend Component Test

```typescript
// tests/cli/commands/grid-commands.test.ts
import { GridCommand } from '../../../src/cli/commands/GridCommand';
import { StrategyEngine } from '../../../src/services/StrategyEngine';
import { CLITestHelper } from '../../helpers/cli-test-helper';

describe('GridCommand', () => {
  let gridCommand: GridCommand;
  let mockStrategyEngine: jest.Mocked<StrategyEngine>;
  let cliHelper: CLITestHelper;

  beforeEach(() => {
    mockStrategyEngine = jest.createMockFromModule('../../../src/services/StrategyEngine');
    gridCommand = new GridCommand(mockStrategyEngine);
    cliHelper = new CLITestHelper();
  });

  describe('create command', () => {
    it('should create grid strategy with valid parameters', async () => {
      // Arrange
      const mockStrategy = {
        id: 'eth-usdc-1',
        pair: 'ETH/USDC',
        upperPrice: 2100,
        lowerPrice: 1900,
        gridCount: 20
      };

      mockStrategyEngine.createStrategy.mockResolvedValue(mockStrategy);

      // Act
      const result = await gridCommand.execute(['create', 'ETH/USDC', '--upper', '2100', '--lower', '1900', '--grids', '20']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Strategy eth-usdc-1 created successfully');
      expect(mockStrategyEngine.createStrategy).toHaveBeenCalledWith({
        pair: 'ETH/USDC',
        upperPrice: 2100,
        lowerPrice: 1900,
        gridCount: 20
      });
    });
  });
});
```

### Backend API Test

```typescript
// tests/backend/services/strategy-engine.test.ts
import { StrategyEngine } from '../../../src/services/StrategyEngine';
import { StrategyRepository } from '../../../src/repositories/StrategyRepository';
import { RiskManager } from '../../../src/services/RiskManager';
import { GridCalculator } from '../../../src/utils/GridCalculator';

describe('StrategyEngine', () => {
  let strategyEngine: StrategyEngine;
  let mockRepository: jest.Mocked<StrategyRepository>;
  let mockRiskManager: jest.Mocked<RiskManager>;
  let mockGridCalculator: jest.Mocked<GridCalculator>;

  beforeEach(() => {
    mockRepository = jest.createMockFromModule('../../../src/repositories/StrategyRepository');
    mockRiskManager = jest.createMockFromModule('../../../src/services/RiskManager');
    mockGridCalculator = jest.createMockFromModule('../../../src/utils/GridCalculator');

    strategyEngine = new StrategyEngine(
      mockRepository,
      mockRiskManager,
      mockGridCalculator
    );
  });

  describe('createStrategy', () => {
    it('should create arithmetic grid strategy', async () => {
      // Arrange
      const strategyConfig = {
        pair: 'ETH/USDC',
        upperPrice: 2100,
        lowerPrice: 1900,
        gridCount: 20,
        gridType: 'arithmetic' as const,
        baseAmount: 100
      };

      const mockGridLevels = [
        { price: 1900, side: 'buy' as const },
        { price: 1910, side: 'buy' as const },
        { price: 2090, side: 'sell' as const },
        { price: 2100, side: 'sell' as const }
      ];

      mockRiskManager.validateStrategy.mockResolvedValue({ valid: true });
      mockGridCalculator.calculateGridLevels.mockReturnValue(mockGridLevels);
      mockRepository.save.mockResolvedValue();

      // Act
      const result = await strategyEngine.createStrategy(strategyConfig);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.pair).toBe('ETH/USDC');
      expect(result.gridType).toBe('arithmetic');
      expect(mockRiskManager.validateStrategy).toHaveBeenCalledWith(strategyConfig);
      expect(mockGridCalculator.calculateGridLevels).toHaveBeenCalledWith(expect.objectContaining(strategyConfig));
      expect(mockRepository.save).toHaveBeenCalledWith(result);
    });
  });
});
```

### E2E Test

```typescript
// tests/e2e/grid-strategy-lifecycle.test.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { OKXMockServer } from '../helpers/okx-mock-server';

const execAsync = promisify(exec);

describe('Grid Strategy Lifecycle E2E', () => {
  let dbHelper: DatabaseTestHelper;
  let mockServer: OKXMockServer;

  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    await dbHelper.setupTestDatabase();

    mockServer = new OKXMockServer();
    await mockServer.start();
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await mockServer.stop();
  });

  beforeEach(async () => {
    await dbHelper.resetDatabase();
  });

  it('should complete full grid strategy lifecycle', async () => {
    // 1. 初始化应用
    const { stdout: initOutput } = await execAsync('npm run cli -- init --test-mode');
    expect(initOutput).toContain('XBoost Trader initialized');

    // 2. 添加钱包
    const { stdout: walletOutput } = await execAsync('npm run cli -- config add-wallet 0x1234567890abcdef --private-key test-key --password testpass123');
    expect(walletOutput).toContain('Wallet added successfully');

    // 3. 创建网格策略
    const { stdout: createOutput } = await execAsync('npm run cli -- grid create ETH/USDC --upper 2100 --lower 1900 --grids 20 --amount 100');
    expect(createOutput).toContain('Strategy');
    expect(createOutput).toContain('created successfully');

    // 提取策略ID
    const strategyIdMatch = createOutput.match(/Strategy (\S+) created/);
    expect(strategyIdMatch).toBeTruthy();
    const strategyId = strategyIdMatch![1];

    // 4. 启动策略
    const { stdout: startOutput } = await execAsync(`npm run cli -- grid start ${strategyId}`);
    expect(startOutput).toContain('started successfully');

    // 5. 检查策略状态
    const { stdout: statusOutput } = await execAsync(`npm run cli -- grid status ${strategyId}`);
    expect(statusOutput).toContain('active');

    // 6. 模拟价格变化，触发交易
    await mockServer.sendPriceUpdate('ETH/USDC', 2050);
    
    // 等待交易处理
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. 检查交易记录
    const { stdout: historyOutput } = await execAsync(`npm run cli -- history --strategy ${strategyId}`);
    expect(historyOutput).toContain('ETH/USDC');

    // 8. 停止策略
    const { stdout: stopOutput } = await execAsync(`npm run cli -- grid stop ${strategyId}`);
    expect(stopOutput).toContain('stopped successfully');

    // 9. 验证最终状态
    const { stdout: finalStatusOutput } = await execAsync(`npm run cli -- grid status ${strategyId}`);
    expect(finalStatusOutput).toContain('stopped');
  });
});
```
