import { CryptoUtils, IEncryptionResult, IEncryptedKeyFile } from '../utils/CryptoUtils';
import { DatabaseConnection } from '../utils/DatabaseConnection';
import { WalletRepository } from '../repositories/WalletRepository';
import type { IWallet } from '../models/types/database.types';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * 钱包信息接口
 */
export interface WalletInfo {
  address: string;
  supportedNetworks: ('linea' | 'bnb' | 'ethereum' | 'solana')[];
  isDefault: boolean;
  createdAt: Date;
  hasEncryptedKey: boolean;
}

/**
 * 钱包管理器接口
 */
export interface IWalletManager {
  addWallet(address: string, privateKey: string, password: string): Promise<void>;
  getDecryptedKey(address: string, password: string): Promise<Buffer>;
  listWallets(): Promise<WalletInfo[]>;
  setDefaultWallet(address: string): Promise<void>;
  removeWallet(address: string): Promise<void>;
  verifyPassword(address: string, password: string): Promise<boolean>;
  updateWalletNetworks(address: string, networks: ('linea' | 'bnb' | 'ethereum' | 'solana')[]): Promise<void>;
}

/**
 * 钱包管理器配置接口
 */
export interface WalletManagerConfig {
  keyStoragePath: string;
  database: DatabaseConnection;
  maxRetryAttempts?: number;
  keyFilePermissions?: string;
}

/**
 * WalletManager - 安全钱包管理服务
 * 负责钱包的加密存储、解密获取和安全管理
 */
export class WalletManager implements IWalletManager {
  private readonly config: WalletManagerConfig;
  private readonly walletRepository: WalletRepository;
  private readonly retryAttempts: Map<string, number> = new Map();
  private readonly maxRetryAttempts: number;

  constructor(config: WalletManagerConfig) {
    this.config = config;
    this.maxRetryAttempts = config.maxRetryAttempts || 3;
    this.walletRepository = new WalletRepository(config.database);
    
    // 确保密钥存储目录存在
    this.ensureKeyStorageDirectory();
  }

  /**
   * 确保密钥存储目录存在并设置正确权限
   */
  private ensureKeyStorageDirectory(): void {
    try {
      if (!existsSync(this.config.keyStoragePath)) {
        mkdirSync(this.config.keyStoragePath, { recursive: true, mode: 0o700 });
      }
    } catch (error) {
      throw new Error(`无法创建密钥存储目录: ${error}`);
    }
  }

  /**
   * 生成密钥文件路径
   */
  private getKeyFilePath(address: string): string {
    const fileName = `${address.toLowerCase()}.key`;
    return join(this.config.keyStoragePath, fileName);
  }

  /**
   * 标准化钱包地址（转为小写）
   */
  private normalizeAddress(address: string): string {
    return address.toLowerCase();
  }

