import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletManager, IWalletManager, WalletManagerConfig } from '../../../src/services/WalletManager';
import { DatabaseConnection } from '../../../src/utils/DatabaseConnection';
import { testDatabaseConfig } from '../../../src/config/database.config';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('WalletManager', () => {
  let walletManager: IWalletManager;
  let db: DatabaseConnection;
  let testKeyStoragePath: string;
  let config: WalletManagerConfig;

  const testWallet = {
    address: '0x1234567890123456789012345678901234567890',
    privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    password: 'TestPassword123!'
  };

  const weakPassword = 'weak';

  beforeEach(async () => {
    // 创建临时测试目录
    testKeyStoragePath = join(tmpdir(), 'wallet-manager-test', Date.now().toString());
    mkdirSync(testKeyStoragePath, { recursive: true });

    // 创建内存数据库连接用于测试
    db = new DatabaseConnection(testDatabaseConfig);
    await db.initialize();

    // 创建钱包表
    await db.run(`
      CREATE TABLE wallets (
        address TEXT PRIMARY KEY,
        encrypted_private_key TEXT NOT NULL,
        supported_networks TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    config = {
      keyStoragePath: testKeyStoragePath,
      database: db,
      maxRetryAttempts: 3,
      keyFilePermissions: '600'
    };

    walletManager = new WalletManager(config);
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    
    // 清理测试目录
    if (existsSync(testKeyStoragePath)) {
      rmSync(testKeyStoragePath, { recursive: true, force: true });
    }
  });

  describe('Wallet Creation', () => {
    it('should add wallet successfully with valid inputs', async () => {
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
      
      const wallets = await walletManager.listWallets();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].address).toBe(testWallet.address.toLowerCase());
      expect(wallets[0].hasEncryptedKey).toBe(true);
      expect(wallets[0].isDefault).toBe(true); // 第一个钱包应该自动设为默认
    });

    it('should reject wallet with invalid address format', async () => {
      await expect(
        walletManager.addWallet('invalid-address', testWallet.privateKey, testWallet.password)
      ).rejects.toThrow('钱包地址格式无效');
    });

    it('should reject wallet with invalid private key format', async () => {
      await expect(
        walletManager.addWallet(testWallet.address, 'invalid-key', testWallet.password)
      ).rejects.toThrow('私钥长度无效');
    });

    it('should reject wallet with weak password', async () => {
      await expect(
        walletManager.addWallet(testWallet.address, testWallet.privateKey, weakPassword)
      ).rejects.toThrow('密码强度不足');
    });

    it('should reject duplicate wallet addresses', async () => {
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
      
      await expect(
        walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password)
      ).rejects.toThrow('钱包地址');
    });

    it('should create key storage directory if it does not exist', async () => {
      const newPath = join(testKeyStoragePath, 'new-directory');
      const newConfig = { ...config, keyStoragePath: newPath };
      
      const newWalletManager = new WalletManager(newConfig);
      await newWalletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
      
      expect(existsSync(newPath)).toBe(true);
    });
  });

  describe('Private Key Retrieval', () => {
    beforeEach(async () => {
      // Reinitialize database and walletManager for this test group
      if (db) {
        await db.close();
      }
      
      testKeyStoragePath = join(tmpdir(), 'wallet-manager-test', Date.now().toString());
      mkdirSync(testKeyStoragePath, { recursive: true });

      db = new DatabaseConnection(testDatabaseConfig);
      await db.initialize();

      await db.run(`
        CREATE TABLE wallets (
          address TEXT PRIMARY KEY,
          encrypted_private_key TEXT NOT NULL,
          supported_networks TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);

      config = {
        keyStoragePath: testKeyStoragePath,
        database: db,
        maxRetryAttempts: 3,
        keyFilePermissions: '600'
      };

      walletManager = new WalletManager(config);
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
    });

    it('should retrieve private key as a buffer with correct password', async () => {
      const decryptedKey = await walletManager.getDecryptedKey(testWallet.address, testWallet.password);
      expect(decryptedKey).toBeInstanceOf(Buffer);
      expect(decryptedKey.toString('utf8')).toBe(testWallet.privateKey);
      // Securely wipe the buffer after test
      decryptedKey.fill(0);
    });

    it('should fail to retrieve private key with wrong password', async () => {
      await expect(
        walletManager.getDecryptedKey(testWallet.address, 'WrongPassword123!')
      ).rejects.toThrow();
    });

    it('should fail to retrieve private key for non-existent wallet', async () => {
      await expect(
        walletManager.getDecryptedKey('0x9999999999999999999999999999999999999999', testWallet.password)
      ).rejects.toThrow('钱包');
    });

    it('should implement retry limit for wrong passwords', async () => {
      const wrongPassword = 'WrongPassword123!';
      
      // 尝试多次错误密码
      for (let i = 0; i < 3; i++) {
        await expect(
          walletManager.getDecryptedKey(testWallet.address, wrongPassword)
        ).rejects.toThrow();
      }

      // 第四次应该被锁定
      await expect(
        walletManager.getDecryptedKey(testWallet.address, wrongPassword)
      ).rejects.toThrow('已被暂时锁定');
    });

    it('should reset retry count after successful authentication', async () => {
      const wrongPassword = 'WrongPassword123!';
      
      // 尝试两次错误密码
      for (let i = 0; i < 2; i++) {
        await expect(
          walletManager.getDecryptedKey(testWallet.address, wrongPassword)
        ).rejects.toThrow();
      }

      // 使用正确密码
      await walletManager.getDecryptedKey(testWallet.address, testWallet.password);

      // 现在应该可以再次尝试错误密码
      await expect(
        walletManager.getDecryptedKey(testWallet.address, wrongPassword)
      ).rejects.toThrow();
    });
  });

  describe('Password Verification', () => {
    beforeEach(async () => {
      // Reinitialize database and walletManager for this test group
      if (db) {
        await db.close();
      }
      
      testKeyStoragePath = join(tmpdir(), 'wallet-manager-test', Date.now().toString());
      mkdirSync(testKeyStoragePath, { recursive: true });

      db = new DatabaseConnection(testDatabaseConfig);
      await db.initialize();

      await db.run(`
        CREATE TABLE wallets (
          address TEXT PRIMARY KEY,
          encrypted_private_key TEXT NOT NULL,
          supported_networks TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);

      config = {
        keyStoragePath: testKeyStoragePath,
        database: db,
        maxRetryAttempts: 3,
        keyFilePermissions: '600'
      };

      walletManager = new WalletManager(config);
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
    });

    it('should verify correct password', async () => {
      const isValid = await walletManager.verifyPassword(testWallet.address, testWallet.password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const isValid = await walletManager.verifyPassword(testWallet.address, 'WrongPassword123!');
      expect(isValid).toBe(false);
    });
  });

  describe('Wallet Management', () => {
    beforeEach(async () => {
      // Reinitialize database and walletManager for this test group
      if (db) {
        await db.close();
      }
      
      testKeyStoragePath = join(tmpdir(), 'wallet-manager-test', Date.now().toString());
      mkdirSync(testKeyStoragePath, { recursive: true });

      db = new DatabaseConnection(testDatabaseConfig);
      await db.initialize();

      await db.run(`
        CREATE TABLE wallets (
          address TEXT PRIMARY KEY,
          encrypted_private_key TEXT NOT NULL,
          supported_networks TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);

      config = {
        keyStoragePath: testKeyStoragePath,
        database: db,
        maxRetryAttempts: 3,
        keyFilePermissions: '600'
      };

      walletManager = new WalletManager(config);
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
    });

    it('should list all wallets', async () => {
      const wallets = await walletManager.listWallets();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].address).toBe(testWallet.address.toLowerCase());
      expect(wallets[0].supportedNetworks).toContain('ethereum');
      expect(wallets[0].isDefault).toBe(true);
    });

    it('should set default wallet', async () => {
      const secondWallet = {
        address: '0x9876543210987654321098765432109876543210',
        privateKey: '0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef',
        password: 'SecondPassword123!'
      };

      await walletManager.addWallet(secondWallet.address, secondWallet.privateKey, secondWallet.password);
      
      await walletManager.setDefaultWallet(secondWallet.address);

      const wallets = await walletManager.listWallets();
      const defaultWallet = wallets.find(w => w.isDefault);
      expect(defaultWallet?.address).toBe(secondWallet.address.toLowerCase());
    });

    it('should get default wallet', async () => {
      const defaultWallet = await walletManager.getDefaultWallet();
      expect(defaultWallet).not.toBeNull();
      expect(defaultWallet?.address).toBe(testWallet.address.toLowerCase());
      expect(defaultWallet?.isDefault).toBe(true);
    });

    it('should update wallet networks', async () => {
      const newNetworks = ['ethereum', 'bnb', 'linea'] as const;
      await walletManager.updateWalletNetworks(testWallet.address, newNetworks);

      const wallets = await walletManager.listWallets();
      const targetWallet = wallets.find(w => w.address === testWallet.address.toLowerCase());
      expect(targetWallet?.supportedNetworks).toEqual(newNetworks);
    });

    it('should remove wallet', async () => {
      // Verify the wallet exists before removal
      const walletsBeforeRemoval = await walletManager.listWallets();
      expect(walletsBeforeRemoval.length).toBeGreaterThan(0);
      
      await walletManager.removeWallet(testWallet.address);

      const wallets = await walletManager.listWallets();
      const removedWallet = wallets.find(w => w.address === testWallet.address.toLowerCase());
      expect(removedWallet).toBeUndefined();
    });

    it('should fail to remove non-existent wallet', async () => {
      await expect(
        walletManager.removeWallet('0x9999999999999999999999999999999999999999')
      ).rejects.toThrow('钱包');
    });
  });

  describe('Security Features', () => {
    beforeEach(async () => {
      // Reinitialize database and walletManager for this test group
      if (db) {
        await db.close();
      }
      
      testKeyStoragePath = join(tmpdir(), 'wallet-manager-test', Date.now().toString());
      mkdirSync(testKeyStoragePath, { recursive: true });

      db = new DatabaseConnection(testDatabaseConfig);
      await db.initialize();

      await db.run(`
        CREATE TABLE wallets (
          address TEXT PRIMARY KEY,
          encrypted_private_key TEXT NOT NULL,
          supported_networks TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);

      config = {
        keyStoragePath: testKeyStoragePath,
        database: db,
        maxRetryAttempts: 3,
        keyFilePermissions: '600'
      };

      walletManager = new WalletManager(config);
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
    });

    it('should handle concurrent operations safely', async () => {
      const operations = [
        walletManager.getDecryptedKey(testWallet.address, testWallet.password),
        walletManager.verifyPassword(testWallet.address, testWallet.password),
        walletManager.listWallets()
      ];

      const results = await Promise.all(operations);
      
      const decryptedKey = results[0] as Buffer;
      expect(decryptedKey.toString('utf8')).toBe(testWallet.privateKey); // decrypted key
      decryptedKey.fill(0); // wipe buffer

      expect(results[1]).toBe(true); // password verification
      expect(results[2]).toHaveLength(1); // wallet list
    });

    it('should create encrypted key files with correct permissions', async () => {
      const wallets = await walletManager.listWallets();
      expect(wallets[0].hasEncryptedKey).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status when properly configured', async () => {
      const health = await walletManager.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.keyStoragePathExists).toBe(true);
      expect(health.details.databaseConnection).toBe(true);
    });

    it('should report unhealthy status when key storage is unavailable', async () => {
      // 删除存储目录
      rmSync(testKeyStoragePath, { recursive: true, force: true });

      const health = await walletManager.healthCheck();
      expect(health.details.keyStoragePathExists).toBe(false);
    });
  });

  describe('Multiple Wallets', () => {
    it('should handle multiple wallets correctly', async () => {
      const wallet2 = {
        address: '0x9876543210987654321098765432109876543210',
        privateKey: '0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef',
        password: 'SecondPassword123!'
      };

      const wallet3 = {
        address: '0x1111111111111111111111111111111111111111',
        privateKey: '0x1111111111abcdef1111111111abcdef1111111111abcdef1111111111abcdef',
        password: 'ThirdPassword123!'
      };

      // 添加三个钱包
      await walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password);
      await walletManager.addWallet(wallet2.address, wallet2.privateKey, wallet2.password);
      await walletManager.addWallet(wallet3.address, wallet3.privateKey, wallet3.password);

      // 验证所有钱包
      const wallets = await walletManager.listWallets();
      expect(wallets).toHaveLength(3);

      // 验证每个钱包的私钥
      const key1 = await walletManager.getDecryptedKey(testWallet.address, testWallet.password);
      const key2 = await walletManager.getDecryptedKey(wallet2.address, wallet2.password);
      const key3 = await walletManager.getDecryptedKey(wallet3.address, wallet3.password);

      expect(key1.toString('utf8')).toBe(testWallet.privateKey);
      expect(key2.toString('utf8')).toBe(wallet2.privateKey);
      expect(key3.toString('utf8')).toBe(wallet3.privateKey);

      // wipe buffers
      key1.fill(0);
      key2.fill(0);
      key3.fill(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // 关闭数据库以模拟错误
      await db.close();

      await expect(
        walletManager.addWallet(testWallet.address, testWallet.privateKey, testWallet.password)
      ).rejects.toThrow();
    });

    it('should validate inputs consistently', async () => {
      const invalidInputs = [
        { address: '', privateKey: testWallet.privateKey, password: testWallet.password },
        { address: 'invalid', privateKey: testWallet.privateKey, password: testWallet.password },
        { address: testWallet.address, privateKey: '', password: testWallet.password },
        { address: testWallet.address, privateKey: 'invalid', password: testWallet.password },
        { address: testWallet.address, privateKey: testWallet.privateKey, password: 'weak' }
      ];

      for (const input of invalidInputs) {
        await expect(
          walletManager.addWallet(input.address, input.privateKey, input.password)
        ).rejects.toThrow();
      }
    });
  });
});