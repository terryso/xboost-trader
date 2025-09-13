import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { ConfigManager } from './services/ConfigManager';
import { DatabaseConnection } from './utils/DatabaseConnection';
import { testDatabaseConfig } from './config/database.config'; // Using test config for now
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

export async function main(): Promise<void> {
  const program = new Command();

  const db = new DatabaseConnection(testDatabaseConfig);
  await db.initialize();

  const configManager = new ConfigManager(db);

  program
    .name('xboost')
    .description('XBoost Trader - Advanced Grid Trading Bot for OKX DEX')
    .version('0.1.0')
    .exitOverride()
    .option('-c, --config <path>', 'configuration file path', './config/config.yaml')
    .option('-v, --verbose', 'enable verbose logging')
    .option('-q, --quiet', 'suppress non-error output')
    .option('--log-file <path>', 'specify log file path');

  program.hook('preAction', async (thisCommand, actionCommand) => {
    const configPath = thisCommand.opts().config;
    await configManager.loadConfig(configPath);
  });

  // Add init command
  program
    .command('init')
    .description('initialize configuration for XBoost Trader')
    .action(() => {
      console.log('Initializing XBoost Trader configuration...');
    });

  const configCommand = program.command('config').description('Manage configuration and secrets');

  configCommand
    .command('set-secret')
    .description('Set a secret in the secure config')
    .argument('<key>', 'Secret key')
    .argument('<value>', 'Secret value')
    .action(async (key, value) => {
      const rl = readline.createInterface({ input, output });
      const password = await rl.question('Enter master password: ');
      rl.close();
      await configManager.setSecret(key, value, password);
      console.log(`Secret '${key}' has been set.`);
    });

  configCommand
    .command('get-secret')
    .description('Get a secret from the secure config')
    .argument('<key>', 'Secret key')
    .action(async (key) => {
      const rl = readline.createInterface({ input, output });
      const password = await rl.question('Enter master password: ');
      rl.close();
      const value = await configManager.getSecret(key, password);
      if (value) {
        console.log(`Secret '${key}': ${value}`);
      } else {
        console.log(`Secret '${key}' not found.`);
      }
    });

  await program.parseAsync(process.argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}