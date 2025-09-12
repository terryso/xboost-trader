# API Specification

由于 XBoost Trader 是本地 CLI 应用，不需要传统的 REST API 或 GraphQL 接口。系统通过**直接 SDK 调用**与 OKX DEX 交互，通过**CLI 命令接口**与用户交互。

## CLI Command Interface

```typescript
// CLI Commands Schema
interface CLICommands {
  // 初始化和配置
  init: {
    description: "初始化 XBoost Trader 配置";
    options: never;
    output: ConfigurationResult;
  };
  
  // 钱包管理
  "config add-wallet": {
    description: "添加新钱包";
    options: {
      address: string;
      privateKey: string; // 将被加密存储
      networks: string[]; // 支持的网络列表
    };
    output: WalletAddResult;
  };
  
  "config set-network": {
    description: "设置默认网络";
    options: {
      network: "linea" | "bnb" | "ethereum" | "solana";
    };
    output: NetworkSetResult;
  };
  
  // 网格策略管理
  "grid create": {
    description: "创建新的网格策略";
    options: {
      pair: string; // 交易对，如 "ETH/USDC"
      upper: number; // 价格上限
      lower: number; // 价格下限
      grids: number; // 网格数量
      amount?: number; // 基础交易金额
      type?: "arithmetic" | "geometric"; // 网格类型
      "stop-loss"?: number; // 止损价位
      "max-position"?: number; // 最大仓位比例
    };
    output: StrategyCreateResult;
  };
  
  "grid start": {
    description: "启动网格策略";
    options: {
      strategyId: string;
    };
    output: StrategyStartResult;
  };
  
  "grid stop": {
    description: "停止网格策略";
    options: {
      strategyId: string;
    };
    output: StrategyStopResult;
  };
  
  "grid status": {
    description: "查看所有策略状态";
    options: {
      strategy?: string; // 可选，查看特定策略
    };
    output: StrategyStatusResult;
  };
  
  "grid list": {
    description: "列出所有策略";
    options: never;
    output: StrategyListResult;
  };
  
  // 监控和分析
  monitor: {
    description: "实时监控策略执行";
    options: {
      strategy?: string; // 可选，监控特定策略
      interval?: number; // 刷新间隔（秒）
    };
    output: MonitoringStream;
  };
  
  stats: {
    description: "查看策略统计";
    options: {
      strategy?: string; // 可选，特定策略统计
      days?: number; // 统计天数
    };
    output: StatisticsResult;
  };
  
  balance: {
    description: "查看账户余额";
    options: {
      network?: string; // 可选，特定网络余额
    };
    output: BalanceResult;
  };
  
  history: {
    description: "查看交易历史";
    options: {
      days?: number; // 查看天数
      strategy?: string; // 可选，特定策略
      limit?: number; // 记录数限制
    };
    output: HistoryResult;
  };
}
```
