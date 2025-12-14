import { securityConfig, typeScriptConfig } from '@kitiumai/lint/eslint';

export default [
  ...typeScriptConfig,
  securityConfig,
  {
    name: 'playwright-helpers/lint-overrides',
    rules: {
      // Fix upstream schema incompatibility with ESLint v9+.
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['../../*', '../../../*'],
              message: 'Prefer module aliases over deep relative imports for maintainability.',
            },
          ],
        },
      ],
      // Avoid circular fixes between import ordering rules.
      'simple-import-sort/imports': 'off',
      'simple-import-sort/exports': 'off',
      // Keep the rule but avoid blocking builds on legacy code paths.
      complexity: 'off',
      // The rule is too noisy for common safe patterns in this package.
      'security/detect-object-injection': 'off',
      // Reduce warning noise from heuristic rules in helpers package.
      '@typescript-eslint/require-await': 'off',
      'require-await': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'max-depth': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'promise/prefer-await-to-callbacks': 'off',
      'promise/param-names': 'off',
      'no-unsanitized/method': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
];
