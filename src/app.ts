import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { setupGridCommand } from './cli/commands/GridCommand';
import { setupInitCommand } from './cli/commands/InitCommand';
import { setupConfigCommand } from './cli/commands/ConfigCommand';

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('xboost')
    .description('XBoost Trader - Advanced Grid Trading Bot for OKX DEX')
    .version('0.1.0')
    .exitOverride()
    .option('-c, --config <path>', 'configuration file path', './config/config.yaml')
    .option('-v, --verbose', 'enable verbose logging')
    .option('-q, --quiet', 'suppress non-error output')
    .option('--log-file <path>', 'specify log file path');

  // Register modular commands
  setupGridCommand(program);
  setupInitCommand(program);
  setupConfigCommand(program);

  await program.parseAsync(process.argv);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // The commander .exitOverride() will throw an error for help, version, etc.
    // We can safely ignore those.
    if (error.code !== 'commander.helpDisplayed' && error.code !== 'commander.version') {
        console.error('Unhandled error in main:', error);
        process.exit(1);
    }
  });
}