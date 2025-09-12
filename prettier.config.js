export default {
  // Line wrapping
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // Punctuation
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  
  // Whitespace
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  
  // Line endings
  endOfLine: 'lf',
  
  // File handling
  insertPragma: false,
  requirePragma: false,
  
  // TypeScript specific
  parser: 'typescript',
  
  // Override for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json',
        printWidth: 80
      }
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.yaml',
      options: {
        parser: 'yaml',
        printWidth: 80
      }
    }
  ]
};