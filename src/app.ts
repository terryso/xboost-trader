import { Command } from 'commander';

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('xboost')
    .description('XBoost Trader - Advanced Grid Trading Bot for OKX DEX')
    .version('0.1.0')
    .option('-c, --config <path>', 'configuration file path', './config/config.yaml')
    .option('-v, --verbose', 'enable verbose logging')
    .option('-q, --quiet', 'suppress non-error output')
    .option('--log-file <path>', 'specify log file path');

  // Add init command
  program
    .command('init')
    .description('initialize configuration for XBoost Trader')
    .action(() => {
      console.log('Initializing XBoost Trader configuration...');
    });

  await program.parseAsync(process.argv);
}
