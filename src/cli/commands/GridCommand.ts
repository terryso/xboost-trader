import { Command } from 'commander';
import { StrategyController } from '../../controllers/StrategyController';
import { StrategyEngine } from '../../services/StrategyEngine';
import { RiskManager } from '../../services/RiskManager';
import { StrategyRepository } from '../../repositories/StrategyRepository';
import { DatabaseConnection } from '../../utils/DatabaseConnection';
import { testDatabaseConfig } from '../../config/database.config';

/**
 * Sets up the 'grid' command and its subcommands.
 * @param program The commander program instance.
 */
export function setupGridCommand(program: Command): void {
  const gridCommand = program
    .command('grid')
    .description('Manage grid trading strategies');

  gridCommand
    .command('create')
    .description('Create a new grid strategy')
    .action(async () => {
      // This is a temporary, manual dependency injection for the refactoring.
      // In the future, this will be handled by the ServiceContainer.
      const db = new DatabaseConnection(testDatabaseConfig);
      await db.initialize();
      const strategyRepo = new StrategyRepository(db);
      const riskManager = new RiskManager(); // Assuming RiskManager has a default constructor for now
      const strategyEngine = new StrategyEngine(strategyRepo, riskManager);
      const strategyController = new StrategyController(strategyEngine, riskManager);

      // The CLI command's only job is to parse inputs and call the controller.
      await strategyController.createStrategy({}); // Passing an empty config for now
    });

  // Other grid subcommands (start, stop, list) would be added here.
}
