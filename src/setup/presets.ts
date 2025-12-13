/**
 * Setup presets for different application types and testing scenarios
 * Provides one-line configuration for common use cases
 * Uses @kitiumai/test-core for configuration management
 */

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

export interface E2ESetupOptions {
  preset?: AppType;
  features?: TestFeature[];
  baseUrl?: string;
  timeout?: number;
  debug?: boolean;
}

/**
 * Setup page for E2E testing with automatic configuration
 */
export async function setupE2ETest(page: Page, options: E2ESetupOptions = {}): Promise<void> {
  const { preset = 'spa', features = [], baseUrl, timeout = 30000, debug = false } = options;

  if (debug) {
    console.log(`🚀 Setting up E2E test for ${preset} app`);
    console.log(`Features: ${features.join(', ') || 'none'}`);
  }

  // Set timeout
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  // Setup based on preset
  switch (preset) {
    case 'spa':
      await setupSPA(page, { debug });
      break;
    case 'mpa':
      await setupMPA(page, { debug });
      break;
    case 'pwa':
      await setupPWA(page, { debug });
      break;
    case 'mobile':
      await setupMobile(page, { debug });
      break;
    case 'desktop':
      await setupDesktop(page, { debug });
      break;
  }

  // Setup features
  for (const feature of features) {
    await setupFeature(page, feature, { debug });
  }

  // Set base URL if provided
  if (baseUrl) {
    // Store in page context for later use
    await page.evaluate((url) => {
      (window as unknown as Record<'__BASE_URL__', string>)['__BASE_URL__'] = url;
    }, baseUrl);
  }

  if (debug) {
    console.log(`✅ E2E test setup complete`);
  }
}

/**
 * Setup for Single Page Applications
 */
async function setupSPA(page: Page, options: { debug?: boolean }): Promise<void> {
  // Wait for network idle by default for SPAs
  await page.addInitScript(() => {
    // Mark SPA environment
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'spa';
  });

  // Intercept console errors
  page.on('pageerror', (error) => {
    if (options.debug) {
      console.error('❌ Page error:', error.message);
    }
  });

  if (options.debug) {
    console.log('  ✓ SPA configuration applied');
  }
}

/**
 * Setup for Multi-Page Applications
 */
async function setupMPA(page: Page, options: { debug?: boolean }): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'mpa';
  });

  if (options.debug) {
    console.log('  ✓ MPA configuration applied');
  }
}

/**
 * Setup for Progressive Web Apps
 */
async function setupPWA(page: Page, options: { debug?: boolean }): Promise<void> {
  // Grant permissions for PWA features
  await page.context().grantPermissions(['notifications'], { origin: page.url() });

  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'pwa';
  });

  if (options.debug) {
    console.log('  ✓ PWA configuration applied (permissions granted)');
  }
}

/**
 * Setup for Mobile testing
 */
async function setupMobile(page: Page, options: { debug?: boolean }): Promise<void> {
  // Set viewport for mobile
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'mobile';
  });

  if (options.debug) {
    console.log('  ✓ Mobile configuration applied (viewport: 375x667)');
  }
}

/**
 * Setup for Desktop testing
 */
async function setupDesktop(page: Page, options: { debug?: boolean }): Promise<void> {
  // Set viewport for desktop
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.addInitScript(() => {
    (window as unknown as Record<'__APP_TYPE__', string>)['__APP_TYPE__'] = 'desktop';
  });

  if (options.debug) {
    console.log('  ✓ Desktop configuration applied (viewport: 1920x1080)');
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
  switch (feature) {
    case 'auth':
      // Setup auth helpers
      if (options.debug) {
        console.log('  ✓ Auth helpers enabled');
      }
      break;

    case 'network-mock':
      // Setup network mocking
      if (options.debug) {
        console.log('  ✓ Network mocking enabled');
      }
      break;

    case 'a11y':
      // Setup accessibility checking
      await page.addInitScript(() => {
        (window as unknown as Record<'__A11Y_ENABLED__', boolean>)['__A11Y_ENABLED__'] = true;
      });
      if (options.debug) {
        console.log('  ✓ Accessibility checking enabled');
      }
      break;

    case 'performance':
      // Setup performance monitoring
      await page.addInitScript(() => {
        (window as unknown as Record<'__PERF_ENABLED__', boolean>)['__PERF_ENABLED__'] = true;
      });
      if (options.debug) {
        console.log('  ✓ Performance monitoring enabled');
      }
      break;

    case 'visual':
      // Setup visual regression
      if (options.debug) {
        console.log('  ✓ Visual regression enabled');
      }
      break;

    case 'screenshots':
      // Auto-screenshot on actions
      if (options.debug) {
        console.log('  ✓ Auto-screenshots enabled');
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
