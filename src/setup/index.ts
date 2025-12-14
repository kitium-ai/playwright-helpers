/**
 * Playwright test setup and configuration utilities
 * Uses @kitiumai/test-core for configuration management
 */

import { contextManager, createLogger } from '@kitiumai/logger';
import { getConfigManager } from '@kitiumai/test-core';
import {
  type BrowserContext,
  type Page,
  type PlaywrightTestConfig,
  test as base,
} from '@playwright/test';

export type TestFixtures = {
  baseUrl: string;
  apiUrl: string;
};

/**
 * Create Playwright test with custom fixtures
 */
export const createTest = base.extend<TestFixtures>({
  baseUrl: async (_fixtures, use) => {
    const config = getConfigManager();
    const url = config.get('baseUrl') ?? 'http://localhost:3000';
    await use(url);
  },
  apiUrl: async (_fixtures, use) => {
    const config = getConfigManager();
    const url = config.get('apiUrl') ?? 'http://localhost:3000/api';
    await use(url);
  },
});

/**
 * Playwright configuration presets
 * Uses @kitiumai/test-core for configuration management
 */

/**
 * Mobile device presets
 */
export const mobileDevices = {
  iPhone12: {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
  },
  ['Pixel5']: {
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
  },
};

const playwrightPresets = {
  /**
   * Configuration for local development
   */
  development: {
    use: {
      baseURL: getConfigManager().get('baseUrl') ?? 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !getConfigManager().get('ci'),
    },
  },

  /**
   * Configuration for CI/CD
   */
  ci: {
    use: {
      baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
      trace: 'on',
      screenshot: 'on',
      video: 'on',
    },
    retries: 2,
    workers: 4,
  },

  /**
   * Configuration for visual regression tests
   */
  visualRegression: {
    use: {
      baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
      trace: 'off',
      screenshot: 'off',
      video: 'off',
    },
    snapshotDir: 'visual-baselines',
    snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-{arg}{ext}',
  },

  /**
   * Configuration for performance tests
   */
  performance: {
    use: {
      baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
      trace: 'off',
      screenshot: 'off',
      video: 'off',
    },
    timeout: 120000,
  },

  /**
   * Configuration for mobile testing
   */
  mobile: {
    use: {
      baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      ...mobileDevices.iPhone12,
    },
    projects: [
      {
        name: 'Mobile Chrome',
        use: { ...mobileDevices.Pixel5 },
      },
      {
        name: 'Mobile Safari',
        use: { ...mobileDevices.iPhone12 },
      },
    ],
  },

  /**
   * Configuration for accessibility tests
   */
  accessibility: {
    use: {
      baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'on-failure',
      video: 'off',
    },
  },
};
export { playwrightPresets as PlaywrightPresets };

/**
 * Global test setup helper
 */
export async function globalSetup(): Promise<void> {
  // Setup tasks that run once before all tests
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  logger.info('Running global Playwright setup');
  process.env['PLAYWRIGHT_TEST_RUNNING'] = 'true';
}

/**
 * Global test teardown helper
 */
export async function globalTeardown(): Promise<void> {
  // Cleanup tasks that run once after all tests
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  logger.info('Running global Playwright teardown');
  delete process.env['PLAYWRIGHT_TEST_RUNNING'];
}

/**
 * Page setup utilities
 */
export async function setupPageForTesting(page: Page): Promise<void> {
  // Setup common page configurations
  await page.setViewportSize({ width: 1280, height: 720 });

  // Disable animations for consistent tests
  await page.addInitScript(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const style = document.createElement('style');
    style.textContent = `
      * {
        animation: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Setup console message handler with context-aware logging
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  page.on('console', (message) => {
    const context = contextManager.getContext();
    const logData = {
      type: message.type(),
      text: message.text(),
      traceId: context.traceId,
      requestId: context.requestId,
      pageUrl: page.url(),
    };

    if (message.type() === 'error') {
      logger.error('Browser console error', logData);
    } else if (message.type() === 'warning') {
      logger.warn('Browser console warning', logData);
    }
  });

  // Setup page crash handler
  page.on('close', () => {
    logger.debug('Page closed', { pageUrl: page.url() });
  });
}

/**
 * Context setup utilities
 */
export async function setupContextForTesting(context: BrowserContext): Promise<void> {
  // Add any global headers
  const headerTestEnvironment = 'X-Test-Environment';
  await context.setExtraHTTPHeaders({
    [headerTestEnvironment]: 'true',
  });

  // Setup network idle handling
  context.setDefaultNavigationTimeout(30000);
  context.setDefaultTimeout(30000);
}

/**
 * Environment setup utilities
 * Uses @kitiumai/logger for structured logging
 */
export function setupEnvironmentVariables(): void {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  const logLevel = process.env['LOG_LEVEL'];
  process.env['LOG_LEVEL'] = logLevel ?? 'error';

  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  logger.debug('Test environment variables configured', {
    nodeEnv: process.env['NODE_ENV'],
    logLevel: process.env['LOG_LEVEL'],
    verbose: process.env['VERBOSE'],
  });
}

/**
 * Cleanup utilities
 */
export async function cleanupAfterTest(page?: Page, context?: BrowserContext): Promise<void> {
  if (page) {
    try {
      await page.context().clearCookies();
    } catch {
      // Page might be closed
    }
  }

  if (context) {
    try {
      await context.clearCookies();
    } catch {
      // Context might be closed
    }
  }
}

// Enhanced presets
export * from './fixtures';
export * from './presets';
export * from './scaffolder';

/**
 * Test configuration generator
 */
export function generatePlaywrightConfig(options: {
  baseURL?: string;
  workers?: number;
  retries?: number;
  timeout?: number;
  headed?: boolean;
  trace?: 'off' | 'on' | 'on-first-retry' | 'retain-on-failure';
  screenshot?: 'off' | 'on' | 'only-on-failure';
  video?: 'off' | 'on' | 'retain-on-failure';
  projects?: Array<{ name: string; use: Record<string, unknown> }>;
}): PlaywrightTestConfig {
  const calculatedWorkers = options.workers ?? (process.env['CI'] ? 1 : undefined);

  const config: PlaywrightTestConfig = {
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env['CI'],
    retries: options.retries ?? (process.env['CI'] ? 2 : 0),
    timeout: options.timeout ?? 30000,
    reporter: 'html',
    use: {
      baseURL: options.baseURL ?? 'http://localhost:3000',
      trace: options.trace ?? 'on-first-retry',
      screenshot: options.screenshot ?? 'only-on-failure',
      video: options.video ?? 'retain-on-failure',
      headless: options.headed !== true,
    },
    projects: options.projects ?? [
      {
        name: 'chromium',
        use: { ...(process.env['CI'] ? {} : { launchArgs: ['--no-sandbox'] }) },
      },
      {
        name: 'firefox',
        use: {},
      },
      {
        name: 'webkit',
        use: {},
      },
    ],
    webServer: {
      command: 'npm run dev',
      url: options.baseURL ?? 'http://localhost:3000',
      reuseExistingServer: !process.env['CI'],
    },
  };

  if (calculatedWorkers !== undefined) {
    config.workers = calculatedWorkers;
  }

  return config;
}
