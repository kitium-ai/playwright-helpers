/**
 * Performance monitoring and measurement for Playwright tests
 * Integrates with @kitiumai/logger for structured logging
 */

import lighthouse, { type Flags } from 'lighthouse';
import { contextManager, createLogger } from '@kitiumai/logger';
import type { Page } from '@playwright/test';

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
};

type LayoutShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};

export interface PerformanceMetrics {
  navigationStart: number;
  domContentLoadedEventEnd: number;
  loadEventEnd: number;
  domInteractive: number;
  domComplete: number;
  connectEnd: number;
  responseEnd: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
}

export interface CoreWebVitals {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

export interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  decodedBodySize: number;
  type: string;
}

export class PerformanceMonitor {
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  /**
   * Get page load metrics
   */
  async getNavigationMetrics(page: Page): Promise<PerformanceMetrics> {
    const metrics = await page.evaluate(() => {
      const navigationTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return {
        navigationStart: navigationTiming.fetchStart,
        domContentLoadedEventEnd: navigationTiming.domContentLoadedEventEnd,
        loadEventEnd: navigationTiming.loadEventEnd,
        domInteractive: navigationTiming.domInteractive,
        domComplete: navigationTiming.domComplete,
        connectEnd: navigationTiming.connectEnd,
        responseEnd: navigationTiming.responseEnd,
      };
    });

    return metrics as PerformanceMetrics;
  }

  /**
   * Run Lighthouse audit
   */
  async runLighthouseAudit(page: Page, options?: { categories?: string[] }): Promise<unknown> {
    const context = contextManager.getContext();
    this.logger.debug('Running Lighthouse audit', { traceId: context.traceId });

    const url = page.url();
    // Run Lighthouse in its own Chrome instance (avoids Playwright wsEndpoint coupling)
    const flags: Partial<Flags> = {
      logLevel: 'info',
      output: 'json',
    };
    if (options?.categories) {
      flags.onlyCategories = options.categories;
    }
    const runnerResult = await lighthouse(url, flags as Flags);

    if (!runnerResult) {
      throw new Error('Lighthouse audit failed');
    }

    const report = runnerResult.lhr;

    this.logger.info('Lighthouse audit completed', {
      traceId: context.traceId,
      performance: report.categories?.['performance']?.score,
      accessibility: report.categories?.['accessibility']?.score,
      seo: report.categories?.['seo']?.score,
    });

    return report;
  }

  /**
   * Get Core Web Vitals
   */
  async getCoreWebVitals(page: Page): Promise<CoreWebVitals> {
    const context = contextManager.getContext();
    this.logger.debug('Measuring Core Web Vitals', { traceId: context.traceId });

    const vitals = await page.evaluate(() => {
      const metrics: CoreWebVitals = {};

      // LCP - Largest Contentful Paint
      const paintEntries = performance.getEntriesByType(
        'largest-contentful-paint'
      ) as LargestContentfulPaint[];
      if (paintEntries.length > 0) {
        const lastEntry = paintEntries[paintEntries.length - 1] ?? null;
        if (lastEntry) {
          metrics.lcp = lastEntry.renderTime ?? lastEntry.loadTime ?? lastEntry.startTime;
        }
      }

      // CLS - Cumulative Layout Shift
      const layoutShiftEntries = performance.getEntriesByType('layout-shift') as LayoutShiftEntry[];
      let cls = 0;
      layoutShiftEntries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      });
      metrics.cls = cls;

      // TTFB - Time to First Byte
      const navigationTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navigationTiming) {
        metrics.ttfb = navigationTiming.responseStart - navigationTiming.requestStart;
      }

