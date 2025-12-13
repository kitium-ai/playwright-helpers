/**
 * Distributed tracing support for Playwright tests
 * Integrates with @kitiumai/logger for trace context propagation
 */

import { contextManager } from '@kitiumai/logger';
import type { Page } from '@playwright/test';

import { toError } from '../internal/errors';
import { getPlaywrightLogger } from '../internal/logger';

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  attributes: Record<string, unknown>;
  status: 'ok' | 'error';
  error?: Error;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/**
 * Trace manager for test operations
 */
export class TraceManager {
  private readonly logger = getPlaywrightLogger();
  private readonly spans: Map<string, TraceSpan> = new Map();
  private currentSpanId: string | null = null;

  /**
   * Start a new trace span
   */
  startSpan(name: string, attributes: Record<string, unknown> = {}, parentSpanId?: string): string {
    const context = contextManager.getContext();
    const traceId = context.traceId;
    const spanId = crypto.randomUUID();
    const finalParentSpanId = parentSpanId ?? this.currentSpanId ?? undefined;

    const span: TraceSpan = {
      name,
      startTime: Date.now(),
      traceId,
      spanId,
      ...(finalParentSpanId ? { parentSpanId: finalParentSpanId } : {}),
      attributes: {
        ...attributes,
        'test.operation': name,
        'test.traceId': traceId,
        'test.spanId': spanId,
      },
      status: 'ok',
    };

    this.spans.set(spanId, span);
    this.currentSpanId = spanId;

    // Update context with trace information
    contextManager.run(
      {
        ...context,
        traceId,
        spanId,
        metadata: {
          ...context.metadata,
          ...attributes,
        },
      },
      () => {
        this.logger.debug(`Trace span started: ${name}`, {
          traceId,
          spanId,
          parentSpanId: span.parentSpanId,
        });
      }
    );

    return spanId;
  }

  /**
   * End a trace span
   */
  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', error?: Error): void {
    const span = this.spans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    if (error) {
      span.error = error;
    }

    this.logger.debug(`Trace span ended: ${span.name}`, {
      traceId: span.traceId,
      spanId: span.spanId,
      duration: span.duration,
      status,
      error: error?.message,
    });

    // Log as structured event
    if (status === 'error' && error) {
      this.logger.error(`Test operation failed: ${span.name}`, {
        traceId: span.traceId,
        spanId: span.spanId,
        duration: span.duration,
        error: error.message,
        stack: error.stack,
        attributes: span.attributes,
      });
    } else {
      this.logger.info(`Test operation completed: ${span.name}`, {
        traceId: span.traceId,
        spanId: span.spanId,
        duration: span.duration,
        attributes: span.attributes,
      });
    }

    // Reset current span if it's the active one
    if (this.currentSpanId === spanId) {
      this.currentSpanId = span.parentSpanId ?? null;
    }
  }

  /**
   * Get all spans for a trace
   */
  getSpansByTraceId(traceId: string): TraceSpan[] {
    return Array.from(this.spans.values()).filter((span) => span.traceId === traceId);
  }

  /**
   * Get span by ID
   */
  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Clear all spans
   */
  clear(): void {
    this.spans.clear();
    this.currentSpanId = null;
  }

  /**
   * Export spans for external systems
   */
  exportSpans(): TraceSpan[] {
    return Array.from(this.spans.values());
  }
}

let globalTraceManager: TraceManager | null = null;

/**
 * Get global trace manager instance
 */
export function getTraceManager(): TraceManager {
  globalTraceManager ??= new TraceManager();
  return globalTraceManager;
}

/**
 * Run a test operation with tracing
 */
export async function traceTest<T>(
  operationName: string,
  operation: (spanId: string) => Promise<T>,
  attributes: Record<string, unknown> = {}
): Promise<T> {
  const traceManager = getTraceManager();
  const spanId = traceManager.startSpan(operationName, attributes);

  try {
    const result = await operation(spanId);
    traceManager.endSpan(spanId, 'ok');
    return result;
  } catch (error) {
    const errorObject = toError(error);
    traceManager.endSpan(spanId, 'error', errorObject);
    throw errorObject;
  }
}

/**
 * Create a child span for nested operations
 */
