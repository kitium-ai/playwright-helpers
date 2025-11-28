/**
 * Common test patterns and utilities for Playwright tests
 * Provides reusable patterns for test data, error scenarios, and common operations
 */

import type { BrowserContext, Page } from '@playwright/test';

import { createE2ETestData, createStorageHelper } from '../testing';

/**
 * Test data setup and teardown helper
 */
export class TestDataManager {
  private readonly _page: Page;
  private readonly _context: BrowserContext;
  private readonly storageHelper: ReturnType<typeof createStorageHelper>;
  private readonly testData: ReturnType<typeof createE2ETestData>;
  private cleanupActions: Array<() => Promise<void>> = [];

  constructor(page: Page, context?: BrowserContext) {
    this._page = page;
    this._context = context ?? page.context();
    this.storageHelper = createStorageHelper(page);
    this.testData = createE2ETestData();
  }

  get page(): Page {
    return this._page;
  }

  get context(): BrowserContext {
    return this._context;
  }

  /**
   * Setup test data in localStorage
   */
  async setupLocalStorage(data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.storageHelper.setLocalStorage(key, value);
    }

    // Register cleanup
    this.cleanupActions.push(async () => {
      await this.storageHelper.clearLocalStorage();
    });
  }

  /**
   * Setup test data in sessionStorage
   */
  async setupSessionStorage(data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.storageHelper.setSessionStorage(key, value);
    }

    // Register cleanup
    this.cleanupActions.push(async () => {
      await this.storageHelper.clearSessionStorage();
    });
  }

  /**
   * Setup test cookies
   */
  async setupCookies(
    cookies: Array<{ name: string; value: string; domain?: string; path?: string }>
  ): Promise<void> {
    for (const cookie of cookies) {
      const options = {
        path: cookie.path ?? '/',
        ...(cookie.domain !== undefined ? { domain: cookie.domain } : {}),
      };
      await this.storageHelper.setCookie(cookie.name, cookie.value, options);
    }

    // Register cleanup
    this.cleanupActions.push(async () => {
      await this.storageHelper.clearCookies();
    });
  }

  /**
   * Store test data
   */
  store(key: string, value: unknown): void {
    this.testData.store(key, value);
  }

  /**
   * Retrieve test data
   */
  retrieve<T>(key: string): T | undefined {
    return this.testData.retrieve<T>(key);
  }

  /**
   * Register cleanup action
   */
  registerCleanup(action: () => Promise<void>): void {
    this.cleanupActions.push(action);
  }

  /**
   * Cleanup all test data
   */
  async cleanup(): Promise<void> {
    // Execute cleanup actions in reverse order
    for (let index = this.cleanupActions.length - 1; index >= 0; index--) {
      const action = this.cleanupActions[index];
      if (action) {
        try {
          await action();
        } catch (error) {
          console.error('Cleanup action failed:', error);
        }
      }
    }
    this.cleanupActions = [];
    this.testData.clear();
  }
}

/**
 * Error scenario testing helper
 */
export class ErrorScenarioHelper {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Test form validation errors
   */
  async testFormValidation(
    formData: Record<string, string>,
    options: {
      submitSelector?: string;
      expectedErrors: Record<string, string | RegExp>;
      errorSelectors?: Record<string, string>;
    }
  ): Promise<Record<string, string>> {
    const {
      submitSelector = 'button[type="submit"]',
      expectedErrors,
      errorSelectors = {},
    } = options;

    // Fill form with invalid data
    for (const [field, value] of Object.entries(formData)) {
      const input = this.page.locator(`input[name="${field}"], input[id="${field}"]`);
      await input.fill(value);
    }

    // Submit form
    await this.page.locator(submitSelector).click();

    // Wait for validation errors
    await this.page.waitForTimeout(500);

    const foundErrors: Record<string, string> = {};

    // Check each expected error
    for (const [field, expectedError] of Object.entries(expectedErrors)) {
      const errorSelector =
        errorSelectors[field] ??
        `[data-error="${field}"], .error-${field}, [aria-describedby*="${field}"]`;
      const errorElement = this.page.locator(errorSelector);

      const isVisible = await errorElement.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        const errorText = await errorElement.textContent();
        foundErrors[field] = errorText ?? '';

        // Verify error message matches expected
        if (typeof expectedError === 'string') {
          if (!errorText?.includes(expectedError)) {
            throw new Error(
              `Expected error for '${field}' to contain '${expectedError}', but got '${errorText}'`
            );
          }
        } else {
          const matchesPattern = !!errorText && expectedError.test(errorText);
          if (!matchesPattern) {
            throw new Error(
              `Expected error for '${field}' to match ${expectedError}, but got '${errorText}'`
            );
          }
        }
      } else {
        throw new Error(`Expected validation error for field '${field}' but none found`);
      }
    }

