import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoUtils, IEncryptionResult, IEncryptedKeyFile } from '../../../src/utils/CryptoUtils';

describe('CryptoUtils', () => {
  const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const testPassword = 'TestPassword123!';
  const weakPassword = 'weak';

  describe('Password Validation', () => {
    it('should validate strong password', () => {
      const result = CryptoUtils.validatePassword(testPassword);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const result = CryptoUtils.validatePassword(weakPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require minimum 12 characters', () => {
      const result = CryptoUtils.validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('密码长度必须至少12个字符');
    });

    it('should require lowercase letters', () => {
      const result = CryptoUtils.validatePassword('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('密码必须包含小写字母');
    });

    it('should require uppercase letters', () => {
      const result = CryptoUtils.validatePassword('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('密码必须包含大写字母');
    });

    it('should require numbers', () => {
      const result = CryptoUtils.validatePassword('NoNumbersHere!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('密码必须包含数字');
    });

    it('should require special characters', () => {
      const result = CryptoUtils.validatePassword('NoSpecialChars123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('密码必须包含特殊字符');
    });
  });

  describe('Secure Key Generation', () => {
    it('should generate random secure keys', () => {
      const key1 = CryptoUtils.generateSecureKey();
      const key2 = CryptoUtils.generateSecureKey();
      
      expect(key1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(key2).toHaveLength(64);
      expect(key1).not.toBe(key2); // Should be different
      expect(key1).toMatch(/^[0-9a-f]+$/); // Should be hex
    });
  });

  describe('AES-256-GCM Encryption/Decryption', () => {
    let encryptionResult: IEncryptionResult;

    beforeEach(async () => {
      encryptionResult = CryptoUtils.encryptPrivateKey(testPrivateKey, testPassword);
    });

    it('should encrypt private key successfully', () => {
      expect(encryptionResult.encrypted).toBeDefined();
      expect(encryptionResult.iv).toBeDefined();
      expect(encryptionResult.salt).toBeDefined();
      expect(encryptionResult.authTag).toBeDefined();
      
      // Should be base64 encoded
      expect(encryptionResult.encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(encryptionResult.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(encryptionResult.salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(encryptionResult.authTag).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should decrypt private key successfully', () => {
      const decrypted = CryptoUtils.decryptPrivateKey(encryptionResult, testPassword);
      expect(decrypted.toString('utf8')).toBe(testPrivateKey);
      decrypted.fill(0);
    });

    it('should fail decryption with wrong password', () => {
      expect(() => {
        CryptoUtils.decryptPrivateKey(encryptionResult, 'wrong-password');
      }).toThrow();
    });

    it('should fail encryption with weak password', () => {
      expect(() => {
        CryptoUtils.encryptPrivateKey(testPrivateKey, 'weak');
      }).toThrow('密码强度不足');
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const result1 = CryptoUtils.encryptPrivateKey(testPrivateKey, testPassword);
      const result2 = CryptoUtils.encryptPrivateKey(testPrivateKey, testPassword);
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });
  });

  describe('Encrypted Key File Format', () => {
    let encryptionResult: IEncryptionResult;

    beforeEach(() => {
      encryptionResult = CryptoUtils.encryptPrivateKey(testPrivateKey, testPassword);
    });

    it('should create valid encrypted key file format', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      expect(keyFile.version).toBe('1.0');
      expect(keyFile.algorithm).toBe('aes-256-gcm');
      expect(keyFile.keyDerivation.iterations).toBe(100000);
      expect(keyFile.checksum).toBeDefined();
    });

    it('should validate encrypted key file successfully', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      expect(CryptoUtils.validateEncryptedKeyFile(keyFile)).toBe(true);
    });

    it('should reject invalid file format version', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      const invalidFile = { ...keyFile, version: '2.0' };
      expect(CryptoUtils.validateEncryptedKeyFile(invalidFile)).toBe(false);
    });

    it('should reject invalid algorithm', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      const invalidFile = { ...keyFile, algorithm: 'aes-128-cbc' };
      expect(CryptoUtils.validateEncryptedKeyFile(invalidFile)).toBe(false);
    });

    it('should reject low iteration count', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      const invalidFile = { ...keyFile, keyDerivation: { ...keyFile.keyDerivation, iterations: 1000 } };
      expect(CryptoUtils.validateEncryptedKeyFile(invalidFile)).toBe(false);
    });

    it('should reject corrupted checksum', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      const invalidFile = { ...keyFile, checksum: 'invalidchecksum' };
      expect(CryptoUtils.validateEncryptedKeyFile(invalidFile)).toBe(false);
    });

    it('should extract encryption result from valid file', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      const extracted = CryptoUtils.extractEncryptionResult(keyFile);
      expect(extracted).toEqual(encryptionResult);
    });

    it('should fail to extract from invalid file', () => {
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptionResult);
      const invalidFile = { ...keyFile, checksum: 'invalidchecksum' };
      expect(() => {
        CryptoUtils.extractEncryptionResult(invalidFile);
      }).toThrow();
    });
  });

  describe('Security Utilities', () => {
    it('should securely compare equal strings', () => {
      expect(CryptoUtils.secureCompareStrings('abc', 'abc')).toBe(true);
    });

    it('should securely compare different strings', () => {
      expect(CryptoUtils.secureCompareStrings('abc', 'def')).toBe(false);
    });

    it('should securely compare strings of different lengths', () => {
      expect(CryptoUtils.secureCompareStrings('abc', 'abcd')).toBe(false);
    });
  });

  describe('End-to-End Encryption Workflow', () => {
    it('should complete full encryption/decryption workflow', () => {
      // 1. Define inputs
      const password = 'MySecurePassword123!';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // 2. Encrypt
      const encryptedResult = CryptoUtils.encryptPrivateKey(privateKey, password);

      // 3. Create file format
      const keyFile = CryptoUtils.createEncryptedKeyFile(encryptedResult);

      // 4. Validate file
      expect(CryptoUtils.validateEncryptedKeyFile(keyFile)).toBe(true);

      // 5. Decrypt
      const extractedResult = CryptoUtils.extractEncryptionResult(keyFile);
      const decryptedKey = CryptoUtils.decryptPrivateKey(extractedResult, password);
      
      // 6. Verify result
      expect(decryptedKey.toString('utf8')).toBe(privateKey);
      decryptedKey.fill(0);
    });

    it('should handle multiple encryption cycles', () => {
      const password = 'AnotherPassword123!@#';
      const privateKey = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';

      for (let i = 0; i < 5; i++) {
        const encrypted = CryptoUtils.encryptPrivateKey(privateKey, password);
        const keyFile = CryptoUtils.createEncryptedKeyFile(encrypted);
        const extracted = CryptoUtils.extractEncryptionResult(keyFile);
        const decrypted = CryptoUtils.decryptPrivateKey(extracted, password);
        
        expect(decrypted.toString('utf8')).toBe(privateKey);
        decrypted.fill(0);
      }
    });
  });
});