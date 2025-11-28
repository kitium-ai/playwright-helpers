/**
 * Retry utilities for flaky operations
 * Implements intelligent retry logic with exponential backoff
 * Note: Prefer using @kitiumai/test-core/async retry for new code
 */

import { retry as retryCore, sleep, waitFor } from '@kitiumai/test-core';

// Re-export from test-core
export { retry as retryWithBackoff, sleep, waitFor as waitUntil } from '@kitiumai/test-core';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry an async operation with exponential backoff
 * @deprecated Use retry from @kitiumai/test-core/async instead
 */
export async function retryWithBackoffLegacy<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Use test-core retry if compatible options
  if (!options.onRetry && options.backoffMultiplier === 2) {
    return retryCore(operation, {
      maxAttempts: options.maxAttempts ?? 3,
      delay: options.initialDelayMs ?? 100,
      backoff: 2,
    });
  }

  // Fallback to legacy implementation for custom options
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      onRetry?.(attempt, lastError);

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

/**
 * Retry until a condition is met
 * Uses @kitiumai/test-core waitFor
 */
export async function retryUntil(
  condition: () => Promise<boolean>,
  options: RetryOptions & { timeoutMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 10000 } = options;
  return waitFor(condition, { timeout: timeoutMs });
}

/**
 * Poll for a value until it matches expected condition
 * Uses @kitiumai/test-core waitForValue
 */
export async function pollForValue<T>(
  getValue: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: RetryOptions & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 10000 } = options;
  const { waitForValue: waitForValueCore } = await import('@kitiumai/test-core');

  return waitForValueCore(getValue, predicate, { timeout: timeoutMs });
}
