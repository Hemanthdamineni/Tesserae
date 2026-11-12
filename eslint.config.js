import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'scripts/',
      'public/sw.js',
      // Vendored third-party binaries served from this origin (see
      // scripts/vendor-heif-wasm.mjs and scripts/vendor-tesseract.mjs).
      'public/vendor/',
      '**/*.d.ts',
      // Third-party / non-product vendored trees.
      '.dsh-open-design/',
      '.claude/',
      '.git/',
    ],
  },
  js.configs.recommended,
  {
    // Node config files
    files: ['*.config.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 'latest' },
      globals: { ...globals.browser, ...globals.node, ...globals.worker },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TypeScript's own checker covers undefined identifiers far better.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // ESLint 10 promoted this rule into `js.configs.recommended`. It flags
      // defensive initialisers that are always overwritten (61 hits across the
      // tool modules); TypeScript's definite-assignment analysis already covers
      // the cases that matter, so keep it off rather than rewrite working code.
      'no-useless-assignment': 'off',
    },
  },
  ...astro.configs.recommended,
  {
    files: ['**/*.astro'],
    // Frontmatter is type-checked by `astro check`, not ESLint's untyped AST:
    // base no-unused-vars flags real-but-ignored params (e.g. `_props`) with no
    // TS-aware ignorePattern here.
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off' },
  },
  {
    files: ['**/*.test.ts', 'test/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
  },
];
