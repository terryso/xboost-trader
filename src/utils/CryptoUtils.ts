import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from 'crypto';

/**
 * 加密结果接口 - 包含加密数据和验证信息
 */
export interface IEncryptionResult {
  encrypted: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt for PBKDF2
  authTag: string; // Base64 encoded authentication tag
}

/**
 * 私钥加密存储格式接口
 */
export interface IEncryptedKeyFile {
  version: string;
  algorithm: string;
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
  keyDerivation: {
    algorithm: string;
    iterations: number;
  };
  checksum: string;
}

/**
 * 密码验证结果接口
 */
export interface IPasswordValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * CryptoUtils - AES-256-GCM加密工具类
 * 提供军用级安全的私钥加密存储功能
 */
export class CryptoUtils {
  // 安全常量配置
  private static readonly AES_ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_DERIVATION_ALGORITHM = 'pbkdf2';
  private static readonly HASH_ALGORITHM = 'sha256';
  private static readonly IV_LENGTH = 16; // 128 bits for AES-256-GCM
  private static readonly SALT_LENGTH = 32; // 256 bits salt
  private static readonly PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
  private static readonly FILE_FORMAT_VERSION = '1.0';
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits authentication tag

  /**
   * 生成安全的随机字节
   * @param length 字节长度
   * @returns 随机字节Buffer
   */
  private static generateSecureRandom(length: number): Buffer {
    try {
      return randomBytes(length);
    } catch (error) {
      throw new Error(`Failed to generate secure random bytes: ${error}`);
    }
  }

