# Data Models

## GridStrategy

**Purpose:** 网格交易策略的完整配置和状态管理

**Key Attributes:**
- id: string - 策略唯一标识符
- pair: string - 交易对（如 "ETH/USDC"）
- network: string - 区块链网络（linea, bnb, ethereum, solana）
- gridType: "arithmetic" | "geometric" - 网格类型
- upperPrice: number - 价格上限
- lowerPrice: number - 价格下限
- gridCount: number - 网格数量
- baseAmount: number - 基础交易金额
- stopLoss: number - 止损价位
- maxPositionRatio: number - 最大仓位比例
- status: "active" | "paused" | "stopped" - 策略状态
- createdAt: Date - 创建时间
- updatedAt: Date - 更新时间

### TypeScript Interface

```typescript
interface GridStrategy {
  id: string;
  pair: string;
  network: 'linea' | 'bnb' | 'ethereum' | 'solana';
  gridType: 'arithmetic' | 'geometric';
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  baseAmount: number;
  stopLoss?: number;
  maxPositionRatio: number;
  status: 'active' | 'paused' | 'stopped';
  createdAt: Date;
  updatedAt: Date;
}
```

### Relationships

- 一个策略对应多个网格订单 (GridOrder)
- 一个策略对应多个交易记录 (Trade)
- 一个策略属于一个钱包 (Wallet)

## GridOrder

**Purpose:** 网格中单个买卖订单的状态跟踪

**Key Attributes:**
- id: string - 订单唯一标识
- strategyId: string - 所属策略ID
- price: number - 订单价格
- amount: number - 订单数量
- side: "buy" | "sell" - 买卖方向
- status: "pending" | "filled" | "cancelled" - 订单状态
- txHash: string - 区块链交易哈希
- createdAt: Date - 创建时间
- filledAt: Date - 成交时间

### TypeScript Interface

```typescript
interface GridOrder {
  id: string;
  strategyId: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  status: 'pending' | 'filled' | 'cancelled';
  txHash?: string;
  createdAt: Date;
  filledAt?: Date;
}
```

### Relationships

- 多个订单属于一个策略 (GridStrategy)
- 一个订单可能对应一个交易记录 (Trade)

## Trade

**Purpose:** 已完成交易的详细记录和盈亏统计

**Key Attributes:**
- id: string - 交易唯一标识
- strategyId: string - 所属策略ID
- orderId: string - 对应的订单ID
- pair: string - 交易对
- side: "buy" | "sell" - 交易方向
- price: number - 成交价格
- amount: number - 成交数量
- fee: number - 手续费
- profit: number - 盈亏金额
- txHash: string - 区块链交易哈希
- timestamp: Date - 交易时间

### TypeScript Interface

```typescript
interface Trade {
  id: string;
  strategyId: string;
  orderId: string;
  pair: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  fee: number;
  profit: number;
  txHash: string;
  timestamp: Date;
}
```

### Relationships

- 多个交易记录属于一个策略 (GridStrategy)
- 每个交易记录对应一个订单 (GridOrder)

## Wallet

**Purpose:** 用户钱包信息和网络配置管理

**Key Attributes:**
- address: string - 钱包地址
- encryptedPrivateKey: string - 加密后的私钥
- supportedNetworks: string[] - 支持的网络列表
- isDefault: boolean - 是否为默认钱包
- createdAt: Date - 添加时间

### TypeScript Interface

```typescript
interface Wallet {
  address: string;
  encryptedPrivateKey: string;
  supportedNetworks: ('linea' | 'bnb' | 'ethereum' | 'solana')[];
  isDefault: boolean;
  createdAt: Date;
}
```

### Relationships

- 一个钱包可以运行多个策略 (GridStrategy)
- 钱包地址用于所有相关交易的身份标识
