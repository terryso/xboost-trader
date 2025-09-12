# Frontend Architecture

由于 XBoost Trader 是纯 CLI 应用，传统意义上的"前端"并不适用。但 CLI 界面设计同样需要清晰的架构来确保用户体验和代码维护性：

## CLI Application Architecture

CLI 应用架构模式: 采用分层命令处理架构，将用户输入、命令解析、业务逻辑和输出展示明确分离

## Command Organization

```text
src/cli/
├── commands/           # 命令实现
│   ├── ConfigCommand.ts    # config 相关命令
│   ├── GridCommand.ts      # grid 相关命令  
│   ├── MonitorCommand.ts   # monitor 命令
│   ├── StatsCommand.ts     # stats 命令
│   └── BalanceCommand.ts   # balance 命令
├── interfaces/         # CLI 接口定义
│   ├── Command.ts          # 命令基础接口
│   └── OutputFormatter.ts  # 输出格式接口
├── utils/             # CLI 工具函数
│   ├── TableBuilder.ts     # 表格输出构建
│   ├── ProgressBar.ts      # 进度条显示
│   ├── ColorConsole.ts     # 彩色输出
│   └── InputValidator.ts   # 输入验证
└── CLIController.ts   # 主控制器
```

## Command Template

```typescript
// 标准命令模板
abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract options: CommandOption[];
  
  abstract execute(args: ParsedArgs): Promise<CommandResult>;
  
  protected validateInput(args: ParsedArgs): ValidationResult {
    // 通用输入验证逻辑
  }
  
  protected formatOutput(data: any, format?: OutputFormat): string {
    // 通用输出格式化
  }
  
  protected handleError(error: Error): never {
    // 统一错误处理
  }
}
```

## CLI State Management

CLI 应用采用无状态设计，每次命令执行都是独立的操作

```typescript
interface CLIState {
  currentStrategy?: string;    // 当前选中的策略
  monitoringMode: boolean;    // 是否处于监控模式
  outputFormat: 'table' | 'json' | 'minimal';  // 输出格式偏好
  verbosity: 'quiet' | 'normal' | 'verbose';   // 详细程度
}
```

## CLI Routing Architecture

基于 Commander.js 的层级命令结构

```text
xboost                          # 主程序
├── init                        # 初始化配置
├── config                      # 配置管理
│   ├── add-wallet <address>    # 添加钱包
│   └── set-network <network>   # 设置网络
├── grid                        # 网格策略管理
│   ├── create <pair>           # 创建策略
│   ├── start <strategy-id>     # 启动策略
│   ├── stop <strategy-id>      # 停止策略
│   ├── list                    # 列出策略
│   └── status [strategy-id]    # 查看状态
├── monitor [strategy-id]       # 实时监控
├── stats [strategy-id]         # 统计分析
├── balance [network]           # 余额查询
└── history [options]           # 交易历史
```

## CLI Services Layer

CLI 命令通过服务层与业务逻辑交互

```typescript
interface CLIServices {
  strategyService: StrategyService;
  monitoringService: MonitoringService;
  configService: ConfigService;
  walletService: WalletService;
}
```
