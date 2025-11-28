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
      'tests/',
      'playwright.config.js',
      'playwright.config.cjs',
      '*.config.js',
      '*.config.cjs',
      'eslint.config.js',
      'prettier.config.cjs',
    ],
  },
  ...eslintBaseConfig.map((config) => {
    if (config.rules?.['no-restricted-imports']) {
      return {
        ...config,
        rules: {
          ...config.rules,
          'no-restricted-imports': 'off',
        },
      };
    }
    return config;
  }),
  ...eslintTypeScriptConfig.map((config) => {
    // Exclude test files from TypeScript project-based linting
    const updatedConfig = {
      ...config,
      ignores: [...(config.ignores || []), 'tests/**/*', '**/*.test.*', '**/*.spec.*'],
    };

    if (config.rules?.['no-restricted-imports']) {
      return {
        ...updatedConfig,
        rules: {
          ...updatedConfig.rules,
          'no-restricted-imports': 'off',
        },
      };
    }
    return updatedConfig;
  }),
  {
    name: 'playwright-helpers-overrides',
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Allow higher complexity for utility functions
      complexity: ['warn', 20],
      // Allow longer functions for test helpers (especially HTML generation and validation)
      'max-lines-per-function': ['warn', 170],
      // Allow more statements in test helpers
      'max-statements': ['warn', 35],
      // Allow deeper nesting for complex test setups
      'max-depth': ['warn', 6],
      // Allow any type in utility functions
      '@typescript-eslint/no-explicit-any': 'warn',
      // Relax naming convention for local variables
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
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
      // Disable import/order to avoid conflicts with simple-import-sort
      'import/order': 'off',
      // Allow abbreviations common in test code
      'unicorn/prevent-abbreviations': [
        'warn',
        {
          allowList: {
            e: true,
            _e: true,
            dir: true,
            outputDir: true,
            baselineDir: true,
            actualDir: true,
            args: true,
          },
        },
      ],
      // Allow callbacks in test utilities
      'promise/prefer-await-to-callbacks': 'off',
      // Allow flexible promise parameter names
      'promise/param-names': 'off',
    },
  },
  {
    name: 'test-files-overrides',
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Disable type-aware linting rules for test files not in tsconfig
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    name: 'eslint-config-overrides',
    files: ['**/*.cjs', 'eslint.config.js', 'playwright.config.js', 'prettier.config.cjs'],
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
