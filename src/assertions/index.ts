/**
 * Custom assertions for Playwright tests
 */

import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Assert element has specific text
 */
export async function assertTextContent(locator: Locator, expectedText: string): Promise<void> {
  await expect(locator).toContainText(expectedText);
}

/**
 * Assert element is hidden
 */
export async function assertIsHidden(locator: Locator): Promise<void> {
  await expect(locator).toBeHidden();
}

/**
 * Assert element is visible
 */
export async function assertIsVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
}

/**
 * Assert element is enabled
 */
export async function assertIsEnabled(locator: Locator): Promise<void> {
  await expect(locator).toBeEnabled();
}

/**
 * Assert element is disabled
 */
export async function assertIsDisabled(locator: Locator): Promise<void> {
  await expect(locator).toBeDisabled();
}

/**
 * Assert URL matches pattern
 */
export async function assertUrlMatches(page: Page, pattern: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(pattern);
}

/**
 * Assert element has attribute
 */
export async function assertHasAttribute(
  locator: Locator,
  attribute: string,
  value?: string
): Promise<void> {
  if (value) {
    await expect(locator).toHaveAttribute(attribute, value);
  } else {
    await expect(locator).toHaveAttribute(attribute, /.*./);
  }
}

/**
 * Assert element has class
 */
export async function assertHasClass(locator: Locator, className: string): Promise<void> {
  const classes = await locator.getAttribute('class');
  const hasClass = classes?.includes(className) ?? false;
  if (!hasClass) {
    throw new Error(`Expected element to have class '${className}', but got '${classes}'`);
  }
}

/**
 * Assert element count matches
 */
export async function assertElementCount(locator: Locator, expectedCount: number): Promise<void> {
  await expect(locator).toHaveCount(expectedCount);
}

/**
 * Assert page title
 */
export async function assertPageTitle(page: Page, expectedTitle: string): Promise<void> {
  await expect(page).toHaveTitle(expectedTitle);
}

/**
 * Assert element value
 */
export async function assertElementValue(locator: Locator, expectedValue: string): Promise<void> {
  await expect(locator).toHaveValue(expectedValue);
}

/**
 * Assert element is checked
 */
export async function assertIsChecked(locator: Locator): Promise<void> {
  await expect(locator).toBeChecked();
}

/**
 * Assert element is not checked
 */
export async function assertIsNotChecked(locator: Locator): Promise<void> {
  const isChecked = await locator.isChecked();
  if (isChecked) {
    throw new Error('Expected element to be unchecked');
  }
}

/**
 * Assert text appears somewhere on page
 */
export async function assertTextAppears(page: Page, text: string): Promise<void> {
  const textLocator = page.locator(`text=${text}`);
  await expect(textLocator).toBeVisible();
}

/**
 * Assert text does not appear on page
 */
export async function assertTextNotAppears(page: Page, text: string): Promise<void> {
  const textLocator = page.locator(`text=${text}`);
  const isVisible = await textLocator.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error(`Expected text '${text}' not to appear on page`);
  }
}

/**
 * Assert console messages
 */
export async function assertConsoleMessages(page: Page, expectedMessages: string[]): Promise<void> {
  const messages: string[] = [];
  page.on('console', (msg) => messages.push(msg.text()));

  // Give time for messages to accumulate
  await page.waitForTimeout(100);

  expectedMessages.forEach((expected) => {
    if (!messages.some((msg) => msg.includes(expected))) {
      throw new Error(`Expected console message containing '${expected}' not found`);
    }
  });
}

/**
 * Assert no console errors
 */
export async function assertNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  if (errors.length > 0) {
    throw new Error(`Expected no console errors, but found: ${errors.join(', ')}`);
  }
}

/**
 * Assert HTTP response status
 */
export async function assertResponseStatus(
  page: Page,
  urlPattern: string | RegExp,
  expectedStatus: number
): Promise<void> {
  const response = await page.waitForResponse((resp) => {
    const url = resp.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });

  if (response.status() !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, but got ${response.status()}`);
  }
}

/**
 * Assertion builder for fluent API
 */
export class AssertionBuilder {
  constructor(
    private readonly page: Page,
    private readonly locator?: Locator
  ) {}

  hasText(text: string): this {
    if (this.locator) {
      void expect(this.locator).toContainText(text);
    }
    return this;
  }

  isVisible(): this {
    if (this.locator) {
      void expect(this.locator).toBeVisible();
    }
    return this;
  }

  isHidden(): this {
    if (this.locator) {
      void expect(this.locator).toBeHidden();
    }
    return this;
  }

  isEnabled(): this {
    if (this.locator) {
      void expect(this.locator).toBeEnabled();
    }
    return this;
  }

  isDisabled(): this {
    if (this.locator) {
      void expect(this.locator).toBeDisabled();
    }
    return this;
  }

  hasAttribute(attribute: string, value?: string): this {
    if (this.locator) {
      if (value) {
        void expect(this.locator).toHaveAttribute(attribute, value);
      } else {
        void expect(this.locator).toHaveAttribute(attribute, /.*./);
      }
    }
    return this;
  }

  hasValue(value: string): this {
    if (this.locator) {
      void expect(this.locator).toHaveValue(value);
    }
    return this;
  }

  isChecked(): this {
    if (this.locator) {
      void expect(this.locator).toBeChecked();
    }
    return this;
  }

  pageUrlMatches(pattern: string | RegExp): this {
    void expect(this.page).toHaveURL(pattern);
    return this;
  }

  pageTitle(title: string): this {
    void expect(this.page).toHaveTitle(title);
    return this;
  }
}

/**
 * Create assertion builder
 */
export function createAssertion(page: Page, locator?: Locator): AssertionBuilder {
  return new AssertionBuilder(page, locator);
}
