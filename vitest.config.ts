import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // File patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '**/*.d.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'dist/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Core trading logic must reach 100% coverage
        'src/services/strategy-engine.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/services/risk-manager.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/utils/grid-calculator.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        }
      }
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Setup files
    setupFiles: ['tests/helpers/test-setup.ts'],
    
    // Path resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@tests': path.resolve(__dirname, './tests')
      }
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    
    // Watch mode
    watch: false,
    
    // Parallel execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false
      }
    },
    
    // Database testing configuration
    env: {
      DATABASE_PATH: ':memory:',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent'
    }
  }
});