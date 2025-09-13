import chalk from 'chalk';

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
}

export interface TableOptions {
  title?: string;
  border?: boolean;
  colors?: boolean;
  maxWidth?: number;
  compact?: boolean;
}

export class TableBuilder {
  private readonly columns: TableColumn[] = [];
  private readonly rows: Record<string, any>[] = [];
  private readonly options: TableOptions = {
    border: true,
    colors: true,
    maxWidth: 120,
    compact: false,
  };

  constructor(options?: Partial<TableOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  addColumn(column: TableColumn): TableBuilder {
    this.columns.push(column);
    return this;
  }

  addColumns(columns: TableColumn[]): TableBuilder {
    this.columns.push(...columns);
    return this;
  }

  addRow(row: Record<string, any>): TableBuilder {
    this.rows.push(row);
    return this;
  }

  addRows(rows: Record<string, any>[]): TableBuilder {
    this.rows.push(...rows);
    return this;
  }

  build(): string {
    if (this.columns.length === 0) {
      return this.options.colors ? chalk.yellow('No columns defined') : 'No columns defined';
    }

    if (this.rows.length === 0) {
      return this.options.colors ? chalk.gray('No data to display') : 'No data to display';
    }

    this.calculateColumnWidths();
    const lines: string[] = [];

    // Add title if provided
    if (this.options.title) {
      lines.push(this.formatTitle());
      lines.push('');
    }

    // Add header
    if (this.options.border) {
      lines.push(this.formatBorderLine());
    }
    lines.push(this.formatHeaderRow());

    if (this.options.border) {
      lines.push(this.formatBorderLine());
    } else {
      lines.push(this.formatSeparatorLine());
    }

    // Add data rows
    this.rows.forEach((row, index) => {
      lines.push(this.formatDataRow(row));

      if (!this.options.compact && index < this.rows.length - 1) {
        lines.push(this.formatSeparatorLine());
      }
    });

    // Add bottom border
    if (this.options.border) {
      lines.push(this.formatBorderLine());
    }

    return lines.join('\n');
  }

  // Quick table builders for common use cases
  static simple(data: Record<string, any>[], columns?: string[]): string {
    if (data.length === 0) {
      return chalk.gray('No data to display');
    }

    const builder = new TableBuilder({ border: false, compact: true });
    const keys = columns || Object.keys(data[0]);

    keys.forEach(key => {
      builder.addColumn({
        key,
        title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      });
    });

    builder.addRows(data);
    return builder.build();
  }

  static keyValue(data: Record<string, any>, title?: string): string {
    const builder = new TableBuilder({ title, border: true });

    builder.addColumns([
      { key: 'property', title: 'Property', width: 20 },
      { key: 'value', title: 'Value', width: 40 },
    ]);

    const rows = Object.entries(data).map(([key, value]) => ({
      property: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: String(value),
    }));

    builder.addRows(rows);
    return builder.build();
  }

  static status(items: Array<{ name: string; status: string; details?: string }>): string {
    const builder = new TableBuilder({ border: true });

    builder.addColumns([
      { key: 'name', title: 'Item', width: 25 },
      {
        key: 'status',
        title: 'Status',
        width: 15,
        format: (value: string) => {
          if (!chalk.level) return value;

          switch (value.toLowerCase()) {
            case 'active':
            case 'running':
            case 'success':
              return chalk.green(value);
            case 'stopped':
            case 'paused':
              return chalk.yellow(value);
            case 'error':
            case 'failed':
              return chalk.red(value);
            default:
              return chalk.white(value);
          }
        },
      },
      { key: 'details', title: 'Details', width: 50 },
    ]);

    builder.addRows(items);
    return builder.build();
  }

  private calculateColumnWidths(): void {
    this.columns.forEach(column => {
      if (column.width) return;

      // Calculate based on header title
      let maxWidth = column.title.length;

      // Check data rows
      this.rows.forEach(row => {
        const value = String(row[column.key] || '');
        const displayValue = column.format ? column.format(row[column.key]) : value;
        // Remove ANSI color codes for width calculation
        const cleanValue = displayValue.replace(/\x1b\[[0-9;]*m/g, '');
        maxWidth = Math.max(maxWidth, cleanValue.length);
      });

      // Apply constraints
      column.width = Math.min(
        maxWidth + 2,
        Math.floor(this.options.maxWidth! / this.columns.length)
      );
    });
  }

  private formatTitle(): string {
    const titleText = this.options.title!;
    const totalWidth = this.getTotalWidth();
    const padding = Math.max(0, Math.floor((totalWidth - titleText.length) / 2));

    if (this.options.colors) {
      return chalk.bold.blue(' '.repeat(padding) + titleText);
    }
    return ' '.repeat(padding) + titleText;
  }

  private formatHeaderRow(): string {
    const cells = this.columns.map(column => {
      const text = this.options.colors ? chalk.bold(column.title) : column.title;
      return this.formatCell(text, column.width!, column.align || 'left');
    });

    return this.joinCells(cells);
  }

  private formatDataRow(row: Record<string, any>): string {
    const cells = this.columns.map(column => {
      let value = row[column.key];

      if (value === undefined || value === null) {
        value = '';
      } else if (column.format) {
        value = column.format(value);
      } else {
        value = String(value);
      }

      return this.formatCell(value, column.width!, column.align || 'left');
    });

    return this.joinCells(cells);
  }

  private formatCell(content: string, width: number, align: 'left' | 'center' | 'right'): string {
    // Remove ANSI codes for length calculation
    const cleanContent = content.replace(/\x1b\[[0-9;]*m/g, '');

    if (cleanContent.length > width - 2) {
      const truncated = cleanContent.substring(0, width - 5) + '...';
      return ` ${truncated}${' '.repeat(Math.max(0, width - truncated.length - 1))}`;
    }

    const padding = width - cleanContent.length - 2;
    let leftPad = 0;
    let rightPad = padding;

    switch (align) {
      case 'center':
        leftPad = Math.floor(padding / 2);
        rightPad = padding - leftPad;
        break;
      case 'right':
        leftPad = padding;
        rightPad = 0;
        break;
    }

    return ` ${' '.repeat(leftPad)}${content}${' '.repeat(rightPad)} `;
  }

  private joinCells(cells: string[]): string {
    if (this.options.border) {
      return '│' + cells.join('│') + '│';
    }
    return cells.join(' ');
  }

  private formatBorderLine(): string {
    const parts = this.columns.map(column => '─'.repeat(column.width!));
    return '├' + parts.join('┼') + '┤';
  }

  private formatSeparatorLine(): string {
    if (this.options.border) {
      const parts = this.columns.map(column => '─'.repeat(column.width!));
      return '├' + parts.join('┼') + '┤';
    }

    const parts = this.columns.map(column => '─'.repeat(column.width!));
    return parts.join(' ');
  }

  private getTotalWidth(): number {
    const contentWidth = this.columns.reduce((sum, col) => sum + (col.width || 0), 0);
    const borderWidth = this.options.border ? this.columns.length + 1 : 0;
    return contentWidth + borderWidth;
  }
}
