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

Our testing strategy is organized by test type, which is a pragmatic and widely-used convention. This makes it easy to run specific categories of tests (e.g., all unit tests) and is intuitive for developers.

```text
tests/
├── unit/                      # 单元测试
│   ├── cli/                   # CLI相关的单元测试
│   │   └── utils/             # CLI工具的单元测试
│   ├── services/              # 服务层的单元测试
│   ├── repositories/          # 数据仓库层的单元测试
│   └── utils/                 # 通用工具的单元测试
├── integration/               # 集成测试
│   # (e.g., database-connection.test.ts, security-integration.test.ts)
├── e2e/                       # 端到端测试
│   # (e.g., grid-strategy-lifecycle.test.ts)
├── fixtures/                  # 测试数据
│   # (e.g., mock-responses.json)
└── helpers/                   # 测试辅助工具
    # (e.g., database-helper.ts, mock-okx-client.ts)
```


## Test Examples

### Frontend Component Test

```typescript
// tests/cli/commands/grid-commands.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GridCommand } from '../../../src/cli/commands/GridCommand';
import { StrategyEngine } from '../../../src/services/StrategyEngine';
import { CLITestHelper } from '../../helpers/cli-test-helper';
import type { MockedObject } from 'vitest';

describe('GridCommand', () => {
  let gridCommand: GridCommand;
  let mockStrategyEngine: MockedObject<StrategyEngine>;
  let cliHelper: CLITestHelper;

  beforeEach(async () => {
    mockStrategyEngine = vi.mocked(await import('../../../src/services/StrategyEngine'));
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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyEngine } from '../../../src/services/StrategyEngine';
import { StrategyRepository } from '../../../src/repositories/StrategyRepository';
import { RiskManager } from '../../../src/services/RiskManager';
import { GridCalculator } from '../../../src/utils/GridCalculator';
import type { MockedObject } from 'vitest';

describe('StrategyEngine', () => {
  let strategyEngine: StrategyEngine;
  let mockRepository: MockedObject<StrategyRepository>;
  let mockRiskManager: MockedObject<RiskManager>;
  let mockGridCalculator: MockedObject<GridCalculator>;

  beforeEach(async () => {
    mockRepository = vi.mocked(await import('../../../src/repositories/StrategyRepository'));
    mockRiskManager = vi.mocked(await import('../../../src/services/RiskManager'));
    mockGridCalculator = vi.mocked(await import('../../../src/utils/GridCalculator'));

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
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
