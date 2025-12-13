/**
 * Internal logger for playwright-helpers.
 * Avoids relying on global logger initialization.
 */

import { createLogger, type ILogger, type LoggerConfig } from '@kitiumai/logger';

let internalLogger: ILogger | null = null;

export function getPlaywrightLogger(overrides?: Partial<LoggerConfig>): ILogger {
  if (!internalLogger) {
    internalLogger = createLogger('development', {
      serviceName: 'playwright-helpers',
      ...overrides,
    });
  }
  return internalLogger;
}
