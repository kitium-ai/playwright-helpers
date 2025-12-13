/**
 * E2E testing utilities and helpers
 * Provides utilities for advanced E2E testing with Playwright
 */

import { contextManager } from '@kitiumai/logger';
import { expect, type Page } from '@playwright/test';

import { getPlaywrightLogger } from '../internal/logger';

type TestHelperWindow = Window & {
  __testData?: Record<string, unknown>;
  __dialogText?: string;
  __dialogShown?: () => void;
  __lastRect?: DOMRect;
};

type FormFieldValue = string | boolean;

interface StorageCookieOptions {
  url?: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface ConsoleLogEntry {
  type: string;
  text: string;
  args: string[];
  traceId?: string;
  requestId?: string;
  timestamp: number;
}

/**
 * Test data helper for E2E tests
 */
export class E2ETestData {
  private readonly storage: Map<string, unknown> = new Map();

  /**
   * Store test data
   */
  store(key: string, value: unknown): void {
    this.storage.set(key, value);
  }

  /**
   * Retrieve test data
   */
  retrieve<T>(key: string): T | undefined {
    return this.storage.get(key) as T | undefined;
  }

  /**
   * Store in page context
   */
  async storeInPage(page: Page, key: string, value: unknown): Promise<void> {
    await page.evaluate(
      ({ k, v }) => {
        const win = window as TestHelperWindow;
        win.__testData = win.__testData ?? {};
        win.__testData[k] = v;
      },
      { k: key, v: value }
    );
  }

  /**
   * Retrieve from page context
   */
  async retrieveFromPage<T>(page: Page, key: string): Promise<T | undefined> {
    return await page.evaluate(
      ({ k }) => {
        const win = window as TestHelperWindow;
        return win.__testData?.[k] as T | undefined;
      },
      { k: key }
    );
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.storage.clear();
  }
}

/**
 * Form helper for E2E tests
 */
export class FormHelper {
  constructor(private readonly page: Page) {}

  /**
   * Fill form field
   */
  async fillField(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).fill(value);
  }

  /**
   * Fill multiple fields
   */
  async fillFields(fields: Record<string, string>): Promise<void> {
    for (const [selector, value] of Object.entries(fields)) {
      await this.fillField(selector, value);
    }
  }

  /**
   * Select dropdown option
   */
  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).selectOption(value);
  }

  /**
   * Check checkbox
   */
  async check(selector: string): Promise<void> {
    await this.page.locator(selector).check();
  }

  /**
   * Uncheck checkbox
   */
  async uncheck(selector: string): Promise<void> {
    await this.page.locator(selector).uncheck();
  }

  /**
   * Get form data
   */
  async getFormData(selector: string): Promise<Record<string, FormFieldValue>> {
    return await this.page.locator(selector).evaluate((form) => {
      const data: Record<string, FormFieldValue> = {};
      const elements = (form as HTMLFormElement).elements;

      for (let index = 0; index < elements.length; index++) {
        const element = elements[index] as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;
        if (!element?.name) {
          continue;
        }
        if (element instanceof HTMLInputElement && element.type === 'checkbox') {
          data[element.name] = element.checked;
        } else if (element instanceof HTMLInputElement && element.type === 'radio') {
          if (element.checked) {
            data[element.name] = element.value;
          }
        } else {
          data[element.name] = element.value;
        }
      }

      return data;
    });
  }

  /**
   * Submit form
   */
  async submit(selector: string): Promise<void> {
    await this.page.locator(selector).evaluate((form) => {
      (form as HTMLFormElement).submit();
    });
  }

  /**
   * Reset form
   */
  async reset(selector: string): Promise<void> {
    await this.page.locator(selector).evaluate((form) => {
      (form as HTMLFormElement).reset();
    });
  }
}

/**
 * Table helper for E2E tests
 */
export class TableHelper {
  constructor(private readonly page: Page) {}

