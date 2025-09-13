import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../../../src/app.js';

describe('App Entry Point', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset process.argv to clean state
    process.argv = ['node', 'app.js'];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should export a main function', async () => {
    expect(typeof main).toBe('function');
  });

  it('should create Commander program with correct configuration', async () => {
    // Mock process.exit to capture help output
    let capturedOutput = '';
    const mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      capturedOutput += chunk;
      return true;
    });
    
    process.argv = ['node', 'app.js', '--help'];
    
    await main();
    
    expect(capturedOutput).toContain('XBoost Trader');
    expect(capturedOutput).toContain('Advanced Grid Trading Bot');
    
    mockStdoutWrite.mockRestore();
  });

  it('should use CLIController for command registration', async () => {
    // This test verifies CLIController integration
    const { CLIController } = await import('../../../src/cli/CLIController.js');
    expect(typeof CLIController).toBe('function');
    
    const controller = new CLIController();
    expect(typeof controller.registerCommands).toBe('function');
  });

  it('should support global CLI options', async () => {
    let capturedOutput = '';
    const mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      capturedOutput += chunk;
      return true;
    });
    
    process.argv = ['node', 'app.js', '--help'];
    
    await main();
    
    // Check for global options in help output
    expect(capturedOutput).toContain('--config');
    expect(capturedOutput).toContain('--verbose');
    expect(capturedOutput).toContain('--quiet');
    
    mockStdoutWrite.mockRestore();
  });

  it('should validate CLI arguments', async () => {
    // Test that CLI validates arguments properly
    process.argv = ['node', 'app.js', '--config', 'valid-config.yaml'];
    
    await expect(main()).resolves.toBeUndefined();
    
    // Test should not throw for valid arguments
  });

  it('should support init command', async () => {
    let capturedOutput = '';
    const mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      capturedOutput += chunk;
      return true;
    });
    
    process.argv = ['node', 'app.js', 'init', '--help'];
    
    await main();
    
    expect(capturedOutput).toContain('init');
    expect(capturedOutput).toContain('initialize');
    
    mockStdoutWrite.mockRestore();
  });
});