    return foundErrors;
  }

  /**
   * Test API error handling
   */
  async testApiError(
    action: () => Promise<void>,
    options: {
      errorSelector?: string;
      expectedErrorText?: string | RegExp;
      expectedStatusCode?: number;
    } = {}
  ): Promise<string> {
    const { errorSelector = '[role="alert"], .error, [data-testid="error"]' } = options;

    // Perform action that should trigger error
    await action();

    // Wait for error to appear
    const errorElement = this.page.locator(errorSelector);
    await errorElement.waitFor({ state: 'visible', timeout: 5000 });

    const errorText = (await errorElement.textContent()) ?? '';

    if (options.expectedErrorText) {
      if (typeof options.expectedErrorText === 'string') {
        if (!errorText.includes(options.expectedErrorText)) {
          throw new Error(
            `Expected error text to contain '${options.expectedErrorText}', but got '${errorText}'`
          );
        }
      } else {
        if (!options.expectedErrorText.test(errorText)) {
          throw new Error(
            `Expected error text to match ${options.expectedErrorText}, but got '${errorText}'`
          );
        }
      }
    }

    return errorText;
  }

  /**
   * Test network error handling
   */
  async testNetworkError(
    action: () => Promise<void>,
    options: {
      errorSelector?: string;
      expectedErrorText?: string;
      simulateOffline?: boolean;
    } = {}
  ): Promise<void> {
    const { simulateOffline = false } = options;

    if (simulateOffline) {
      await this.page.context().setOffline(true);
    }

    try {
      await action();

      // Wait for error to appear
      if (options.errorSelector) {
        const errorElement = this.page.locator(options.errorSelector);
        await errorElement.waitFor({ state: 'visible', timeout: 5000 });

        if (options.expectedErrorText) {
          const errorText = await errorElement.textContent();
          if (!errorText?.includes(options.expectedErrorText)) {
            throw new Error(
              `Expected error text to contain '${options.expectedErrorText}', but got '${errorText}'`
            );
          }
        }
      }
    } finally {
      if (simulateOffline) {
        await this.page.context().setOffline(false);
      }
    }
  }

  /**
   * Test permission/authorization errors
   */
  async testUnauthorizedAccess(
    action: () => Promise<void>,
    options: {
      expectedUrl?: string | RegExp;
      expectedErrorText?: string;
      errorSelector?: string;
    } = {}
  ): Promise<void> {
    await action();

    if (options.expectedUrl) {
      await this.page.waitForURL(options.expectedUrl, { timeout: 5000 });
    }

    if (options.errorSelector && options.expectedErrorText) {
      const errorElement = this.page.locator(options.errorSelector);
      await errorElement.waitFor({ state: 'visible', timeout: 5000 });
      const errorText = await errorElement.textContent();
      if (!errorText?.includes(options.expectedErrorText)) {
        throw new Error(
          `Expected error text to contain '${options.expectedErrorText}', but got '${errorText}'`
        );
      }
    }
  }
}

/**
 * Common operation patterns
 */
export class CommonPatterns {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(
    options: {
      waitForNetworkIdle?: boolean;
      waitForSelector?: string;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { waitForNetworkIdle = true, waitForSelector, timeout = 30000 } = options;

    if (waitForNetworkIdle) {
      await this.page.waitForLoadState('networkidle', { timeout });
    } else {
      await this.page.waitForLoadState('domcontentloaded', { timeout });
    }

    if (waitForSelector) {
      await this.page.waitForSelector(waitForSelector, { timeout });
    }
  }

  /**
   * Retry an action with exponential backoff
   */
  async retryAction<T>(
    action: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delayMs?: number;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<T> {
    const { maxAttempts = 3, delayMs = 1000, onRetry } = options;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        onRetry?.(attempt, lastError);

        if (attempt < maxAttempts) {
          const delay = delayMs * 2 ** (attempt - 1); // Exponential backoff
          await this.page.waitForTimeout(delay);
        }
      }
    }

    throw lastError ?? new Error('Max retry attempts reached');
  }

  /**
   * Wait for element to be in specific state
   */
  async waitForElementState(
    selector: string,
    state: 'visible' | 'hidden' | 'attached' | 'detached',
    timeout = 5000
  ): Promise<void> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state, timeout });
  }

  /**
   * Wait for multiple elements
   */
  async waitForElements(
    selectors: string[],
    options: {
      allVisible?: boolean;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { allVisible = true, timeout = 5000 } = options;

    if (allVisible) {
      await Promise.all(
        selectors.map((selector) =>
          this.page.locator(selector).waitFor({ state: 'visible', timeout })
        )
      );
    } else {
      await Promise.race(
        selectors.map((selector) =>
          this.page.locator(selector).waitFor({ state: 'visible', timeout })
        )
      );
    }
  }

  /**
   * Scroll to element and wait for it to be visible
   */
  async scrollToAndWait(selector: string, timeout = 5000): Promise<void> {
    const locator = this.page.locator(selector);
    await locator.scrollIntoViewIfNeeded();
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Click and wait for navigation
   */
  async clickAndWaitForNavigation(
    selector: string,
    options: {
      waitForUrl?: string | RegExp;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { waitForUrl, timeout = 10000 } = options;

    if (waitForUrl) {
      await Promise.all([
        this.page.waitForURL(waitForUrl, { timeout }),
        this.page.locator(selector).click(),
      ]);
    } else {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }),
        this.page.locator(selector).click(),
      ]);
    }
  }
}

/**
 * Create test data manager
 */
export function createTestDataManager(page: Page, context?: BrowserContext): TestDataManager {
  return new TestDataManager(page, context);
}

/**
 * Create error scenario helper
 */
export function createErrorScenarioHelper(page: Page): ErrorScenarioHelper {
  return new ErrorScenarioHelper(page);
}

/**
 * Create common patterns helper
 */
export function createCommonPatterns(page: Page): CommonPatterns {
  return new CommonPatterns(page);
}