  /**
   * Get table data
   */
  async getTableData(tableSelector: string): Promise<Array<Record<string, string>>> {
    return await this.page.locator(tableSelector).evaluate((table) => {
      const rows: Array<Record<string, string>> = [];
      const headers: string[] = [];

      // Get headers
      const headerCells = table.querySelectorAll('thead th');
      headerCells.forEach((cell) => {
        headers.push(cell.textContent?.trim() ?? '');
      });

      // Get rows
      const bodyRows = table.querySelectorAll('tbody tr');
      bodyRows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        const rowData: Record<string, string> = {};

        cells.forEach((cell, cellIndex) => {
          rowData[headers[cellIndex] ?? ''] = cell.textContent?.trim() ?? '';
        });

        rows.push(rowData);
      });

      return rows;
    });
  }

  /**
   * Get row count
   */
  async getRowCount(tableSelector: string): Promise<number> {
    return await this.page.locator(`${tableSelector} tbody tr`).count();
  }

  /**
   * Find row by content
   */
  async findRow(tableSelector: string, content: string): Promise<number> {
    const rows = await this.getTableData(tableSelector);
    return rows.findIndex((row) => Object.values(row).some((value) => value.includes(content)));
  }

  /**
   * Get cell value
   */
  async getCellValue(tableSelector: string, rowIndex: number, columnName: string): Promise<string> {
    const rows = await this.getTableData(tableSelector);
    return rows[rowIndex]?.[columnName] ?? '';
  }
}

/**
 * Modal/Dialog helper for E2E tests
 */
export class DialogHelper {
  constructor(private readonly page: Page) {}

  /**
   * Wait for dialog
   */
  async waitForDialog(timeout = 5000): Promise<string> {
    return await this.page.evaluate(
      ({ timeoutMs }) => {
        return new Promise<string>((resolve) => {
          const timeoutId = setTimeout(() => resolve(''), timeoutMs);

          const win = window as TestHelperWindow;
          win.__dialogText = '';
          win.__dialogShown = () => {
            clearTimeout(timeoutId);
            resolve(win.__dialogText ?? '');
          };
        });
      },
      { timeoutMs: timeout }
    );
  }

  /**
   * Is dialog visible
   */
  async isDialogVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible({ timeout: 1000 });
    } catch {
      return false;
    }
  }

  /**
   * Close dialog
   */
  async closeDialog(closeButtonSelector: string): Promise<void> {
    await this.page.locator(closeButtonSelector).click();
  }

  /**
   * Confirm dialog
   */
  async confirmDialog(confirmButtonSelector: string): Promise<void> {
    await this.page.locator(confirmButtonSelector).click();
  }

  /**
   * Get dialog content
   */
  async getDialogContent(dialogSelector: string): Promise<string> {
    return (await this.page.locator(dialogSelector).textContent()) ?? '';
  }
}

/**
 * Navigation helper for E2E tests
 */
export class NavigationHelper {
  constructor(private readonly page: Page) {}

  /**
   * Navigate and wait for load
   */
  async navigateTo(
    url: string,
    waitUntilOption: 'load' | 'domcontentloaded' = 'domcontentloaded'
  ): Promise<void> {
    await this.page.goto(url, { waitUntil: waitUntilOption });
  }

  /**
   * Go back
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  /**
   * Go forward
   */
  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  /**
   * Reload page
   */
  async reload(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Check current URL
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  /**
   * Wait for URL change
   */
  async waitForURLChange(timeout = 5000): Promise<string> {
    const previousURL = this.getCurrentURL();
    await this.page.waitForFunction(() => window.location.href !== previousURL, { timeout });
    return this.getCurrentURL();
  }

  /**
   * Navigate using link
   */
  async clickLink(selector: string): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      this.page.locator(selector).click(),
    ]);
  }
}

/**
 * Wait helper for E2E tests
 */
export class WaitHelper {
  constructor(private readonly page: Page) {}

