import chalk from 'chalk';

export interface ProgressBarOptions {
  total: number;
  width?: number;
  format?: string;
  complete?: string;
  incomplete?: string;
  clear?: boolean;
  callback?: () => void;
}

export class ProgressBar {
  private current: number = 0;
  private readonly startTime: number;
  private readonly options: Required<Omit<ProgressBarOptions, 'callback'>> & {
    callback?: () => void;
  };

  constructor(options: ProgressBarOptions) {
    this.options = {
      total: options.total,
      width: options.width || 40,
      format: options.format || ':bar :percent :elapsed/:eta :current/:total',
      complete: options.complete || '█',
      incomplete: options.incomplete || '░',
      clear: options.clear || false,
      callback: options.callback,
    };

    this.startTime = Date.now();
  }

  tick(delta: number = 1, tokens?: Record<string, any>): void {
    this.current += delta;

    if (this.current > this.options.total) {
      this.current = this.options.total;
    }

    this.render(tokens);

    if (this.current >= this.options.total) {
      if (this.options.clear) {
        this.clearLine();
      } else {
        process.stdout.write('\n');
      }

      if (this.options.callback) {
        this.options.callback();
      }
    }
  }

  update(current: number, tokens?: Record<string, any>): void {
    this.current = Math.min(current, this.options.total);
    this.render(tokens);

    if (this.current >= this.options.total) {
      if (this.options.clear) {
        this.clearLine();
      } else {
        process.stdout.write('\n');
      }

      if (this.options.callback) {
        this.options.callback();
      }
    }
  }

  terminate(): void {
    if (this.options.clear) {
      this.clearLine();
    } else {
      process.stdout.write('\n');
    }
  }

  private render(tokens?: Record<string, any>): void {
    const ratio = this.current / this.options.total;
    const percent = Math.floor(ratio * 100);
    const incomplete = Math.max(0, this.options.width - Math.floor(ratio * this.options.width));
    const complete = this.options.width - incomplete;
    const elapsed = Date.now() - this.startTime;
    const eta = percent === 100 ? 0 : elapsed * (this.options.total / this.current - 1);

    const completeBar = chalk.green(this.options.complete.repeat(complete));
    const incompleteBar = chalk.gray(this.options.incomplete.repeat(incomplete));

    let str = this.options.format
      .replace(':bar', completeBar + incompleteBar)
      .replace(':current', this.current.toString())
      .replace(':total', this.options.total.toString())
      .replace(':elapsed', this.formatTime(elapsed))
      .replace(':eta', this.formatTime(eta))
      .replace(':percent', percent.toString().padStart(3) + '%')
      .replace(':rate', this.formatRate(this.current / (elapsed / 1000)));

    // Replace custom tokens
    if (tokens) {
      Object.entries(tokens).forEach(([key, value]) => {
        str = str.replace(`:${key}`, String(value));
      });
    }

    process.stdout.write('\r' + str);
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
    }
  }

  private formatRate(rate: number): string {
    if (rate < 1) {
      return rate.toFixed(2) + '/s';
    } else if (rate < 1000) {
      return Math.floor(rate) + '/s';
    } else {
      return (rate / 1000).toFixed(1) + 'k/s';
    }
  }

  private clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }
}

export class Spinner {
  private static readonly FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private currentFrame = 0;
  private message: string;

  constructor(message: string = 'Loading...') {
    this.message = message;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(Spinner.FRAMES[this.currentFrame])} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % Spinner.FRAMES.length;
    }, 100);
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    process.stdout.write('\r\x1b[K');

    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  succeed(message?: string): void {
    this.stop(chalk.green('✓ ') + (message || this.message));
  }

  fail(message?: string): void {
    this.stop(chalk.red('✗ ') + (message || this.message));
  }

  warn(message?: string): void {
    this.stop(chalk.yellow('⚠ ') + (message || this.message));
  }

  info(message?: string): void {
    this.stop(chalk.blue('ℹ ') + (message || this.message));
  }

  updateMessage(message: string): void {
    this.message = message;
  }
}

export class MultiProgressBar {
  private readonly bars: Map<string, { bar: ProgressBar; options: ProgressBarOptions }> = new Map();
  private lineCount = 0;

  addBar(name: string, options: ProgressBarOptions): void {
    const bar = new ProgressBar({
      ...options,
      clear: false, // We handle clearing ourselves
    });

    this.bars.set(name, { bar, options });
    this.lineCount++;

    // Add a new line for this progress bar
    console.log('');
  }

  updateBar(name: string, current: number, tokens?: Record<string, any>): void {
    const barData = this.bars.get(name);
    if (!barData) {
      throw new Error(`Progress bar '${name}' not found`);
    }

    // Move cursor to the correct line and update
    const barIndex = Array.from(this.bars.keys()).indexOf(name);
    const linesToMove = this.lineCount - barIndex;

    process.stdout.write(`\x1b[${linesToMove}A`); // Move cursor up
    process.stdout.write('\r\x1b[K'); // Clear line

    barData.bar.update(current, tokens);

    process.stdout.write(`\x1b[${linesToMove}B`); // Move cursor back down
  }

  removeBar(name: string): void {
    if (this.bars.has(name)) {
      this.bars.delete(name);
      this.lineCount--;
    }
  }

  clear(): void {
    for (let i = 0; i < this.lineCount; i++) {
      process.stdout.write('\x1b[1A\x1b[K'); // Move up and clear line
    }
    this.bars.clear();
    this.lineCount = 0;
  }
}

// Utility functions for common progress patterns
export function createLoadingSpinner(message: string): Spinner {
  return new Spinner(message);
}

export function createSimpleProgress(total: number, format?: string): ProgressBar {
  return new ProgressBar({
    total,
    format: format || ':bar :percent (:current/:total)',
  });
}

export function createDetailedProgress(total: number, description: string): ProgressBar {
  return new ProgressBar({
    total,
    format: `:bar :percent | :current/:total | :elapsed/:eta | ${description}`,
    width: 30,
  });
}

export async function withProgress<T>(
  promise: Promise<T>,
  message: string,
  onProgress?: (progress: number) => void
): Promise<T> {
  const spinner = createLoadingSpinner(message);
  spinner.start();

  try {
    const result = await promise;
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
