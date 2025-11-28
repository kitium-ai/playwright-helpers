/**
 * ESLint configuration for @kitiumai/playwright-helpers
 * Extends @kitiumai/lint with Playwright-specific overrides
 */

import { eslintBaseConfig, eslintTypeScriptConfig } from '@kitiumai/lint';

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.next/',
      'out/',
      '.venv/',
      'venv/',
      '.env',
      '.env.local',
      '.env.*.local',
      '*.log',
      '.DS_Store',
      '.cache',
      '.turbo',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'playwright.config.js',
      '*.config.js',
      '*.config.cjs',
      'eslint.config.js',
      'prettier.config.cjs',
    ],
  },
  ...eslintBaseConfig,
  ...eslintTypeScriptConfig,
  {
    name: 'playwright-helpers-overrides',
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Allow higher complexity for utility functions
      complexity: ['warn', 15],
      // Allow any type in utility functions
      '@typescript-eslint/no-explicit-any': 'warn',
      // Relax naming convention for local variables
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'objectLiteralProperty',
          format: null, // Allow any format for object literal properties (needed for ESLint rules)
        },
        {
          selector: 'property',
          format: null, // Allow any format for properties
        },
      ],
      // Allow console statements in test helpers for debugging
      'no-console': 'off',
      // Allow unused variables in test helper functions
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Allow async methods without await for mock implementations
      '@typescript-eslint/require-await': 'off',
      // Allow unnecessary try/catch in test utilities
      'no-useless-catch': 'off',
      // Allow deep nesting for complex test setups
      'max-depth': ['warn', 4],
      // Allow interfaces for type definitions
      '@typescript-eslint/consistent-type-definitions': 'off',
      // Allow floating promises in test setups
      '@typescript-eslint/no-floating-promises': 'warn',
      // Allow case declarations with braces
      'no-case-declarations': 'off',
      // Disable indent rule - let prettier handle it
      indent: 'off',
      // Allow relative imports within the package
      'no-restricted-imports': 'off',
    },
  },
  {
    name: 'eslint-config-overrides',
    files: ['eslint.config.js', 'playwright.config.js', 'prettier.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
];
