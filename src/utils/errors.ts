/**
 * Enhanced error handling for Playwright helpers
 * Extends @kitiumai/test-core error handling with Playwright-specific context
 */

import { EnhancedTestError, type ErrorContext, TestErrorMessages } from '@kitiumai/test-core';

/**
 * Playwright-specific enhanced error
 * Extends the base test error with Playwright-specific functionality
 */
export class EnhancedPlaywrightError extends EnhancedTestError {
  constructor(message: string, context?: ConstructorParameters<typeof EnhancedTestError>[1]) {
    super(message, context);
    this.name = 'EnhancedPlaywrightError';
  }
}

/**
 * Playwright-specific error messages with helpful suggestions
 * Includes base test error messages plus Playwright-specific ones
 */
export const PlaywrightErrorMessages = {
  // Include base test error messages
  ...TestErrorMessages,

  // Playwright-specific error messages
  elementNotFound: (selector: string, triedSelectors: string[]) => ({
    message: `Could not find element matching selector: ${selector}`,
    suggestion:
      'Ensure the element exists in the DOM and is visible. Consider using data-testid attributes for more reliable selectors.',
    triedSelectors,
  }),

  elementNotVisible: (selector: string) => ({
    message: `Element found but not visible: ${selector}`,
    suggestion:
      'Check if the element is hidden by CSS (display: none, visibility: hidden) or positioned off-screen. Wait for animations to complete.',
  }),

  elementNotInteractable: (selector: string) => ({
    message: `Element is not interactable: ${selector}`,
    suggestion:
      'Element might be covered by another element, disabled, or not yet ready. Try waiting for the element to be enabled or visible.',
  }),

  formValidationFailed: (field: string) => ({
    message: `Form validation failed for field: ${field}`,
    suggestion:
      'Verify the input value matches expected format and check for any validation error messages on the page.',
  }),

  loginFailed: () => ({
    message: 'Login flow failed',
    suggestion:
      'Verify credentials are correct, check for CAPTCHA or 2FA requirements, and ensure login form selectors match the page structure.',
  }),

  accessibilityViolation: (violations: number) => ({
    message: `Found ${violations} accessibility violation(s)`,
    suggestion:
      'Review accessibility issues and fix critical violations. Check for missing ARIA labels, color contrast, and keyboard navigation.',
  }),
};

// Backward compatibility alias
export const ErrorMessages = PlaywrightErrorMessages;

/**
 * Create enhanced Playwright error with context
 */
export function createError(
  type: keyof typeof PlaywrightErrorMessages,
  ...args: unknown[]
): EnhancedPlaywrightError {
  const errorData = (
    PlaywrightErrorMessages[type] as (...args: unknown[]) => {
      message: string;
      suggestion?: string;
      triedSelectors?: string[];
    }
  )(...args);

  const context: ErrorContext = {};
  if (errorData.suggestion) {
    context.suggestion = errorData.suggestion;
  }
  if (errorData.triedSelectors) {
    context.triedSelectors = errorData.triedSelectors;
  }
  return new EnhancedPlaywrightError(
    errorData.message,
    Object.keys(context).length > 0 ? context : undefined
  );
}
