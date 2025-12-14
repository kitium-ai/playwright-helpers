/**
 * Test data management for Playwright
 * Re-exports framework-agnostic factories from @kitiumai/test-core
 * Plus Playwright-specific utilities
 */

import { contextManager, createLogger } from '@kitiumai/logger';
import {
  BuilderGenerators as Generators,
  createBuilder,
  createFactory,
  type Factory,
} from '@kitiumai/test-core';

import type { Page } from '@playwright/test';

// Re-export from test-core
export type { Factory };
export { createBuilder, createFactory, Generators };

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
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });
  const { prefix = '', suffix = '' } = options;

  const traceId = contextManager.getContext().traceId;
  logger.debug('Filling form with test data', {
    fieldCount: Object.keys(formData).length,
    traceId,
  });

  const fillWithSelectors = async (selectors: string[], value: string): Promise<boolean> => {
    for (const selector of selectors) {
      try {
        const locator = page.locator(selector).first();
        const count = await locator.count();
        if (count <= 0) {
          continue;
        }

        const tagName = await locator.evaluate((element) => element.tagName.toLowerCase());
        if (tagName === 'select') {
          await locator.selectOption(value);
        } else {
          await locator.fill(value);
        }
        return true;
      } catch {
        continue;
      }
    }
    return false;
  };

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

      const isFilled = await fillWithSelectors(selectors, stringValue);

      if (!isFilled) {
        logger.warn(`Could not fill field: ${field}`, {
          triedSelectors: selectors,
          traceId,
        });
      }
    } catch (error) {
      const error_ = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error filling field: ${field}`, {
        field,
        error: error_.message,
        traceId,
      });
    }
  }
}
