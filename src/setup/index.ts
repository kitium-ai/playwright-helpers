/**
 * Playwright test setup and configuration utilities
 * Uses @kitiumai/test-core for configuration management
 */

import {
  test as base,
  type BrowserContext,
  type Page,
  type PlaywrightTestConfig,
} from '@playwright/test';
import { contextManager } from '@kitiumai/logger';
import { getTestLogger, getConfigManager } from '@kitiumai/test-core';

export interface TestFixtures {
  baseUrl: string;
  apiUrl: string;
}

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
export const PlaywrightPresets = {
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

/**
 * Global test setup helper
 */
export async function globalSetup(): Promise<void> {
  // Setup tasks that run once before all tests
  const logger = getTestLogger();
  logger.info('Running global Playwright setup');
  process.env['PLAYWRIGHT_TEST_RUNNING'] = 'true';
}

/**
 * Global test teardown helper
 */
export async function globalTeardown(): Promise<void> {
  // Cleanup tasks that run once after all tests
  const logger = getTestLogger();
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
  const logger = getTestLogger();
  page.on('console', (msg) => {
    const context = contextManager.getContext();
    const logData = {
      type: msg.type(),
      text: msg.text(),
      traceId: context.traceId,
      requestId: context.requestId,
      pageUrl: page.url(),
    };

    if (msg.type() === 'error') {
      logger.error('Browser console error', logData);
    } else if (msg.type() === 'warning') {
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
  await context.setExtraHTTPHeaders({
    'X-Test-Environment': 'true',
  });

  // Setup network idle handling
  context.setDefaultNavigationTimeout(30000);
  context.setDefaultTimeout(30000);
}

/**
 * Environment setup utilities
 * Uses @kitiumai/test-core/logger for structured logging
 */
export function setupEnvironmentVariables(): void {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  const logLevel = process.env['LOG_LEVEL'];
  process.env['LOG_LEVEL'] = logLevel ?? 'error';

  // Logger is already configured via @kitiumai/test-core/logger
  // No need to suppress console - logger handles this based on log level
  const logger = getTestLogger();
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
export * from './presets';
export * from './fixtures';
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
