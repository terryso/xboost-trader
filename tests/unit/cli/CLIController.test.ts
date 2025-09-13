import { describe, it, expect } from 'vitest';
import { CLIController } from '../../../src/cli/CLIController.js';

describe('CLIController', () => {
  it('should export CLIController class', () => {
    expect(typeof CLIController).toBe('function');
  });

  it('should have registerCommands method', () => {
    const controller = new CLIController();
    expect(typeof controller.registerCommands).toBe('function');
  });
});