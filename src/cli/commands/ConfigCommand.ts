import { Command } from 'commander';
import { ConfigController } from '../../controllers/ConfigController';
import { ConfigManager } from '../../services/ConfigManager';
import { DatabaseConnection } from '../../utils/DatabaseConnection';
import { testDatabaseConfig } from '../../config/database.config';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

/**
 * Sets up the 'config' command and its subcommands.
 * @param program The commander program instance.
 */
export function setupConfigCommand(program: Command): void {
  const configCommand = program
    .command('config')
    .description('Manage configuration and secrets');

  // This is a temporary, manual dependency injection for the refactoring.
  // In the future, this will be handled by the ServiceContainer.
  const getController = async () => {
    const db = new DatabaseConnection(testDatabaseConfig);
    await db.initialize();
    const configManager = new ConfigManager(db);
    return new ConfigController(configManager);
  }

  configCommand
    .command('set-secret')
    .description('Set a secret in the secure config')
    .argument('<key>', 'Secret key')
    .argument('<value>', 'Secret value')
    .action(async (key, value) => {
      const controller = await getController();
      const rl = readline.createInterface({ input, output });
      const password = await rl.question('Enter master password: ');
      rl.close();
      await controller.setSecret(key, value, password);
    });

  configCommand
    .command('get-secret')
    .description('Get a secret from the secure config')
    .argument('<key>', 'Secret key')
    .action(async (key) => {
      const controller = await getController();
      const rl = readline.createInterface({ input, output });
      const password = await rl.question('Enter master password: ');
      rl.close();
      await controller.getSecret(key, password);
    });
}
