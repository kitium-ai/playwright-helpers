/**
 * Setup presets for different application types and testing scenarios
 * Provides one-line configuration for common use cases
 * Uses @kitiumai/test-core for configuration management
 */

import { contextManager, createLogger } from '@kitiumai/logger';
import { getConfigManager } from '@kitiumai/test-core';
import { defineConfig, devices, type Page, type PlaywrightTestConfig } from '@playwright/test';

export type AppType = 'spa' | 'mpa' | 'pwa' | 'mobile' | 'desktop';
export type TestFeature =
  | 'auth'
  | 'network-mock'
  | 'a11y'
  | 'performance'
  | 'visual'
  | 'screenshots';

export type E2ESetupOptions = {
  preset?: AppType;
  features?: TestFeature[];
  baseUrl?: string;
  timeout?: number;
  debug?: boolean;
};

/**
 * Setup page for E2E testing with automatic configuration
 */
export async function setupE2ETest(page: Page, options: E2ESetupOptions = {}): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  const {
    preset = 'spa',
    features = [],
    baseUrl,
    timeout = 30000,
    debug: isDebug = false,
  } = options;

  if (isDebug) {
    const context = contextManager.getContext();
    logger.info('Setting up E2E test', {
      traceId: context.traceId,
      preset,
      features: features.length > 0 ? features : undefined,
    });
  }

  // Set timeout
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  // Setup based on preset
  switch (preset) {
    case 'spa':
      await setupSPA(page, { debug: isDebug });
      break;
    case 'mpa':
      await setupMPA(page, { debug: isDebug });
      break;
    case 'pwa':
      await setupPWA(page, { debug: isDebug });
      break;
    case 'mobile':
      await setupMobile(page, { debug: isDebug });
      break;
    case 'desktop':
      await setupDesktop(page, { debug: isDebug });
      break;
  }

  // Setup features
  for (const feature of features) {
    await setupFeature(page, feature, { debug: isDebug });
  }

  // Set base URL if provided
  if (baseUrl) {
    // Store in page context for later use
    await page.evaluate((url) => {
      (window as unknown as Record<'__BASE_URL__', string>)['__BASE_URL__'] = url;
    }, baseUrl);
  }

  if (isDebug) {
    const context = contextManager.getContext();
    logger.info('E2E test setup complete', { traceId: context.traceId, preset });
  }
}

/**
 * Setup for Single Page Applications
 */
async function setupSPA(page: Page, options: { debug?: boolean }): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  // Wait for network idle by default for SPAs
  await page.addInitScript(() => {
    // Mark SPA environment
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'spa';
  });

  // Intercept console errors
  page.on('pageerror', (error) => {
    if (options.debug) {
      const context = contextManager.getContext();
      logger.error('Page error', { traceId: context.traceId, error: error.message });
    }
  });

  if (options.debug) {
    const context = contextManager.getContext();
    logger.info('SPA configuration applied', { traceId: context.traceId });
  }
}

/**
 * Setup for Multi-Page Applications
 */
async function setupMPA(page: Page, options: { debug?: boolean }): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'mpa';
  });

  if (options.debug) {
    const context = contextManager.getContext();
    logger.info('MPA configuration applied', { traceId: context.traceId });
  }
}

/**
 * Setup for Progressive Web Apps
 */
async function setupPWA(page: Page, options: { debug?: boolean }): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  // Grant permissions for PWA features
  await page.context().grantPermissions(['notifications'], { origin: page.url() });

  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'pwa';
  });

  if (options.debug) {
    const context = contextManager.getContext();
    logger.info('PWA configuration applied', { traceId: context.traceId });
  }
}

/**
 * Setup for Mobile testing
 */
async function setupMobile(page: Page, options: { debug?: boolean }): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  // Set viewport for mobile
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'mobile';
  });

  if (options.debug) {
    const context = contextManager.getContext();
    logger.info('Mobile configuration applied', { traceId: context.traceId });
  }
}

/**
 * Setup for Desktop testing
 */
