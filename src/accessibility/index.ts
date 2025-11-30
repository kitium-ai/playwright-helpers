/**
 * Accessibility testing helpers for Playwright
 * Integrates with @kitiumai/test-core/logger for structured logging
 */

import { contextManager } from '@kitiumai/logger';
import { getTestLogger } from '@kitiumai/test-core';
import type { Locator, Page } from '@playwright/test';

export interface A11yIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
  code?: string;
}

export interface A11yCheckResult {
  passes: boolean;
  issues: A11yIssue[];
  stats: {
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Accessibility checker
 */
export class AccessibilityChecker {
  private readonly logger = getTestLogger();

  /**
   * Check for missing alt text on images
   */
  async checkImageAltText(page: Page): Promise<A11yIssue[]> {
    const context = contextManager.getContext();
    this.logger.debug('Checking image alt text', { traceId: context.traceId });

    const issues: A11yIssue[] = [];

    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (!alt || alt.trim() === '') {
        const source = await img.getAttribute('src');
        issues.push({
          type: 'error',
          message: `Image missing alt text: ${source}`,
          element: 'img',
          code: 'image-alt',
        });
      }
    }

    return issues;
  }

  /**
   * Check for proper heading hierarchy
   */
  async checkHeadingHierarchy(page: Page): Promise<A11yIssue[]> {
    const context = contextManager.getContext();
    this.logger.debug('Checking heading hierarchy', { traceId: context.traceId });

    const issues: A11yIssue[] = [];

    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let previousLevel = 0;

    for (const heading of headings) {
      const tagName = await heading.evaluate((element) => element.tagName);
      const currentLevel = parseInt(tagName.charAt(1));

      if (currentLevel > previousLevel + 1) {
        const text = await heading.textContent();
        issues.push({
          type: 'error',
          message: `Heading hierarchy broken: ${tagName} after H${previousLevel}. Text: "${text}"`,
          element: tagName,
          code: 'heading-hierarchy',
        });
      }

      previousLevel = currentLevel;
    }

    return issues;
  }

  /**
   * Check for form labels
   */
  async checkFormLabels(page: Page): Promise<A11yIssue[]> {
    const context = contextManager.getContext();
    this.logger.debug('Checking form labels', { traceId: context.traceId });

    const issues: A11yIssue[] = [];

    const inputs = await page.locator('input, textarea, select').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');

      if (!ariaLabel && !ariaLabelledby) {
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          if (label === 0) {
            issues.push({
              type: 'error',
              message: `Form input missing associated label: ${id}`,
              element: 'input',
              code: 'form-label',
            });
          }
        } else {
          issues.push({
            type: 'error',
            message: 'Form input missing label or aria-label',
            element: 'input',
            code: 'form-label',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for color contrast
   */
  async checkColorContrast(page: Page): Promise<A11yIssue[]> {
    const issues: A11yIssue[] = [];

    const elements = await page.locator('*:visible').all();
    for (const element of elements.slice(0, 100)) {
      // Sample check to avoid performance issues
      const styles = await element.evaluate((element_) => {
        const computed = window.getComputedStyle(element_);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
        };
      });

      // Simple contrast check (simplified)
      if (
        styles.color === 'rgb(128, 128, 128)' &&
        styles.backgroundColor === 'rgb(192, 192, 192)'
      ) {
        issues.push({
          type: 'warning',
          message: 'Potential low color contrast detected',
          code: 'color-contrast',
        });
      }
    }

    return issues;
  }

  /**
   * Check for keyboard navigation
   */
  async checkKeyboardNavigation(page: Page): Promise<A11yIssue[]> {
    const issues: A11yIssue[] = [];

    const interactiveElements = await page.locator('button, a, input, [role="button"]').all();

    if (interactiveElements.length === 0) {
      issues.push({
        type: 'info',
        message: 'No interactive elements found',
        code: 'keyboard-nav',
      });
    }

    // Check if elements are focusable
    for (const element of interactiveElements.slice(0, 10)) {
      const tabindex = await element.getAttribute('tabindex');
      if (tabindex === '-1') {
        const text = await element.textContent();
        issues.push({
          type: 'warning',
          message: `Element not keyboard accessible (tabindex=-1): "${text}"`,
          code: 'keyboard-nav',
        });
      }
    }

    return issues;
  }

  /**
   * Check for ARIA attributes
   */
  async checkAriaAttributes(page: Page): Promise<A11yIssue[]> {
    const issues: A11yIssue[] = [];

    const elementsWithRole = await page.locator('[role]').all();
    for (const element of elementsWithRole) {
      const role = await element.getAttribute('role');
      const tag = await element.evaluate((element_) => element_.tagName);

      // Check for common aria issues
      if (role === 'button' && tag !== 'BUTTON' && tag !== 'A') {
        const ariaPressed = await element.getAttribute('aria-pressed');
        if (!ariaPressed) {
          issues.push({
            type: 'warning',
            message: `Element with role="button" should have aria-pressed: ${tag}`,
            code: 'aria-attributes',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Run full accessibility check
   */
  async fullCheck(page: Page): Promise<A11yCheckResult> {
    const issues: A11yIssue[] = [];

    // Run all checks
    issues.push(...(await this.checkImageAltText(page)));
    issues.push(...(await this.checkHeadingHierarchy(page)));
    issues.push(...(await this.checkFormLabels(page)));
    issues.push(...(await this.checkColorContrast(page)));
    issues.push(...(await this.checkKeyboardNavigation(page)));
    issues.push(...(await this.checkAriaAttributes(page)));

    const stats = {
      errors: issues.filter((index) => index.type === 'error').length,
      warnings: issues.filter((index) => index.type === 'warning').length,
      info: issues.filter((index) => index.type === 'info').length,
    };

    return {
      passes: stats.errors === 0,
      issues,
      stats,
    };
  }

  /**
   * Assert no accessibility errors
   */
  async assertNoAccessibilityErrors(page: Page): Promise<void> {
    const result = await this.fullCheck(page);
    if (!result.passes) {
      const errorMessages = result.issues
        .filter((index) => index.type === 'error')
        .map((index) => `- ${index.message}`)
        .join('\n');
      throw new Error(`Accessibility errors found:\n${errorMessages}`);
    }
  }
}

export { strictLocator, warnOnNonSemantic } from './semantic-locator';

/**
 * Create accessibility checker
 */
export function createAccessibilityChecker(): AccessibilityChecker {
  return new AccessibilityChecker();
}

/**
 * Assert element has role
 */
export async function assertHasRole(locator: Locator, role: string): Promise<void> {
  const actualRole = await locator.getAttribute('role');
  if (actualRole !== role) {
    throw new Error(`Expected element to have role="${role}", but got role="${actualRole}"`);
  }
}

/**
 * Assert element is focusable
 */
export async function assertIsFocusable(locator: Locator): Promise<void> {
  const isFocusable = await locator.evaluate((element) => {
    return (
      element.tabIndex !== -1 &&
      (element instanceof HTMLButtonElement ||
        element instanceof HTMLAnchorElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement ||
        element.getAttribute('role') === 'button')
    );
  });

  if (!isFocusable) {
    throw new Error('Expected element to be focusable');
  }
}

/**
 * Tab to element and check focus
 */
export async function tabToElement(page: Page, selector: string): Promise<void> {
  const initialFocus = await page.evaluate(() => document.activeElement?.className);

  // Tab until we focus on target element
  let attempts = 0;
  while (attempts < 20) {
    await page.keyboard.press('Tab');
    const currentFocus = await page.evaluate(() => document.activeElement?.className);

    if (currentFocus !== initialFocus) {
      const activeElementClass = await page.evaluate(() => document.activeElement?.className);
      if (activeElementClass === selector) {
        return;
      }
    }

    attempts++;
  }

  throw new Error(`Could not tab to element with selector: ${selector}`);
}
