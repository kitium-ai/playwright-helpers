const { defineConfig } = require('@playwright/test');
const basePlaywrightConfig = require('@kitiumai/config/playwright.config.base.js');

module.exports = defineConfig({
  ...basePlaywrightConfig,
  testDir: './tests',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
});