  /**
   * Wait for element to be stable (stop moving/changing)
   */
  async waitForStableElement(selector: string, timeout = 5000): Promise<void> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout });

    // Wait for position to stabilize
    await this.page.waitForFunction(
      (sel) => {
        const element = document.querySelector(sel) as HTMLElement;
        if (!element) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        const win = window as TestHelperWindow;
        win.__lastRect = win.__lastRect ?? rect;

        const isStable = rect.top === win.__lastRect.top && rect.left === win.__lastRect.left;

        win.__lastRect = rect;
        return isStable;
      },
      selector,
      { timeout: 2000 }
    );
  }

  /**
   * Wait for element count
   */
  async waitForElementCount(
    selector: string,
    expectedCount: number,
    timeout = 5000
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ sel, count }) => document.querySelectorAll(sel).length === count,
      { sel: selector, count: expectedCount },
      { timeout }
    );
  }

  /**
   * Wait for text to appear
   */
  async waitForText(text: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction((txt) => document.body.innerText.includes(txt), text, {
      timeout,
    });
  }

  /**
   * Wait for condition
   */
  async waitForCondition(condition: () => boolean, timeout = 5000): Promise<void> {
    await this.page.waitForFunction(condition, { timeout });
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(timeout = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }
}

/**
 * Screenshot helper for E2E tests
 */
export class ScreenshotHelper {
  constructor(private readonly page: Page) {}

  /**
   * Take screenshot of full page
   */
  async takeFullPageScreenshot(path: string): Promise<void> {
    await this.page.screenshot({ path, fullPage: true });
  }

  /**
   * Take screenshot of element
   */
  async takeElementScreenshot(selector: string, path: string): Promise<void> {
    const locator = this.page.locator(selector);
    await locator.screenshot({ path });
  }

  /**
   * Compare screenshots
   */
  async compareScreenshots(_current: string, baseline: string): Promise<boolean> {
    // This is a simplified comparison - in real scenarios, use visual regression tools
    try {
      await expect(this.page).toHaveScreenshot(baseline, {
        maxDiffPixels: 0,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Cookie/Storage helper for E2E tests
 */
export class StorageHelper {
  constructor(private readonly page: Page) {}

  /**
   * Set cookie
   */
  async setCookie(name: string, value: string, options?: StorageCookieOptions): Promise<void> {
    const context = this.page.context();
    const cookieUrl = options?.url ?? this.page.url();
    const cookie: Parameters<(typeof context)['addCookies']>[0][number] = {
      name,
      value,
      url: cookieUrl,
      path: options?.path ?? '/',
    };

    if (options?.domain !== undefined) {
      cookie.domain = options.domain;
    }
    if (options?.expires !== undefined) {
      cookie.expires = options.expires;
    }
    if (options?.httpOnly !== undefined) {
      cookie.httpOnly = options.httpOnly;
    }
    if (options?.secure !== undefined) {
      cookie.secure = options.secure;
    }
    if (options?.sameSite !== undefined) {
      cookie.sameSite = options.sameSite;
    }

    await context.addCookies([cookie]);
  }

  /**
   * Get cookie
   */
  async getCookie(name: string): Promise<string | undefined> {
    const context = this.page.context();
    const cookies = await context.cookies();
    return cookies.find((c) => c.name === name)?.value;
  }

  /**
   * Clear cookies
   */
  async clearCookies(): Promise<void> {
    const context = this.page.context();
    await context.clearCookies();
  }

  /**
   * Set local storage
   */
  async setLocalStorage(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ k, v }) => {
        localStorage.setItem(k, v);
      },
      { k: key, v: value }
    );
  }

  /**
   * Get local storage
   */
  async getLocalStorage(key: string): Promise<string | null> {
    return await this.page.evaluate(
      ({ k }) => {
        return localStorage.getItem(k);
      },
      { k: key }
    );
  }

  /**
   * Clear local storage
   */
  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
    });
  }

  /**
   * Set session storage
   */
  async setSessionStorage(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ k, v }) => {
        sessionStorage.setItem(k, v);
      },
      { k: key, v: value }
    );
  }

  /**
   * Clear session storage
   */
  async clearSessionStorage(): Promise<void> {
    await this.page.evaluate(() => {
      sessionStorage.clear();
    });
  }
}

/**
 * Console helper for E2E tests
 * Integrates with @kitiumai/logger for structured logging
 */
export class ConsoleHelper {
  private logs: ConsoleLogEntry[] = [];
  private errors: ConsoleLogEntry[] = [];
  private warnings: ConsoleLogEntry[] = [];
  private readonly logger = getPlaywrightLogger();