  /**
   * 使用PBKDF2派生密钥
   * @param password 主密码
   * @param salt 盐值
   * @param iterations 迭代次数
   * @returns 派生的32字节密钥
   */
  private static deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
    try {
      return pbkdf2Sync(password, salt, iterations, 32, this.HASH_ALGORITHM);
    } catch (error) {
      throw new Error(`Key derivation failed: ${error}`);
    }
  }

  /**
   * 生成安全的随机密钥（用于测试和开发）
   * @returns 32字节随机密钥的十六进制字符串
   */
  public static generateSecureKey(): string {
    return this.generateSecureRandom(32).toString('hex');
  }

  /**
   * 验证密码强度
   * @param password 待验证密码
   * @returns 验证结果
   */
  public static validatePassword(password: string): IPasswordValidation {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('密码长度必须至少12个字符');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * AES-256-GCM加密私钥
   * @param privateKey 私钥明文
   * @param password 主密码
   * @returns 加密结果
   */
  public static encryptPrivateKey(privateKey: string, password: string): IEncryptionResult {
    const privateKeyBuf = Buffer.from(privateKey, 'utf8');
    try {
      // 验证密码强度
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(`密码强度不足: ${passwordValidation.errors.join(', ')}`);
      }

      // 生成随机salt和IV
      const salt = this.generateSecureRandom(this.SALT_LENGTH);
      const iv = this.generateSecureRandom(this.IV_LENGTH);

      // 派生密钥
      const key = this.deriveKey(password, salt, this.PBKDF2_ITERATIONS);

      // 创建加密器 (使用AES-256-GCM)
      const cipher = createCipheriv(this.AES_ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('XBoost-Trader-PrivateKey')); // Additional authenticated data

      // 加密私钥
      const encrypted = Buffer.concat([cipher.update(privateKeyBuf), cipher.final()]);

      // 获取认证标签
      const authTag = cipher.getAuthTag();

      // 清零敏感数据
      key.fill(0);

      return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        authTag: authTag.toString('base64')
      };
    } catch (error) {
      throw new Error(`私钥加密失败: ${error}`);
    } finally {
      // 确保私钥缓冲区总是被清零
      privateKeyBuf.fill(0);
    }
  }

  /**
   * AES-256-GCM解密私钥
   * @param encryptionResult 加密结果
   * @param password 主密码
   * @returns 解密的私钥明文
   */
  public static decryptPrivateKey(encryptionResult: IEncryptionResult, password: string): Buffer {
    const salt = Buffer.from(encryptionResult.salt, 'base64');
    const key = this.deriveKey(password, salt, this.PBKDF2_ITERATIONS);
    let decrypted: Buffer | null = null;
    try {
      // 解码base64数据
      const iv = Buffer.from(encryptionResult.iv, 'base64');
      const authTag = Buffer.from(encryptionResult.authTag, 'base64');
      const encrypted = Buffer.from(encryptionResult.encrypted, 'base64');

      // 创建解密器
      const decipher = createDecipheriv(this.AES_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from('XBoost-Trader-PrivateKey')); // 必须匹配加密时的AAD

      // 解密私钥
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted;
    } catch (error) {
      // 如果解密失败，确保部分解密的数据也被清除
      if (decrypted) {
        decrypted.fill(0);
      }
      throw new Error(`私钥解密失败，可能是密码错误或数据损坏: ${error}`);
    } finally {
      // 清零派生的密钥
      key.fill(0);
    }
  }

  /**
   * 创建加密文件格式
   * @param encryptionResult 加密结果
   * @returns 完整的加密文件格式
   */
  public static createEncryptedKeyFile(encryptionResult: IEncryptionResult): IEncryptedKeyFile {
    // 计算数据完整性校验和
    const dataForChecksum = `${encryptionResult.encrypted}${encryptionResult.iv}${encryptionResult.salt}${encryptionResult.authTag}`;
    const checksum = createHash('sha256').update(dataForChecksum).digest('hex');

    return {
      version: this.FILE_FORMAT_VERSION,
      algorithm: this.AES_ALGORITHM,
      encrypted: encryptionResult.encrypted,
      iv: encryptionResult.iv,
      salt: encryptionResult.salt,
      authTag: encryptionResult.authTag,
      keyDerivation: {
        algorithm: this.KEY_DERIVATION_ALGORITHM,
        iterations: this.PBKDF2_ITERATIONS
      },
      checksum
    };
  }

  /**
   * 验证加密文件格式和完整性
   * @param keyFile 加密文件数据
   * @returns 是否验证通过
   */
  public static validateEncryptedKeyFile(keyFile: IEncryptedKeyFile): boolean {
    try {
      // 检查版本兼容性
      if (keyFile.version !== this.FILE_FORMAT_VERSION) {
        throw new Error(`不支持的文件格式版本: ${keyFile.version}`);
      }

      // 检查加密算法
      if (keyFile.algorithm !== this.AES_ALGORITHM) {
        throw new Error(`不支持的加密算法: ${keyFile.algorithm}`);
      }

      // 检查密钥派生配置
      if (keyFile.keyDerivation.algorithm !== this.KEY_DERIVATION_ALGORITHM) {
        throw new Error(`不支持的密钥派生算法: ${keyFile.keyDerivation.algorithm}`);
      }

      if (keyFile.keyDerivation.iterations < 100000) {
        throw new Error(`密钥派生迭代次数过低: ${keyFile.keyDerivation.iterations}`);
      }

      // 验证数据完整性
      const dataForChecksum = `${keyFile.encrypted}${keyFile.iv}${keyFile.salt}${keyFile.authTag}`;
      const calculatedChecksum = createHash('sha256').update(dataForChecksum).digest('hex');

      if (!timingSafeEqual(Buffer.from(keyFile.checksum, 'hex'), Buffer.from(calculatedChecksum, 'hex'))) {
        throw new Error('文件完整性验证失败');
      }

      return true;
    } catch (error) {
      console.error(`加密文件验证失败: ${error}`);
      return false;
    }
  }

  /**
   * 从加密文件格式提取加密结果
   * @param keyFile 加密文件数据
   * @returns 加密结果
   */
  public static extractEncryptionResult(keyFile: IEncryptedKeyFile): IEncryptionResult {
    if (!this.validateEncryptedKeyFile(keyFile)) {
      throw new Error('加密文件验证失败，无法提取数据');
    }

    return {
      encrypted: keyFile.encrypted,
      iv: keyFile.iv,
      salt: keyFile.salt,
      authTag: keyFile.authTag
    };
  }



  /**
   * 安全比较两个字符串（防止时序攻击）
   * @param a 字符串A
   * @param b 字符串B
   * @returns 是否相等
   */
  public static secureCompareStrings(a: string, b: string): boolean {
    try {
      const bufferA = Buffer.from(a, 'utf8');
      const bufferB = Buffer.from(b, 'utf8');

      // 如果长度不同，仍然执行比较以防止长度信息泄露
      const lengthsMatch = bufferA.length === bufferB.length;
      const maxLength = Math.max(bufferA.length, bufferB.length);

      // 创建相同长度的buffer进行比较
      const paddedA = Buffer.alloc(maxLength);
      const paddedB = Buffer.alloc(maxLength);

      bufferA.copy(paddedA);
      bufferB.copy(paddedB);

      return lengthsMatch && timingSafeEqual(paddedA, paddedB);
    } catch (error) {
      return false;
    }
  }
}