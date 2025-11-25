/**
 * Test data management for Playwright
 * Re-exports framework-agnostic factories from @kitiumai/test-core
 * Plus Playwright-specific utilities
 */

import type { Page } from '@playwright/test';
import { getLogger, contextManager } from '@kitiumai/logger';

// Re-export from test-core
export type { Factory } from '@kitiumai/test-core/builders';
export { createBuilder, createFactory, Generators } from '@kitiumai/test-core/builders';

// Import for deprecated exports
import { createBuilder, createFactory } from '@kitiumai/test-core/builders';

// Note: These are legacy exports for backward compatibility
// Users should migrate to using test-core directly
/**
 * @deprecated Use createBuilder from @kitiumai/test-core/builders instead
 */
export const createTestDataBuilder = createBuilder;

/**
 * @deprecated Use createFactory from @kitiumai/test-core/builders instead
 */
export const createTestFactory = createFactory;

/**
 * @deprecated Use createBuilder from @kitiumai/test-core/builders instead
 */
export const createTestDataFactory = createBuilder;

/**
 * Playwright-specific: Fill form with generated test data
 */
export async function fillFormWithTestData(
  page: Page,
  formData: Record<string, string | number | boolean>,
  options: {
    prefix?: string;
    suffix?: string;
  } = {}
): Promise<void> {
  const logger = getLogger();
  const context = contextManager.getContext();
  const { prefix = '', suffix = '' } = options;

  logger.debug('Filling form with test data', {
    traceId: context.traceId,
    fieldCount: Object.keys(formData).length,
  });

  for (const [field, value] of Object.entries(formData)) {
    const selector = `${prefix}${field}${suffix}`;
    const stringValue = String(value);

    try {
      // Try different selector strategies
      const selectors = [
        `input[name="${field}"]`,
        `input[id="${field}"]`,
        `input[data-testid="${field}"]`,
        `textarea[name="${field}"]`,
        `select[name="${field}"]`,
        selector,
      ];

      let filled = false;
      for (const sel of selectors) {
        try {
          const locator = page.locator(sel).first();
          const count = await locator.count();

          if (count > 0) {
            const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
            if (tagName === 'select') {
              await locator.selectOption(stringValue);
            } else {
              await locator.fill(stringValue);
            }
            filled = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!filled) {
        logger.warn(`Could not fill field: ${field}`, {
          traceId: context.traceId,
          triedSelectors: selectors,
        });
      }
    } catch (error) {
      logger.error(`Error filling field: ${field}`, {
        traceId: context.traceId,
        field,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
