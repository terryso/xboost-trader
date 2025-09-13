import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface ConsoleOptions {
  verbose?: boolean;
  quiet?: boolean;
  colors?: boolean;
  timestamp?: boolean;
  logLevel?: LogLevel;
}

export class ColorConsole {
  private options: Required<ConsoleOptions>;

  constructor(options: ConsoleOptions = {}) {
    this.options = {
      verbose: options.verbose ?? false,
      quiet: options.quiet ?? false,
      colors: options.colors ?? true,
      timestamp: options.timestamp ?? false,
      logLevel: options.logLevel ?? LogLevel.INFO,
    };

    // Disable colors if not supported or explicitly disabled
    if (!this.options.colors || !chalk.supportsColor) {
      chalk.level = 0;
    }
  }

  // Basic output methods
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage('INFO', message, chalk.blue);
      console.log(formatted, ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage('SUCCESS', message, chalk.green);
      console.log(formatted, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage('WARN', message, chalk.yellow);
      console.warn(formatted, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage('ERROR', message, chalk.red);
      console.error(formatted, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage('DEBUG', message, chalk.gray);
      console.log(formatted, ...args);
    }
  }

  // Specialized output methods
  title(text: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const line = '═'.repeat(Math.min(text.length + 4, 80));
      console.log(chalk.bold.cyan(line));
      console.log(chalk.bold.cyan(`  ${text}  `));
      console.log(chalk.bold.cyan(line));
    }
  }

  section(text: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const line = '─'.repeat(Math.min(text.length + 2, 60));
      console.log(chalk.bold.white(`\n${text}`));
      console.log(chalk.gray(line));
    }
  }

  step(stepNumber: number, description: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const step = chalk.bold.blue(`[${stepNumber}]`);
      console.log(`${step} ${description}`);
    }
  }

  bullet(text: string, color: keyof typeof chalk = 'white'): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const bullet = chalk.gray('•');
      const colorFn = chalk[color] as any;
      console.log(`  ${bullet} ${colorFn(text)}`);
    }
  }

  // Status indicators
  statusUpdate(message: string, status: 'pending' | 'success' | 'error' | 'warning'): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const icons = {
        pending: chalk.yellow('⏳'),
        success: chalk.green('✅'),
        error: chalk.red('❌'),
        warning: chalk.yellow('⚠️'),
      };

      console.log(`${icons[status]} ${message}`);
    }
  }

  progress(current: number, total: number, description?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const percentage = Math.round((current / total) * 100);
      const progressBar = this.createProgressBar(current, total);
      const desc = description ? ` ${description}` : '';

      process.stdout.write(`\r${progressBar} ${percentage}%${desc}`);

      if (current === total) {
        process.stdout.write('\n');
      }
    }
  }

  // Trading-specific output methods
  priceChange(symbol: string, price: number, change: number): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const changeColor = change >= 0 ? chalk.green : chalk.red;
      const changeSign = change >= 0 ? '+' : '';
      const changeText = changeColor(`${changeSign}${change.toFixed(2)}%`);

      console.log(`${chalk.bold(symbol)}: $${price.toFixed(6)} (${changeText})`);
    }
  }

  trade(action: 'BUY' | 'SELL', amount: number, price: number, symbol: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const actionColor = action === 'BUY' ? chalk.green : chalk.red;
      const actionText = actionColor(action);

      console.log(`${actionText} ${amount} ${symbol} @ $${price.toFixed(6)}`);
    }
  }

  strategy(strategyId: string, status: string, profit?: number): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const statusColors = {
        active: chalk.green,
        paused: chalk.yellow,
        stopped: chalk.gray,
        error: chalk.red,
      };

      const statusColor = statusColors[status as keyof typeof statusColors] || chalk.white;
      let message = `Strategy ${chalk.bold(strategyId)}: ${statusColor(status)}`;

      if (profit !== undefined) {
        const profitColor = profit >= 0 ? chalk.green : chalk.red;
        const profitSign = profit >= 0 ? '+' : '';
        message += ` | P&L: ${profitColor(`${profitSign}$${profit.toFixed(2)}`)}`;
      }

      console.log(message);
    }
  }

  // Interactive prompts
  prompt(question: string): void {
    const formatted = chalk.cyan(`❓ ${question}`);
    process.stdout.write(formatted + ' ');
  }

  confirmation(question: string): void {
    const formatted = chalk.yellow(`⚠️  ${question} (y/N)`);
    process.stdout.write(formatted + ' ');
  }

  // Formatting utilities
  highlight(text: string): string {
    return chalk.bold.yellow(text);
  }

  dim(text: string): string {
    return chalk.gray(text);
  }

  code(text: string): string {
    return chalk.gray.bgBlack(` ${text} `);
  }

  link(text: string, url?: string): string {
    const linkText = url ? `${text} (${url})` : text;
    return chalk.blue.underline(linkText);
  }

  // Box drawing
  box(content: string[], title?: string, style: 'single' | 'double' = 'single'): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const chars =
      style === 'double'
        ? { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' }
        : { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' };

    const maxWidth =
      Math.max(
        ...(title ? [title.length] : []),
        ...content.map(line => line.replace(/\x1b\[[0-9;]*m/g, '').length)
      ) + 4;

    // Top border
    if (title) {
      const titlePadding = Math.max(0, maxWidth - title.length - 2);
      const leftPad = Math.floor(titlePadding / 2);
      const rightPad = titlePadding - leftPad;

      console.log(
        chars.tl + chars.h.repeat(leftPad) + ` ${title} ` + chars.h.repeat(rightPad) + chars.tr
      );
    } else {
      console.log(chars.tl + chars.h.repeat(maxWidth) + chars.tr);
    }

    // Content
    content.forEach(line => {
      const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      const padding = Math.max(0, maxWidth - cleanLine.length - 2);
      console.log(`${chars.v} ${line}${' '.repeat(padding)} ${chars.v}`);
    });

    // Bottom border
    console.log(chars.bl + chars.h.repeat(maxWidth) + chars.br);
  }

  // Clear and cursor control
  clear(): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.clear();
    }
  }

  newLine(count: number = 1): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log('\n'.repeat(count - 1));
    }
  }

  // Configuration methods
  setOptions(options: Partial<ConsoleOptions>): void {
    this.options = { ...this.options, ...options };

    if (!this.options.colors || !chalk.supportsColor) {
      chalk.level = 0;
    }
  }

  enableColors(): void {
    this.options.colors = true;
    chalk.level = chalk.supportsColor ? chalk.supportsColor.level : 1;
  }

  disableColors(): void {
    this.options.colors = false;
    chalk.level = 0;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.options.quiet && level < LogLevel.ERROR) {
      return false;
    }

    if (!this.options.verbose && level === LogLevel.DEBUG) {
      return false;
    }

    return level >= this.options.logLevel;
  }

  private formatMessage(level: string, message: string, colorFn: any): string {
    let formatted = message;

    if (this.options.colors) {
      formatted = colorFn(message);
    }

    if (this.options.timestamp) {
      const timestamp = new Date().toISOString();
      const timestampFormatted = this.options.colors
        ? chalk.gray(`[${timestamp}]`)
        : `[${timestamp}]`;
      formatted = `${timestampFormatted} ${formatted}`;
    }

    return formatted;
  }

  private createProgressBar(current: number, total: number, width: number = 20): string {
    const progress = Math.min(current / total, 1);
    const filled = Math.round(progress * width);
    const empty = width - filled;

    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);

    if (this.options.colors) {
      return chalk.green(filledBar) + chalk.gray(emptyBar);
    }

    return filledBar + emptyBar;
  }
}