export async function traceChild<T>(
  parentSpanId: string,
  operationName: string,
  operation: (spanId: string) => Promise<T>,
  attributes: Record<string, unknown> = {}
): Promise<T> {
  const traceManager = getTraceManager();
  const spanId = traceManager.startSpan(operationName, attributes, parentSpanId);

  try {
    const result = await operation(spanId);
    traceManager.endSpan(spanId, 'ok');
    return result;
  } catch (error) {
    const errorObject = toError(error);
    traceManager.endSpan(spanId, 'error', errorObject);
    throw errorObject;
  }
}

/**
 * Extract trace context from page (for correlation with application)
 */
export async function extractTraceContextFromPage(page: Page): Promise<TraceContext | null> {
  try {
    const context = await page.evaluate(() => {
      // Try to extract trace context from window or meta tags
      const traceId =
        (window as unknown as { __TRACE_ID__?: string }).__TRACE_ID__ ??
        document.querySelector('meta[name="trace-id"]')?.getAttribute('content') ??
        null;
      const spanId =
        (window as unknown as { __SPAN_ID__?: string }).__SPAN_ID__ ??
        document.querySelector('meta[name="span-id"]')?.getAttribute('content') ??
        null;

      return traceId && spanId ? { traceId, spanId } : null;
    });

    if (context) {
      // Update logger context with extracted trace
      const loggerContext = contextManager.getContext();
      contextManager.run(
        {
          ...loggerContext,
          traceId: context.traceId,
          spanId: context.spanId,
        },
        () => {
          getPlaywrightLogger().debug('Extracted trace context from page', context);
        }
      );
    }

    return context;
  } catch {
    return null;
  }
}

/**
 * Inject trace context into page
 */
export async function injectTraceContextIntoPage(page: Page, context: TraceContext): Promise<void> {
  await page.evaluate(({ traceId, spanId }) => {
    (window as unknown as { __TRACE_ID__: string }).__TRACE_ID__ = traceId;
    (window as unknown as { __SPAN_ID__: string }).__SPAN_ID__ = spanId;

    // Also inject as meta tags
    let traceMeta = document.querySelector('meta[name="trace-id"]');
    if (!traceMeta) {
      traceMeta = document.createElement('meta');
      traceMeta.setAttribute('name', 'trace-id');
      document.head.appendChild(traceMeta);
    }
    traceMeta.setAttribute('content', traceId);

    let spanMeta = document.querySelector('meta[name="span-id"]');
    if (!spanMeta) {
      spanMeta = document.createElement('meta');
      spanMeta.setAttribute('name', 'span-id');
      document.head.appendChild(spanMeta);
    }
    spanMeta.setAttribute('content', spanId);
  }, context);
}

/**
 * Setup automatic trace context propagation for a page
 */
export async function setupTracePropagation(page: Page): Promise<void> {
  const logger = getPlaywrightLogger();

  // Extract trace context on page load
  page.on('load', async () => {
    const context = await extractTraceContextFromPage(page);
    if (context) {
      logger.debug('Trace context propagated from page', context);
    }
  });

  // Inject trace context into all requests
  await page.route('**/*', async (route) => {
    const currentContext = contextManager.getContext();
    if (currentContext.traceId) {
      const headers = route.request().headers();
      headers['x-trace-id'] = currentContext.traceId;
      if (currentContext.spanId) {
        headers['x-span-id'] = currentContext.spanId;
      }
      await route.continue({ headers });
    } else {
      await route.continue();
    }
  });

  logger.debug('Trace propagation setup complete');
}

export interface TraceExportOptions {
  collectorUrl: string;
  serviceName?: string;
}

/**
 * Export collected spans to an OTLP-compatible collector
 */
export async function exportTracesToCollector(options: TraceExportOptions): Promise<Response> {
  const traceManager = getTraceManager();
  const spans = traceManager.exportSpans();
  const payload = {
    resource: { service: options.serviceName ?? 'playwright-tests' },
    spans,
  };

  return await fetch(options.collectorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Attach trace identifiers to artifact names for correlation
 */
export function stitchArtifactsWithTrace(traceId: string, artifacts: string[]): string[] {
  return artifacts.map((artifact) => `${artifact}?traceId=${traceId}`);
}