      return metrics;
    });

    return vitals;
  }

  /**
   * Get resource timing information
   */
  async getResourceTiming(page: Page): Promise<ResourceTiming[]> {
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries.map((entry) => ({
        name: entry.name,
        duration: entry.duration,
        transferSize: entry.transferSize ?? 0,
        decodedBodySize: entry.decodedBodySize ?? 0,
        type: entry.initiatorType ?? 'unknown',
      }));
    });

    return resources as ResourceTiming[];
  }

  /**
   * Get page load time
   */
  async getPageLoadTime(page: Page): Promise<number> {
    const metrics = await this.getNavigationMetrics(page);
    return metrics.loadEventEnd - metrics.navigationStart;
  }

  /**
   * Get DOM interactive time
   */
  async getDomInteractiveTime(page: Page): Promise<number> {
    const metrics = await this.getNavigationMetrics(page);
    return metrics.domInteractive - metrics.navigationStart;
  }

  /**
   * Get DOM content loaded time
   */
  async getDomContentLoadedTime(page: Page): Promise<number> {
    const metrics = await this.getNavigationMetrics(page);
    return metrics.domContentLoadedEventEnd - metrics.navigationStart;
  }

  /**
   * Measure operation performance
   */
  async measureOperation<T>(
    operation: () => Promise<T>,
    label?: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;

    if (label) {
      console.log(`[${label}] Duration: ${duration.toFixed(2)}ms`);
    }

    return { result, duration };
  }

  /**
   * Assert page load time is within threshold
   */
  async assertLoadTimeUnder(page: Page, maxMs: number): Promise<void> {
    const loadTime = await this.getPageLoadTime(page);
    if (loadTime > maxMs) {
      throw new Error(`Page load time ${loadTime.toFixed(2)}ms exceeded threshold ${maxMs}ms`);
    }
  }

  /**
   * Assert Core Web Vitals meet thresholds
   */
  async assertCoreWebVitalsGood(page: Page): Promise<void> {
    const vitals = await this.getCoreWebVitals(page);

    const issues: string[] = [];

    // Good thresholds according to Google
    if (vitals.lcp && vitals.lcp > 2500) {
      issues.push(`LCP ${vitals.lcp.toFixed(0)}ms (should be < 2500ms)`);
    }

    if (vitals.cls && vitals.cls > 0.1) {
      issues.push(`CLS ${vitals.cls.toFixed(3)} (should be < 0.1)`);
    }

    if (vitals.ttfb && vitals.ttfb > 600) {
      issues.push(`TTFB ${vitals.ttfb.toFixed(0)}ms (should be < 600ms)`);
    }

    if (issues.length > 0) {
      throw new Error(`Core Web Vitals issues:\n${issues.join('\n')}`);
    }
  }

  /**
   * Get memory usage (if available)
   */
  async getMemoryUsage(
    page: Page
  ): Promise<{ usedJSHeapSize: number; totalJSHeapSize: number } | null> {
    try {
      const memory = await page.evaluate(() => {
        const perf = performance as PerformanceWithMemory;
        if (perf.memory) {
          return {
            usedJSHeapSize: perf.memory.usedJSHeapSize,
            totalJSHeapSize: perf.memory.totalJSHeapSize,
          };
        }
        return null;
      });

      return memory;
    } catch {
      return null;
    }
  }

  /**
   * Profile function execution
   */
  async profileFunction<T>(page: Page, function_: () => Promise<T>, label: string): Promise<T> {
    const startMemory = await this.getMemoryUsage(page);
    const startTime = performance.now();

    const result = await function_();

    const duration = performance.now() - startTime;
    const endMemory = await this.getMemoryUsage(page);

    const memoryDelta =
      endMemory && startMemory ? endMemory.usedJSHeapSize - startMemory.usedJSHeapSize : null;

    console.log(
      `[${label}] Duration: ${duration.toFixed(2)}ms${memoryDelta ? `, Memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB` : ''}`
    );

    return result;
  }
}

/**
 * Create performance monitor
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}

/**
 * Performance report builder
 */
export class PerformanceReportBuilder {
  private metrics: PerformanceMetrics | null = null;
  private vitals: CoreWebVitals | null = null;
  private resources: ResourceTiming[] = [];

  setMetrics(metrics: PerformanceMetrics): this {
    this.metrics = metrics;
    return this;
  }

  setVitals(vitals: CoreWebVitals): this {
    this.vitals = vitals;
    return this;
  }

  setResources(resources: ResourceTiming[]): this {
    this.resources = resources;
    return this;
  }

  build(): {
    metrics: PerformanceMetrics | null;
    vitals: CoreWebVitals | null;
    resources: ResourceTiming[];
    summary: string;
  } {
    const summary = this.generateSummary();
    return {
      metrics: this.metrics,
      vitals: this.vitals,
      resources: this.resources,
      summary,
    };
  }

  private generateSummary(): string {
    const lines: string[] = ['=== Performance Report ==='];

    if (this.metrics) {
      const loadTime = this.metrics.loadEventEnd - this.metrics.navigationStart;
      const domTime = this.metrics.domContentLoadedEventEnd - this.metrics.navigationStart;
      lines.push(`Page Load Time: ${loadTime.toFixed(2)}ms`);
      lines.push(`DOM Content Loaded: ${domTime.toFixed(2)}ms`);
    }

    if (this.vitals) {
      if (this.vitals.lcp) {
        lines.push(`LCP: ${this.vitals.lcp.toFixed(0)}ms`);
      }
      if (this.vitals.cls) {
        lines.push(`CLS: ${this.vitals.cls.toFixed(3)}`);
      }
      if (this.vitals.ttfb) {
        lines.push(`TTFB: ${this.vitals.ttfb.toFixed(0)}ms`);
      }
    }

    if (this.resources.length > 0) {
      const totalSize = this.resources.reduce((sum, r) => sum + r.transferSize, 0);
      lines.push(`Total Resources: ${this.resources.length}`);
      lines.push(`Total Transfer Size: ${(totalSize / 1024).toFixed(2)}KB`);
    }

    return lines.join('\n');
  }
}

/**
 * Create performance report builder
 */
export function createPerformanceReportBuilder(): PerformanceReportBuilder {
  return new PerformanceReportBuilder();
}
