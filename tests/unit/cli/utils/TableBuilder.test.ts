import { describe, it, expect } from 'vitest';
import { TableBuilder, TableColumn } from '../../../../src/cli/utils/TableBuilder.js';

describe('TableBuilder', () => {
  describe('basic table building', () => {
    it('should build simple table with data', () => {
      const builder = new TableBuilder({ colors: false, border: true });
      
      builder.addColumns([
        { key: 'name', title: 'Name', width: 10 },
        { key: 'value', title: 'Value', width: 10 }
      ]);

      builder.addRows([
        { name: 'Item 1', value: '100' },
        { name: 'Item 2', value: '200' }
      ]);

      const result = builder.build();
      
      expect(result).toContain('Name');
      expect(result).toContain('Value');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).toContain('│'); // Border character
    });

    it('should handle empty data', () => {
      const builder = new TableBuilder({ colors: false });
      
      builder.addColumns([
        { key: 'name', title: 'Name' }
      ]);

      const result = builder.build();
      expect(result).toContain('No data to display');
    });

    it('should handle no columns', () => {
      const builder = new TableBuilder({ colors: false });
      
      const result = builder.build();
      expect(result).toContain('No columns defined');
    });
  });

  describe('column formatting', () => {
    it('should apply custom column formatters', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumns([
        { 
          key: 'price', 
          title: 'Price', 
          width: 15,
          format: (value: number) => `$${value.toFixed(2)}`
        }
      ]);

      builder.addRow({ price: 123.456 });

      const result = builder.build();
      expect(result).toContain('$123.46');
    });

    it('should handle different column alignments', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumns([
        { key: 'left', title: 'Left', width: 10, align: 'left' },
        { key: 'center', title: 'Center', width: 10, align: 'center' },
        { key: 'right', title: 'Right', width: 10, align: 'right' }
      ]);

      builder.addRow({ left: 'L', center: 'C', right: 'R' });

      const result = builder.build();
      expect(result).toContain('L');
      expect(result).toContain('C');
      expect(result).toContain('R');
    });
  });

  describe('table options', () => {
    it('should respect compact mode', () => {
      const builder = new TableBuilder({ colors: false, compact: true, border: false });
      
      builder.addColumns([
        { key: 'name', title: 'Name', width: 10 }
      ]);

      builder.addRows([
        { name: 'Item 1' },
        { name: 'Item 2' }
      ]);

      const result = builder.build();
      const lines = result.split('\n');
      
      // In compact mode, no separator lines between data rows
      expect(lines.filter(line => line.includes('─')).length).toBe(1); // Only header separator
    });

    it('should include title when provided', () => {
      const builder = new TableBuilder({ 
        colors: false, 
        title: 'Test Table',
        border: true 
      });
      
      builder.addColumn({ key: 'test', title: 'Test', width: 10 });
      builder.addRow({ test: 'value' });

      const result = builder.build();
      expect(result).toContain('Test Table');
    });

    it('should handle borderless tables', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumn({ key: 'test', title: 'Test', width: 10 });
      builder.addRow({ test: 'value' });

      const result = builder.build();
      expect(result).not.toContain('│');
      expect(result).not.toContain('├');
    });
  });

  describe('static helper methods', () => {
    it('should create simple table', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];

      const result = TableBuilder.simple(data);
      
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
    });

    it('should create key-value table', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      const result = TableBuilder.keyValue(data, 'User Info');
      
      expect(result).toContain('User Info');
      expect(result).toContain('Property');
      expect(result).toContain('Value');
      expect(result).toContain('Name');
      expect(result).toContain('John Doe');
    });

    it('should create status table with colored status', () => {
      const items = [
        { name: 'Service A', status: 'active', details: 'Running normally' },
        { name: 'Service B', status: 'error', details: 'Connection failed' }
      ];

      const result = TableBuilder.status(items);
      
      expect(result).toContain('Service A');
      expect(result).toContain('Service B');
      expect(result).toContain('active');
      expect(result).toContain('error');
    });

    it('should handle empty data in simple table', () => {
      const result = TableBuilder.simple([]);
      expect(result).toContain('No data to display');
    });
  });

  describe('column width calculation', () => {
    it('should auto-calculate column widths when not specified', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumns([
        { key: 'short', title: 'Short' },
        { key: 'longer', title: 'Much Longer Title' }
      ]);

      builder.addRows([
        { short: 'A', longer: 'This is a much longer value' },
        { short: 'B', longer: 'Short' }
      ]);

      const result = builder.build();
      
      // Should contain all content without truncation issues
      expect(result).toContain('This is a much longer value');
      expect(result).toContain('Much Longer Title');
    });

    it('should truncate content that exceeds column width', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumn({ 
        key: 'content', 
        title: 'Content', 
        width: 10 
      });

      builder.addRow({ content: 'This is a very long text that should be truncated' });

      const result = builder.build();
      expect(result).toContain('...');
    });
  });

  describe('data handling', () => {
    it('should handle null and undefined values', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumns([
        { key: 'value1', title: 'Value 1', width: 10 },
        { key: 'value2', title: 'Value 2', width: 10 }
      ]);

      builder.addRow({ value1: null, value2: undefined });

      const result = builder.build();
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
    });

    it('should handle mixed data types', () => {
      const builder = new TableBuilder({ colors: false, border: false });
      
      builder.addColumns([
        { key: 'string', title: 'String', width: 10 },
        { key: 'number', title: 'Number', width: 10 },
        { key: 'boolean', title: 'Boolean', width: 10 }
      ]);

      builder.addRow({ 
        string: 'text', 
        number: 123, 
        boolean: true 
      });

      const result = builder.build();
      expect(result).toContain('text');
      expect(result).toContain('123');
      expect(result).toContain('true');
    });
  });
});