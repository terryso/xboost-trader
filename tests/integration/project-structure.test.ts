/**
 * Project Structure Integration Tests
 * Validates that the project structure meets requirements
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();

describe('Project Structure Integration Tests', (): void => {
  describe('Configuration Files', (): void => {
    it('should have package.json with correct structure', (): void => {
      const packagePath = join(PROJECT_ROOT, 'package.json');
      expect(existsSync(packagePath)).toBe(true);
      
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      
      // Validate core package.json properties
      expect(packageJson.name).toBe('xboost-trader');
      expect(packageJson.type).toBe('module');
      expect(packageJson.engines?.node).toBe('>=18.0.0');
      
      // Validate required scripts
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('lint');
      expect(packageJson.scripts).toHaveProperty('format');
      
      // Validate required dependencies
      expect(packageJson.dependencies).toHaveProperty('commander');
      expect(packageJson.dependencies).toHaveProperty('sqlite3');
      expect(packageJson.dependencies).toHaveProperty('winston');
      
      // Validate dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('vitest');
      expect(packageJson.devDependencies).toHaveProperty('eslint');
      expect(packageJson.devDependencies).toHaveProperty('prettier');
    });
  });
});