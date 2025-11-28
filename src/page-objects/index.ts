/**
 * Page Object Model framework for Playwright
 * Integrates with @kitiumai/test-core/logger for structured logging and tracing
 */

import { type Page, type Locator } from '@playwright/test';
import { contextManager } from '@kitiumai/logger';
import { getTestLogger } from '@kitiumai/test-core';
import { traceTest } from '../tracing';
import { strictLocator, warnOnNonSemantic } from '../accessibility/semantic-locator';

export interface PageObjectOptions {
  baseUrl?: string;
  waitTimeout?: number;
}

/**
 * Base page object class with enhanced capabilities
 */
export abstract class BasePage {
  protected page: Page;
  protected baseUrl: string;
  protected waitTimeout: number;
  protected retryAttempts: number;
  protected autoScreenshot: boolean;
  protected readonly logger = getTestLogger();

  constructor(page: Page, options: PageObjectOptions = {}) {
    this.page = page;
    this.baseUrl = options.baseUrl ?? '';
    this.waitTimeout = options.waitTimeout ?? 30000;
    this.retryAttempts = 3;
    this.autoScreenshot = true;
  }

  /**
   * Navigate to page
   */
  async goto(
    path = '/',
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }
  ): Promise<void> {
    const context = contextManager.getContext();
    const url = this.baseUrl + path;

    return traceTest(
      'page.goto',
      async (spanId) => {
        this.logger.info('Navigating to page', {
          traceId: context.traceId,
          spanId,
          url,
          path,
        });

        await this.page.goto(url, { waitUntil: options?.waitUntil ?? 'domcontentloaded' });
        await this.waitForReady();

        this.logger.debug('Page navigation completed', {
          traceId: context.traceId,
          spanId,
          url: this.page.url(),
        });
      },
      { url, path, waitUntil: options?.waitUntil ?? 'domcontentloaded' }
    );
  }

  /**
   * Wait for page to be ready (smart detection)
   */
  async waitForReady(): Promise<void> {
    // Wait for DOM to be ready
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for no pending network requests (with timeout)
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      // Ignore timeout, page might have long-polling
    });
  }

  /**
   * Get page URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Smart click with auto-retry and multiple selector strategies
   */
  async smartClick(
    identifier: string,
    options?: { timeout?: number; force?: boolean }
  ): Promise<void> {
    const strategies = this.generateSelectorStrategies(identifier);
    const timeout = options?.timeout ?? this.waitTimeout;

    try {
      const locator = strictLocator(this.page, { testId: identifier, name: identifier }, { warnOnCss: true });
      await locator.click({ timeout, force: options?.force });
      return;
    } catch {
      // fallback to heuristics when semantic locator fails
    }

    for (const selector of strategies) {
      try {
        const locator = this.page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout: 2000 });
        const clickOptions: { timeout: number; force?: boolean } = { timeout };
        if (options?.force !== undefined) {
          clickOptions.force = options.force;
        }
        await locator.click(clickOptions);
        return;
      } catch (_error) {
        // Try next strategy
        continue;
      }
    }

    // All strategies failed
    await this.handleError(
      'smartClick',
      identifier,
      strategies,
      'Could not click element with any selector strategy'
    );
  }

  /**
   * Click an element with retry
   */
  async click(
    selector: string | Locator,
    options?: { timeout?: number; force?: boolean }
  ): Promise<void> {
    const context = contextManager.getContext();
    const selectorStr = typeof selector === 'string' ? selector : '<Locator>';

    return traceTest(
      'page.click',
      async (spanId) => {
        this.logger.debug('Clicking element', {
          traceId: context.traceId,
          spanId,
          selector: selectorStr,
        });

        const locator = this.resolveLocator(selector);
        const timeout = options?.timeout ?? this.waitTimeout;

        let lastError: Error | undefined;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
          try {
            const clickOptions: { timeout: number; force?: boolean } = { timeout };
            if (options?.force !== undefined) {
              clickOptions.force = options.force;
            }
            await locator.click(clickOptions);

            this.logger.debug('Click successful', {
              traceId: context.traceId,
              spanId,
              selector: selectorStr,
              attempt,
            });
            return;
          } catch (_error) {
            const err = _error instanceof Error ? _error : new Error(String(_error));
            lastError = err;
            this.logger.warn('Click attempt failed', {
              traceId: context.traceId,
              spanId,
              selector: selectorStr,
              attempt,
              error: err.message,
            });

            if (attempt < this.retryAttempts) {
              await this.page.waitForTimeout(500 * attempt); // Progressive delay
            }
          }
        }

        await this.handleError(
          'click',
          selectorStr,
          [],
          lastError?.message ?? 'Click failed after retries'
        );
      },
      { selector: selectorStr, timeout: options?.timeout, force: options?.force }
    );
  }

  /**
   * Type text into an element with auto-retry
   */
  async type(
    selector: string | Locator,
    text: string,
    options?: { delay?: number }
  ): Promise<void> {
    const context = contextManager.getContext();
    const selectorStr = typeof selector === 'string' ? selector : '<Locator>';

    return traceTest(
      'page.type',
      async (spanId) => {
        this.logger.debug('Typing into element', {
          traceId: context.traceId,
          spanId,
          selector: selectorStr,
          textLength: text.length,
        });

        const locator = this.resolveLocator(selector);

        let lastError: Error | undefined;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
          try {
            await locator.fill(''); // Clear first
            await locator.type(text, { delay: options?.delay ?? 0 });

            this.logger.debug('Type successful', {
              traceId: context.traceId,
              spanId,
              selector: selectorStr,
              attempt,
            });
            return;
          } catch (_error) {
            const err = _error instanceof Error ? _error : new Error(String(_error));
            lastError = err;
            this.logger.warn('Type attempt failed', {
              traceId: context.traceId,
              spanId,
              selector: selectorStr,
              attempt,
              error: err.message,
            });

            if (attempt < this.retryAttempts) {
              await this.page.waitForTimeout(500 * attempt);
            }
          }
        }

        await this.handleError(
          'type',
          selectorStr,
          [],
          lastError?.message ?? 'Type failed after retries'
        );
      },
      { selector: selectorStr, textLength: text.length, delay: options?.delay }
    );
  }

  /**
   * Get text content
   */
  async getText(selector: string | Locator): Promise<string | null> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    return await locator.textContent();
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string | Locator): Promise<boolean> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    return await locator.isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * Wait for element with smart strategies
   */
  async waitForElement(
    identifier: string,
    options?: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' }
  ): Promise<Locator> {
    const strategies = this.generateSelectorStrategies(identifier);
    const timeout = options?.timeout ?? this.waitTimeout;
    const state = options?.state ?? 'visible';

    for (const selector of strategies) {
      try {
        const locator = this.page.locator(selector).first();
        await locator.waitFor({ state, timeout: Math.floor(timeout / strategies.length) });
        return locator;
      } catch (_error) {
        continue;
      }
    }

    await this.handleError(
      'waitForElement',
      identifier,
      strategies,
      `Element not found in ${state} state`
    );
    throw new Error('Unreachable'); // TypeScript needs this
  }

  /**
   * Get element count
   */
  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  /**
   * Fill form field with smart detection
   */
  async fillField(identifier: string, value: string): Promise<void> {
    const strategies = this.generateSelectorStrategies(identifier);

    for (const selector of strategies) {
      try {
        const field = this.page.locator(selector).first();
        await field.waitFor({ state: 'visible', timeout: 2000 });
        await field.fill(value);
        return;
      } catch (_error) {
        continue;
      }
    }

    await this.handleError(
      'fillField',
      identifier,
      strategies,
      'Could not fill field with any selector strategy'
    );
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    const select = this.page.locator(selector);
    await select.selectOption(value);
  }

  /**
   * Check checkbox
   */
  async checkCheckbox(selector: string): Promise<void> {
    const checkbox = this.page.locator(selector);
    await checkbox.check();
  }

  /**
   * Uncheck checkbox
   */
  async uncheckCheckbox(selector: string): Promise<void> {
    const checkbox = this.page.locator(selector);
    await checkbox.uncheck();
  }

  /**
   * Wait for URL to match
   */
  async waitForUrl(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout: this.waitTimeout });
  }

  /**
   * Get attribute value
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const element = this.page.locator(selector);
    return await element.getAttribute(attribute);
  }

  /**
   * Execute JavaScript
   */
  async execute<T>(script: string | ((arg?: unknown) => T), arg?: unknown): Promise<T> {
    if (typeof script === 'function') {
      return await this.page.evaluate(script, arg);
    }
    return await this.page.evaluate(script as string, arg);
  }

  /**
   * Reload page
   */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForReady();
  }

  /**
   * Go back
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
    await this.waitForReady();
  }

  /**
   * Go forward
   */
  async goForward(): Promise<void> {
    await this.page.goForward();
    await this.waitForReady();
  }

  /**
   * Resolve a locator with semantic-first strategy
   */
  private resolveLocator(selector: string | Locator): Locator {
    if (typeof selector !== 'string') {
      return selector;
    }

    warnOnNonSemantic(selector);

    try {
      return strictLocator(
        this.page,
        {
          testId: selector,
          name: selector,
          css: selector,
        },
        { warnOnCss: true }
      );
    } catch {
      return this.page.locator(selector);
    }
  }

  /**
   * Generate selector strategies for smart element location
   */
  private generateSelectorStrategies(identifier: string): string[] {
    const strategies: string[] = [];

    // Data-testid variations (semantic first)
    strategies.push(`[data-testid="${identifier}"]`);
    strategies.push(`[data-test="${identifier}"]`);
    strategies.push(`[data-cy="${identifier}"]`);

    // ARIA label and roles
    strategies.push(`[aria-label="${identifier}"]`);
    
    // Name attribute
    strategies.push(`[name="${identifier}"]`);

    // ID (if no spaces)
    if (!identifier.includes(' ')) {
      strategies.push(`#${identifier}`);
    }

    // If it looks like a valid CSS selector, try it after semantic options
    if (
      identifier.includes('[') ||
      identifier.startsWith('#') ||
      identifier.startsWith('.') ||
      identifier.includes('>')
    ) {
      strategies.push(identifier);
    }

    // Text content
    strategies.push(`text="${identifier}"`);
    strategies.push(`button:has-text("${identifier}")`);
    strategies.push(`a:has-text("${identifier}")`);

    return strategies;
  }

  /**
   * Handle errors with enhanced messaging and optional screenshot
   */
  private async handleError(
    action: string,
    identifier: string,
    triedSelectors: string[],
    errorMessage: string
  ): Promise<never> {
    let screenshotPath: string | undefined;

    if (this.autoScreenshot) {
      try {
        const timestamp = Date.now();
        screenshotPath = `./test-results/screenshots/error-${action}-${timestamp}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (_e) {
        // Ignore screenshot errors
      }
    }

    const error = new Error(errorMessage);
    const enhancedMessage = [
      `❌ ${action} failed for: ${identifier}`,
      `Page: ${this.page.url()}`,
      triedSelectors.length > 0 ? `Tried selectors:\n  - ${triedSelectors.join('\n  - ')}` : '',
      screenshotPath ? `Screenshot: ${screenshotPath}` : '',
      `💡 Suggestion: Verify the element exists and is ${action === 'click' ? 'clickable' : 'interactable'}`,
    ]
      .filter(Boolean)
      .join('\n');

    error.message = enhancedMessage;
    throw error;
  }
}

/**
 * Specific page object for common application structure
 */
export class ApplicationPage extends BasePage {
  /**
   * Wait for navigation
   */
  async waitForNavigation<T>(action: () => Promise<T>): Promise<T> {
    const navigationPromise = this.page.waitForNavigation();
    const result = await action();
    await navigationPromise;
    return result;
  }

  /**
   * Accept dialog
   */
  async acceptDialog(): Promise<void> {
    this.page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
  }

  /**
   * Dismiss dialog
   */
  async dismissDialog(): Promise<void> {
    this.page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });
  }

  /**
   * Get dialog message
   */
  async getDialogMessage(): Promise<string | null> {
    return new Promise((resolve) => {
      this.page.on('dialog', (dialog) => {
        resolve(dialog.message() ?? null);
      });
    });
  }

  /**
   * Focus element
   */
  async focus(selector: string): Promise<void> {
    await this.page.locator(selector).focus();
  }

  /**
   * Hover element
   */
  async hover(selector: string): Promise<void> {
    await this.page.locator(selector).hover();
  }

  /**
   * Scroll to element
   */
  async scrollToElement(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Get bounding box of element
   */
  async getBoundingBox(
    selector: string
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return await this.page.locator(selector).boundingBox();
  }
}

/**
 * Create page object instance
 */
export function createPageObject<T extends BasePage>(
  PageObjectClass: new (page: Page, options?: PageObjectOptions) => T,
  page: Page,
  options?: PageObjectOptions
): T {
  return new PageObjectClass(page, options);
}

/**
 * Page object registry
 */
export class PageObjectRegistry {
  private readonly pages: Map<string, BasePage> = new Map();

  register<T extends BasePage>(name: string, page: T): void {
    this.pages.set(name, page);
  }

  get<T extends BasePage>(name: string): T {
    const page = this.pages.get(name);
    if (!page) {
      throw new Error(`Page object '${name}' not found in registry`);
    }
    return page as T;
  }

  getAll(): Map<string, BasePage> {
    return new Map(this.pages);
  }

  clear(): void {
    this.pages.clear();
  }
}

/**
 * Create page object registry
 */
export function createPageObjectRegistry(): PageObjectRegistry {
  return new PageObjectRegistry();
}
