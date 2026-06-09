// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.wrangler/**',
      'node_modules/**',
      'demos/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'marketing-capture/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.astro'],
    rules: {
      // Astro components frequently declare props that are referenced only in the template.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
];