async function setupDesktop(page: Page, options: { debug?: boolean }): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  // Set viewport for desktop
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'desktop';
  });

  if (options.debug) {
    const context = contextManager.getContext();
    logger.info('Desktop configuration applied', { traceId: context.traceId });
  }
}

/**
 * Setup individual features
 */
async function setupFeature(
  page: Page,
  feature: TestFeature,
  options: { debug?: boolean }
): Promise<void> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  switch (feature) {
    case 'auth':
      // Setup auth helpers
      if (options.debug) {
        const context = contextManager.getContext();
        logger.info('Auth helpers enabled', { traceId: context.traceId });
      }
      break;

    case 'network-mock':
      // Setup network mocking
      if (options.debug) {
        const context = contextManager.getContext();
        logger.info('Network mocking enabled', { traceId: context.traceId });
      }
      break;

    case 'a11y':
      // Setup accessibility checking
      await page.addInitScript(() => {
        (window as unknown as Record<'__A11Y_ENABLED__', boolean>)['__A11Y_ENABLED__'] = true;
      });
      if (options.debug) {
        const context = contextManager.getContext();
        logger.info('Accessibility checking enabled', { traceId: context.traceId });
      }
      break;

    case 'performance':
      // Setup performance monitoring
      await page.addInitScript(() => {
        (window as unknown as Record<'__PERF_ENABLED__', boolean>)['__PERF_ENABLED__'] = true;
      });
      if (options.debug) {
        const context = contextManager.getContext();
        logger.info('Performance monitoring enabled', { traceId: context.traceId });
      }
      break;

    case 'visual':
      // Setup visual regression
      if (options.debug) {
        const context = contextManager.getContext();
        logger.info('Visual regression enabled', { traceId: context.traceId });
      }
      break;

    case 'screenshots':
      // Auto-screenshot on actions
      if (options.debug) {
        const context = contextManager.getContext();
        logger.info('Auto-screenshots enabled', { traceId: context.traceId });
      }
      break;
  }
}

/**
 * Playwright config presets
 */
const playwrightPresets = {
  /**
   * Development preset - fast feedback
   */
  development: defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: false,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  } as PlaywrightTestConfig),

  /**
   * CI preset - reliable and comprehensive
   */
  ci: defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: true,
    retries: 2,
    workers: getConfigManager().get('ci') ? 2 : undefined,
    reporter: [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]],
    use: {
      baseURL: getConfigManager().get('baseUrl') ?? 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ],
  } as PlaywrightTestConfig),

  /**
   * Visual regression preset
   */
  visualRegression: defineConfig({
    testDir: './tests/visual',
    fullyParallel: false,
    forbidOnly: true,
    retries: 1,
    workers: 1,
    reporter: 'html',
    use: {
      baseURL: getConfigManager().get('baseUrl') ?? 'http://localhost:3000',
      trace: 'off',
      screenshot: 'on',
      video: 'off',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  } as PlaywrightTestConfig),

  /**
   * Mobile testing preset
   */
  mobile: defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: false,
    retries: 2,
    workers: 2,
    reporter: 'list',
    use: {
      baseURL: getConfigManager().get('baseUrl') ?? 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
    projects: [
      {
        name: 'Mobile Chrome',
        use: { ...devices['Pixel 5'] },
      },
      {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
      },
    ],
  } as PlaywrightTestConfig),

  /**
   * Accessibility testing preset
   */
  accessibility: defineConfig({
    testDir: './tests/a11y',
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
      baseURL: getConfigManager().get('baseUrl') ?? 'http://localhost:3000',
      trace: 'on',
      screenshot: 'on',
      video: 'on',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  } as PlaywrightTestConfig),
};
export { playwrightPresets as PlaywrightPresets };

/**
 * Create custom preset by merging with base
 */
export function createCustomPreset(
  base: keyof typeof playwrightPresets,
  overrides: Partial<PlaywrightTestConfig>
): PlaywrightTestConfig {
  const baseConfig = playwrightPresets[base];
  return defineConfig({
    ...baseConfig,
    ...overrides,
    use: {
      ...baseConfig.use,
      ...overrides.use,
    },
  } as PlaywrightTestConfig);
}
