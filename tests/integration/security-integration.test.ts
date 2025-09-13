import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const SECURE_CONFIG_PATH = './data/secure.conf.json';

describe('Security Integration Test', () => {

  const cleanup = () => {
    if (existsSync(SECURE_CONFIG_PATH)) {
      unlinkSync(SECURE_CONFIG_PATH);
    }
  };

  beforeEach(() => {
    cleanup();
  });

  afterAll(() => {
    cleanup();
  });

  it('should run the init command successfully', async () => {
    try {
        const { stdout, stderr } = await execAsync('tsx src/app.ts init');
        if (stderr) console.error("INIT STDERR:", stderr);
        expect(stdout).toContain('Initializing XBoost Trader configuration...');
    } catch (e) {
        console.error("EXEC ASYNC ERROR:", e);
        throw e;
    }
  });

  it('should set a secret, encrypt it, save it, load it, decrypt it, and retrieve it via CLI commands', async () => {
    const masterPassword = 'MySecurePassword123!\n'; // \n to simulate pressing enter
    const secretKey = 'myApiKey';
    const secretValue = '12345-abcde-67890-fghij';

    // 1. Set the secret
    const setCommand = `tsx src/app.ts config set-secret ${secretKey} ${secretValue}`;
    const setProcess = exec(setCommand);

    let setStdout = '';
    let setStderr = '';
    setProcess.stdout?.on('data', (data) => {
      setStdout += data;
    });
    setProcess.stderr?.on('data', (data) => {
      setStderr += data;
    });

    // Provide the password to stdin
    setProcess.stdin?.write(masterPassword);
    setProcess.stdin?.end();

    await new Promise(resolve => setProcess.on('close', resolve));

    if (setStderr) {
      console.error('Set Secret STDERR:', setStderr);
    }

    expect(setStdout).toContain(`Secret '${secretKey}' has been set.`);
    expect(existsSync(SECURE_CONFIG_PATH)).toBe(true);

    // 2. Get the secret
    const getCommand = `tsx src/app.ts config get-secret ${secretKey}`;
    const getProcess = exec(getCommand);

    let getStdout = '';
    let getStderr = '';
    getProcess.stdout?.on('data', (data) => {
      getStdout += data;
    });
    getProcess.stderr?.on('data', (data) => {
      getStderr += data;
    });

    // Provide the same password to stdin
    getProcess.stdin?.write(masterPassword);
    getProcess.stdin?.end();

    await new Promise(resolve => getProcess.on('close', resolve));

    if (getStderr) {
      console.error('Get Secret STDERR:', getStderr);
    }

    expect(getStdout).toContain(`Secret '${secretKey}': ${secretValue}`);
  }, 20000); // Increase timeout for integration test
});