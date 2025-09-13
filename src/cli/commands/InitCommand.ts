import { Command } from 'commander';

/**
 * Sets up the 'init' command.
 * @param program The commander program instance.
 */
export function setupInitCommand(program: Command): void {
  program
    .command('init')
    .description('initialize configuration for XBoost Trader')
    .action(() => {
      console.log('Initializing XBoost Trader configuration...');
    });
}