  constructor(page: Page) {
    const context = contextManager.getContext();
    page.on('console', (message) => {
      const args = message.args().map((argument) => argument.toString());
      const logEntry: ConsoleLogEntry = {
        type: message.type(),
        text: message.text(),
        args,
        timestamp: Date.now(),
      };
      if (context.traceId) {
        logEntry.traceId = context.traceId;
      }
      if (context.requestId) {
        logEntry.requestId = context.requestId;
      }

      // Store for test assertions
      const messageType = message.type();
      if (messageType === 'log') {
        this.logs.push(logEntry);
      } else if (messageType === 'error') {
        this.errors.push(logEntry);
        this.logger.error('Browser console error', {
          message: message.text(),
          traceId: context.traceId,
          pageUrl: page.url(),
        });
      } else if (messageType === 'warning') {
        this.warnings.push(logEntry);
        this.logger.warn('Browser console warning', {
          message: message.text(),
          traceId: context.traceId,
          pageUrl: page.url(),
        });
      }
      // Other console types (info, debug, etc.) are ignored for now
    });
  }

  /**
   * Get logs
   */
  getLogs(): ConsoleLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get errors
   */
  getErrors(): ConsoleLogEntry[] {
    return [...this.errors];
  }

  /**
   * Get warnings
   */
  getWarnings(): ConsoleLogEntry[] {
    return [...this.warnings];
  }

  /**
   * Assert no errors
   */
  assertNoErrors(): void {
    if (this.errors.length > 0) {
      const errorMessages = this.errors.map((e) => e.text).join(', ');
      this.logger.error('Console errors detected in test', {
        errorCount: this.errors.length,
        errors: errorMessages,
      });
      throw new Error(`Found ${this.errors.length} console errors: ${errorMessages}`);
    }
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
    this.errors = [];
    this.warnings = [];
  }
}

/**
 * Create E2E test data helper
 */
export function createE2ETestData(): E2ETestData {
  return new E2ETestData();
}

/**
 * Create form helper
 */
export function createFormHelper(page: Page): FormHelper {
  return new FormHelper(page);
}

/**
 * Create table helper
 */
export function createTableHelper(page: Page): TableHelper {
  return new TableHelper(page);
}

/**
 * Create dialog helper
 */
export function createDialogHelper(page: Page): DialogHelper {
  return new DialogHelper(page);
}

/**
 * Create navigation helper
 */
export function createNavigationHelper(page: Page): NavigationHelper {
  return new NavigationHelper(page);
}

/**
 * Create wait helper
 */
export function createWaitHelper(page: Page): WaitHelper {
  return new WaitHelper(page);
}

/**
 * Create screenshot helper
 */
export function createScreenshotHelper(page: Page): ScreenshotHelper {
  return new ScreenshotHelper(page);
}

/**
 * Create storage helper
 */
export function createStorageHelper(page: Page): StorageHelper {
  return new StorageHelper(page);
}

/**
 * Create console helper
 */
export function createConsoleHelper(page: Page): ConsoleHelper {
  return new ConsoleHelper(page);
}

/**
 * Composite helper - combines all helpers
 */
export class E2ETestHelper {
  readonly data: E2ETestData;
  readonly form: FormHelper;
  readonly table: TableHelper;
  readonly dialog: DialogHelper;
  readonly navigation: NavigationHelper;
  readonly wait: WaitHelper;
  readonly screenshot: ScreenshotHelper;
  readonly storage: StorageHelper;
  readonly console: ConsoleHelper;

  constructor(page: Page) {
    this.data = createE2ETestData();
    this.form = createFormHelper(page);
    this.table = createTableHelper(page);
    this.dialog = createDialogHelper(page);
    this.navigation = createNavigationHelper(page);
    this.wait = createWaitHelper(page);
    this.screenshot = createScreenshotHelper(page);
    this.storage = createStorageHelper(page);
    this.console = createConsoleHelper(page);
  }
}

/**
 * Create composite E2E test helper
 */
export function createE2ETestHelper(page: Page): E2ETestHelper {
  return new E2ETestHelper(page);
}
