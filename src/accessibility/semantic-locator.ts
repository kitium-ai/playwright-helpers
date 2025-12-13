import { contextManager } from '@kitiumai/logger';
import type { Locator, Page } from '@playwright/test';

import { getPlaywrightLogger } from '../internal/logger';

export interface SemanticSelector {
  testId?: string;
  role?: string;
  name?: string | RegExp;
  css?: string;
  description?: string;
}

export interface StrictLocatorOptions {
  warnOnCss?: boolean;
  requireSemantic?: boolean;
}

export function strictLocator(
  page: Page,
  selector: SemanticSelector | string,
  options: StrictLocatorOptions = {}
): Locator {
  const logger = getPlaywrightLogger();
  const context = contextManager.getContext();
  const normalized =
    typeof selector === 'string' ? ({ css: selector } satisfies SemanticSelector) : selector;

  if (normalized.testId) {
    return page.getByTestId(normalized.testId);
  }

  if (normalized.role) {
    return page.getByRole(
      normalized.role as never,
      normalized.name ? { name: normalized.name as never } : undefined
    );
  }

  if (normalized.name && typeof normalized.name === 'string') {
    return page.getByText(normalized.name);
  }

  if (normalized.css) {
    if (options.warnOnCss !== false) {
      logger.warn('Using CSS selector in strictLocator; prefer data-testid or ARIA role', {
        traceId: context.traceId,
        selector: normalized.css,
      });
    }
    if (options.requireSemantic) {
      throw new Error(`CSS selector blocked by strictLocator: ${normalized.css}`);
    }
    return page.locator(normalized.css);
  }

  throw new Error('No semantic selector information provided');
}

export function warnOnNonSemantic(selector: string): void {
  const logger = getPlaywrightLogger();
  const context = contextManager.getContext();
  if (selector.startsWith('#') || selector.startsWith('.') || selector.includes('>')) {
    logger.warn('Non-semantic selector detected; prefer data-testid or role queries', {
      traceId: context.traceId,
      selector,
    });
  }
}
