/**
 * Test Setup File
 * This file is executed before each test suite runs
 */

import type { BeforeEach, AfterEach } from 'vitest';

// Global test environment setup
beforeEach((): void => {
  // Reset environment variables for each test
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = ':memory:';
  process.env.LOG_LEVEL = 'silent';
  
  // Clear any cached modules (Vitest handles this automatically)
});

afterEach((): void => {
  // Cleanup after each test
  // This ensures tests don't interfere with each other
});

// Global test utilities
declare global {
  // Add any global test utilities here
  namespace Vi {
    interface TestContext {
      // Custom test context properties can be defined here
    }
  }
}