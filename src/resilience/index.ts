/**
 * Resilience patterns for Playwright tests
 * Circuit breaker, timeout management, and chaos testing utilities
 */

import { retry as retryCore, sleep } from '@kitiumai/test-core';
import type { Page } from '@playwright/test';

import { contextManager, createLogger } from '@kitiumai/logger';

export interface CircuitBreakerOptions {
  threshold: number; // Number of failures before opening
  timeout: number; // Time to wait before attempting to close
  halfOpenTimeout?: number; // Time to wait in half-open state
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      halfOpenTimeout: options.timeout / 2,
      ...options,
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should transition
    this.checkState();

    if (this.state === 'open') {
      this.logger.warn('Circuit breaker is open, operation rejected', {
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        traceId: contextManager.getContext().traceId,
      });
      throw new Error(
        `Circuit breaker is open. Too many failures (${this.failureCount}/${this.options.threshold})`
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private checkState(): void {
    const now = Date.now();

    if (this.state === 'open' && this.lastFailureTime) {
      if (now - this.lastFailureTime >= this.options.timeout) {
        this.state = 'half-open';
        this.logger.info('Circuit breaker transitioning to half-open state');
      }
    } else if (this.state === 'half-open' && this.lastFailureTime) {
      if (
        now - this.lastFailureTime >=
        (this.options.halfOpenTimeout ?? this.options.timeout / 2)
      ) {
        this.state = 'closed';
        this.failureCount = 0;
        this.logger.info('Circuit breaker closed, resetting failure count');
      }
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failureCount = 0;
      this.logger.info('Circuit breaker closed after successful operation');
    } else if (this.failureCount > 0) {
      this.failureCount = Math.max(0, this.failureCount - 1); // Decay failures
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.threshold) {
      this.state = 'open';
      this.logger.error('Circuit breaker opened due to failures', {
        failureCount: this.failureCount,
        threshold: this.options.threshold,
        traceId: contextManager.getContext().traceId,
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    this.checkState();
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.logger.info('Circuit breaker manually reset');
  }
}

/**
 * Timeout manager with configurable strategies
 */
export class TimeoutManager {
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  /**
   * Execute operation with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    onTimeout?: () => Promise<void>
  ): Promise<T> {
    const startTime = Date.now();

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          const handleTimeout = async (): Promise<void> => {
            const duration = Date.now() - startTime;
            this.logger.warn('Operation timed out', {
              timeoutMs,
              duration,
              traceId: contextManager.getContext().traceId,
            });

            if (onTimeout) {
              await onTimeout();
            }

            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
          };

          void handleTimeout();
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Execute operation with progressive timeout
   */
  async withProgressiveTimeout<T>(
    operation: () => Promise<T>,
    timeouts: number[],
    onTimeout?: (attempt: number) => Promise<void>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < timeouts.length; attempt++) {
      try {
        return await this.withTimeout(
          operation,
          timeouts[attempt] ?? timeouts[timeouts.length - 1] ?? 30000,
          async () => {
            if (onTimeout) {
              await onTimeout(attempt);
            }
          }
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < timeouts.length - 1) {
          await sleep(1000 * (attempt + 1)); // Progressive delay
        }
      }
    }

    throw lastError ?? new Error('Operation failed after all timeout attempts');
  }
}

/**
 * Chaos testing utilities
 */
export class ChaosInjector {
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Simulate network failure
   */
  async simulateNetworkFailure(durationMs = 5000): Promise<void> {
    this.logger.info('Injecting network failure', {
      durationMs,
      traceId: contextManager.getContext().traceId,
    });

    void this.page.route('**/*', (route) => {
      void route.abort('failed');
    });

    await sleep(durationMs);

    await this.page.unroute('**/*');
    this.logger.info('Network failure simulation ended');
  }

  /**
   * Simulate slow network
   */
  async simulateSlowNetwork(delayMs = 2000): Promise<void> {
    this.logger.info('Injecting slow network', {
      delayMs,
      traceId: contextManager.getContext().traceId,
    });

    await this.page.route('**/*', async (route) => {
      await sleep(delayMs);
      await route.continue();
    });
  }

  /**
   * Simulate random failures
   */
  async simulateRandomFailures(failureRate: number): Promise<void> {
    // failureRate: 0.0 to 1.0 (0% to 100%)
    this.logger.info('Injecting random failures', {
      failureRate,
      traceId: contextManager.getContext().traceId,
    });

    void this.page.route('**/*', (route) => {
      if (Math.random() < failureRate) {
        void route.abort('failed');
      } else {
        void route.continue();
      }
    });
  }

  /**
   * Simulate server errors
   */
  async simulateServerErrors(statusCode = 500, durationMs = 5000): Promise<void> {
    this.logger.info('Injecting server errors', {
      statusCode,
      durationMs,
      traceId: contextManager.getContext().traceId,
    });

    const startTime = Date.now();

    void this.page.route('**/*', (route) => {
      if (Date.now() - startTime < durationMs) {
        void route.fulfill({
          status: statusCode,
          body: JSON.stringify({ error: 'Simulated server error' }),
        });
      } else {
        void route.continue();
      }
    });

    await sleep(durationMs);
    await this.page.unroute('**/*');
  }

  /**
   * Restore normal network behavior
   */
  async restore(): Promise<void> {
    await this.page.unroute('**/*');
    this.logger.info('Network behavior restored');
  }
}

/**
 * Resilience wrapper combining circuit breaker, timeout, and retry
 */
export interface ResilienceOptions {
  circuitBreaker?: CircuitBreakerOptions;
  timeout?: number;
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: boolean;
  };
  chaos?: {
    networkFailure?: { durationMs?: number };
    slowNetwork?: { delayMs?: number };
    randomFailures?: { failureRate?: number };
  };
}

/**
 * Execute operation with full resilience patterns
 */
export async function withResilience<T>(
  options: ResilienceOptions,
  operation: () => Promise<T>
): Promise<T> {
  const logger = createLogger('development', { serviceName: 'playwright-helpers' });

  logger.debug('Executing operation with resilience patterns', {
    options,
    traceId: contextManager.getContext().traceId,
  });

  let wrappedOperation = operation;

  // Apply circuit breaker
  if (options.circuitBreaker) {
    const breaker = new CircuitBreaker(options.circuitBreaker);
    const originalOp = wrappedOperation;
    wrappedOperation = () => breaker.execute(originalOp);
  }

  // Apply timeout
  if (options.timeout) {
    const timeoutManager = new TimeoutManager();
    const originalOp = wrappedOperation;
    wrappedOperation = () => timeoutManager.withTimeout(originalOp, options.timeout ?? 0);
  }

  // Apply retry
  if (options.retry) {
    const { maxAttempts = 3, delayMs = 1000 } = options.retry;
    const originalOp = wrappedOperation;
    wrappedOperation = async () => {
      return retryCore(originalOp, { maxAttempts, delay: delayMs, backoff: 2 });
    };
  }

  return wrappedOperation();
}

/**
 * Create circuit breaker instance
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}

/**
 * Create timeout manager
 */
export function createTimeoutManager(): TimeoutManager {
  return new TimeoutManager();
}

/**
 * Create chaos injector
 */
export function createChaosInjector(page: Page): ChaosInjector {
  return new ChaosInjector(page);
}