  /**
   * 验证钱包地址格式
   */
  private validateWalletAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new Error('钱包地址不能为空');
    }

    // 基础地址格式验证 (以太坊格式为例)
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error('钱包地址格式无效');
    }

    // 检查是否为有效的十六进制
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('钱包地址包含无效字符');
    }
  }

  /**
   * 验证私钥格式
   */
  private validatePrivateKey(privateKey: string): void {
    if (!privateKey || typeof privateKey !== 'string') {
      throw new Error('私钥不能为空');
    }

    // 清理私钥前缀
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

    // 验证私钥长度 (256位 = 64个十六进制字符)
    if (cleanKey.length !== 64) {
      throw new Error('私钥长度无效，必须为64位十六进制字符');
    }

    // 检查是否为有效的十六进制
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      throw new Error('私钥包含无效字符');
    }
  }

  /**
   * 检查重试次数限制
   */
  private checkRetryLimit(address: string): void {
    const attempts = this.retryAttempts.get(address) || 0;
    if (attempts >= this.maxRetryAttempts) {
      throw new Error(`密码错误次数过多，钱包 ${address} 已被暂时锁定`);
    }
  }

  /**
   * 增加重试计数
   */
  private incrementRetryCount(address: string): void {
    const current = this.retryAttempts.get(address) || 0;
    this.retryAttempts.set(address, current + 1);
  }

  /**
   * 重置重试计数
   */
  private resetRetryCount(address: string): void {
    this.retryAttempts.delete(address);
  }

  /**
   * 添加钱包
   * @param address 钱包地址
   * @param privateKey 私钥
   * @param password 主密码
   */
  public async addWallet(address: string, privateKey: string, password: string): Promise<void> {
    try {
      // 输入验证
      this.validateWalletAddress(address);
      this.validatePrivateKey(privateKey);
      
      // 标准化地址
      const normalizedAddress = this.normalizeAddress(address);

      // 验证密码强度
      const passwordValidation = CryptoUtils.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(`密码强度不足: ${passwordValidation.errors.join(', ')}`);
      }

      // 检查钱包是否已存在
      const existing = await this.walletRepository.findById(normalizedAddress);
      if (existing) {
        throw new Error(`钱包地址 ${address} 已存在`);
      }

      // 加密私钥
      const encryptionResult = CryptoUtils.encryptPrivateKey(privateKey, password);
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);

      // 保存加密文件到磁盘
      const keyFilePath = this.getKeyFilePath(normalizedAddress);
      writeFileSync(keyFilePath, JSON.stringify(keyFile, null, 2), { 
        mode: parseInt(this.config.keyFilePermissions || '600', 8) 
      });

      // 检查是否为第一个钱包
      const existingWallets = await this.walletRepository.findAll();
      const isFirstWallet = existingWallets.length === 0;

      // 保存钱包信息到数据库
      const walletData: IWallet = {
        address: normalizedAddress,
        encryptedPrivateKey: keyFilePath, // 存储文件路径
        supportedNetworks: ['ethereum'], // 默认支持以太坊
        isDefault: isFirstWallet, // 第一个钱包自动设为默认
        createdAt: new Date()
      };

      await this.walletRepository.save(walletData);

    } catch (error) {
      throw new Error(`添加钱包失败: ${error}`);
    }
  }

  /**
   * 获取解密后的私钥
   * @param address 钱包地址
   * @param password 主密码
   * @returns 解密后的私钥 Buffer
   */
  public async getDecryptedKey(address: string, password: string): Promise<Buffer> {
    const normalizedAddress = this.normalizeAddress(address);
    
    try {
      this.validateWalletAddress(address);
      this.checkRetryLimit(normalizedAddress);

      // 从数据库获取钱包信息
      const wallet = await this.walletRepository.findById(normalizedAddress);
      if (!wallet) {
        throw new Error(`钱包 ${address} 不存在`);
      }

      // 读取加密文件
      const keyFilePath = wallet.encryptedPrivateKey;
      if (!existsSync(keyFilePath)) {
        throw new Error(`钱包密钥文件不存在: ${keyFilePath}`);
      }

      const keyFileContent = readFileSync(keyFilePath, 'utf8');
      const keyFile: IEncryptedKeyFile = JSON.parse(keyFileContent);

      // 验证文件完整性
      if (!CryptoUtils.validateEncryptedKeyFile(keyFile)) {
        throw new Error('密钥文件损坏或被篡改');
      }

      // 提取加密结果并解密
      const encryptionResult = CryptoUtils.extractEncryptionResult(keyFile);
      const decryptedKey = CryptoUtils.decryptPrivateKey(encryptionResult, password);

      // 重置重试计数（密码正确）
      this.resetRetryCount(normalizedAddress);

      return decryptedKey;

    } catch (error) {
      // 如果是密码错误，增加重试计数
      if (error instanceof Error && error.message.includes('密码错误')) {
        this.incrementRetryCount(normalizedAddress);
      }
      throw new Error(`获取私钥失败: ${error}`);
    }
  }

  /**
   * 验证密码是否正确
   * @param address 钱包地址
   * @param password 主密码
   * @returns 密码是否正确
   */
  public async verifyPassword(address: string, password: string): Promise<boolean> {
    let decryptedKey: Buffer | null = null;
    try {
      decryptedKey = await this.getDecryptedKey(address, password);
      return true;
    } catch (error) {
      return false;
    } finally {
      // 确保解密的密钥在验证后被清零
      if (decryptedKey) {
        decryptedKey.fill(0);
      }
    }
  }

  /**
   * 列出所有钱包
   * @returns 钱包信息列表
   */
  public async listWallets(): Promise<WalletInfo[]> {
    try {
      const wallets = await this.walletRepository.findAll();
      
      return wallets.map(wallet => ({
        address: this.normalizeAddress(wallet.address),
        supportedNetworks: wallet.supportedNetworks,
        isDefault: wallet.isDefault,
        createdAt: wallet.createdAt,
        hasEncryptedKey: existsSync(wallet.encryptedPrivateKey)
      }));
    } catch (error) {
      throw new Error(`获取钱包列表失败: ${error}`);
    }
  }

  /**
   * 设置默认钱包
   * @param address 钱包地址
   */
  public async setDefaultWallet(address: string): Promise<void> {
    try {
      this.validateWalletAddress(address);
      const normalizedAddress = this.normalizeAddress(address);

      // 检查钱包是否存在
      const wallet = await this.walletRepository.findById(normalizedAddress);
      if (!wallet) {
        throw new Error(`钱包 ${address} 不存在`);
      }

      // 设置指定钱包为默认 (这个方法内部会清除其他钱包的默认状态)
      await this.walletRepository.setAsDefault(normalizedAddress);

    } catch (error) {
      throw new Error(`设置默认钱包失败: ${error}`);
    }
  }

  /**
   * 删除钱包
   * @param address 钱包地址
   */
  public async removeWallet(address: string): Promise<void> {
    try {
      this.validateWalletAddress(address);
      const normalizedAddress = this.normalizeAddress(address);

      // 检查钱包是否存在
      const wallet = await this.walletRepository.findById(normalizedAddress);
      if (!wallet) {
        throw new Error(`钱包 ${address} 不存在`);
      }

      // 删除密钥文件
      const keyFilePath = wallet.encryptedPrivateKey;
      if (existsSync(keyFilePath)) {
        // 安全删除文件前先用随机数据覆盖
        const randomData = CryptoUtils.generateSecureKey().repeat(10);
        writeFileSync(keyFilePath, randomData);
        require('fs').unlinkSync(keyFilePath);
      }

      // 从数据库删除钱包
      await this.walletRepository.delete(normalizedAddress);

      // 清除重试计数
      this.resetRetryCount(normalizedAddress);

    } catch (error) {
      throw new Error(`删除钱包失败: ${error}`);
    }
  }

  /**
   * 更新钱包支持的网络
   * @param address 钱包地址
   * @param networks 支持的网络列表
   */
  public async updateWalletNetworks(
    address: string, 
    networks: ('linea' | 'bnb' | 'ethereum' | 'solana')[]
  ): Promise<void> {
    try {
      this.validateWalletAddress(address);
      const normalizedAddress = this.normalizeAddress(address);

      if (!networks || networks.length === 0) {
        throw new Error('网络列表不能为空');
      }

      // 检查钱包是否存在
      const wallet = await this.walletRepository.findById(normalizedAddress);
      if (!wallet) {
        throw new Error(`钱包 ${address} 不存在`);
      }

      // 更新网络支持 - 需要更新整个钱包对象
      wallet.supportedNetworks = networks;
      await this.walletRepository.save(wallet);

    } catch (error) {
      throw new Error(`更新钱包网络失败: ${error}`);
    }
  }

  /**
   * 获取默认钱包
   * @returns 默认钱包信息，如果没有则返回null
   */
  public async getDefaultWallet(): Promise<WalletInfo | null> {
    try {
      const wallets = await this.listWallets();
      return wallets.find(wallet => wallet.isDefault) || null;
    } catch (error) {
      throw new Error(`获取默认钱包失败: ${error}`);
    }
  }

  /**
   * 健康检查 - 验证服务状态
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, unknown> }> {
    try {
      const details: Record<string, unknown> = {
        keyStoragePathExists: existsSync(this.config.keyStoragePath),
        walletCount: 0,
        databaseConnection: false
      };

      // 检查数据库连接
      try {
        const wallets = await this.walletRepository.findAll();
        details.walletCount = wallets.length;
        details.databaseConnection = true;
      } catch (error) {
        details.databaseError = String(error);
      }

      // 检查密钥存储目录权限
      try {
        const stats = require('fs').statSync(this.config.keyStoragePath);
        details.keyStoragePermissions = (stats.mode & parseInt('777', 8)).toString(8);
      } catch (error) {
        details.keyStorageError = String(error);
      }

      const isHealthy = details.keyStoragePathExists && details.databaseConnection;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: String(error) }
      };
    }
  }

  /**
   * 清理资源
   */
  public async shutdown(): Promise<void> {
    try {
      // 清零所有重试计数
      this.retryAttempts.clear();

      // 这里可以添加其他清理逻辑
      console.log('WalletManager 已安全关闭');
    } catch (error) {
      console.error('WalletManager 关闭时发生错误:', error);
      throw error;
    }
  }
}