/**
 * Trace context helpers.
 * SRP: extract stable logging metadata from logger context.
 */

import { contextManager } from '@kitiumai/logger';

export type TraceMeta = {
  traceId: string;
  requestId?: string;
  spanId?: string;
};

export function getTraceMeta(extra?: Record<string, unknown>): TraceMeta & Record<string, unknown> {
  const context = contextManager.getContext();
  return {
    traceId: context.traceId,
    ...(context.requestId !== undefined && { requestId: context.requestId }),
    ...(context.spanId !== undefined && { spanId: context.spanId }),
    ...(extra ?? {}),
  };
}
