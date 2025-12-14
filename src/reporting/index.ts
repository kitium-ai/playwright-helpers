/**
 * Enhanced test reporting and analytics
 * Custom HTML reports, analytics dashboard, and flaky test detection
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { contextManager, createLogger } from '@kitiumai/logger';
import { allure } from 'allure-playwright';

export type TestExecution = {
  testName: string;
  testPath: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  startTime: number;
  endTime: number;
  error?: string;
  screenshots?: string[];
  traceId?: string;
  metadata?: Record<string, unknown>;
};

export type TestAnalytics = {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  averageDuration: number;
  totalDuration: number;
  flakyTests: Array<{
    testName: string;
    testPath: string;
    failureRate: number;
    lastFailures: number;
    lastPasses?: number;
  }>;
  slowTests: Array<{
    testName: string;
    testPath: string;
    averageDuration: number;
  }>;
  trends: Array<{
    date: string;
    passed: number;
    failed: number;
    flaky: number;
  }>;
};

export type FlakyTestDetection = {
  testName: string;
  testPath: string;
  failureRate: number;
  lastFailures: number;
  lastPasses?: number;
  isFlaky?: boolean;
};

/**
 * Test execution recorder
 */
export class TestExecutionRecorder {
  private readonly executions: Map<string, TestExecution[]> = new Map();
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  /**
   * Record test execution
   */
  recordExecution(execution: TestExecution): void {
    const key = `${execution.testPath}::${execution.testName}`;
    const executions = this.executions.get(key) ?? [];
    executions.push(execution);
    this.executions.set(key, executions);

    const context = contextManager.getContext();
    this.logger.debug('Test execution recorded', {
      traceId: context.traceId,
      testName: execution.testName,
      status: execution.status,
      duration: execution.duration,
    });
  }

  /**
   * Get executions for a test
   */
  getExecutions(testPath: string, testName: string): TestExecution[] {
    const key = `${testPath}::${testName}`;
    return this.executions.get(key) ?? [];
  }

  /**
   * Get all executions
   */
  getAllExecutions(): TestExecution[] {
    return Array.from(this.executions.values()).flat();
  }

  /**
   * Clear all executions
   */
  clear(): void {
    this.executions.clear();
  }

  /**
   * Attach screenshot to Allure report
   */
  attachScreenshotToAllure(name: string, screenshotPath: string): void {
    const buffer = fs.readFileSync(screenshotPath);
    void allure.attachment(name, buffer, 'image/png');
  }

  /**
   * Attach trace to Allure report
   */
  attachTraceToAllure(name: string, traceData: unknown): void {
    void allure.attachment(name, JSON.stringify(traceData, null, 2), 'application/json');
  }

  /**
   * Add step to Allure report
   */
  addStepToAllure(name: string): void {
    void allure.step(name, async () => {
      await Promise.resolve();
    });
  }
}

/**
 * Flaky test detector
 */
export class FlakyTestDetector {
  private readonly recorder: TestExecutionRecorder;
  private readonly threshold: number;

  constructor(recorder: TestExecutionRecorder, threshold = 0.3) {
    this.recorder = recorder;
    this.threshold = threshold; // 30% failure rate considered flaky
  }

  /**
   * Detect flaky tests
   */
  detectFlakyTests(): FlakyTestDetection[] {
    const allExecutions = this.recorder.getAllExecutions();
    const testGroups = new Map<string, TestExecution[]>();

    // Group executions by test
    for (const execution of allExecutions) {
      const key = `${execution.testPath}::${execution.testName}`;
      const group = testGroups.get(key) ?? [];
      group.push(execution);
      testGroups.set(key, group);
    }

    const flakyTests: FlakyTestDetection[] = [];

    for (const [key, executions] of testGroups.entries()) {
      if (executions.length < 3) {
        continue; // Need at least 3 runs to detect flakiness
      }

      const failures = executions.filter((e) => e.status === 'failed').length;
      const passes = executions.filter((e) => e.status === 'passed').length;
      const failureRate = failures / executions.length;

      const lastFailures = executions.slice(-10).filter((e) => e.status === 'failed').length;
      const lastPasses = executions.slice(-10).filter((e) => e.status === 'passed').length;

      const isFlaky = failureRate >= this.threshold && failures > 0 && passes > 0;

      if (isFlaky) {
        const [testPath, testName] = key.split('::');
        flakyTests.push({
          testName: testName ?? '',
          testPath: testPath ?? '',
          failureRate,
          lastFailures,
          lastPasses,
          isFlaky: true,
        });
      }
    }

    return flakyTests;
  }
}

/**
 * Test analytics generator
 */
export class TestAnalyticsGenerator {
  private readonly recorder: TestExecutionRecorder;

  constructor(recorder: TestExecutionRecorder) {
    this.recorder = recorder;
  }

  /**
   * Generate analytics from test executions
   */
  generateAnalytics(): TestAnalytics {
    const allExecutions = this.recorder.getAllExecutions();

    const totalTests = allExecutions.length;
    const passed = allExecutions.filter((e) => e.status === 'passed').length;
    const failed = allExecutions.filter((e) => e.status === 'failed').length;
    const skipped = allExecutions.filter((e) => e.status === 'skipped').length;
    const flaky = allExecutions.filter((e) => e.status === 'flaky').length;

    const totalDuration = allExecutions.reduce((sum, e) => sum + e.duration, 0);
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;

    // Detect flaky tests
    const detector = new FlakyTestDetector(this.recorder);
    const flakyTests = detector.detectFlakyTests();

    // Find slow tests
    const testDurations = new Map<string, number[]>();
    for (const execution of allExecutions) {
      const key = `${execution.testPath}::${execution.testName}`;
      const durations = testDurations.get(key) ?? [];
      durations.push(execution.duration);
      testDurations.set(key, durations);
    }

    const slowTests = Array.from(testDurations.entries())
      .map(([key, durations]) => {
        const [testPath, testName] = key.split('::');
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        return { testName: testName ?? '', testPath: testPath ?? '', averageDuration: avgDuration };
      })
      .filter((test) => test.testName && test.testPath)
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 10);

    // Generate trends (simplified - in production, would aggregate by date)
    const trends = [
      {
        date: new Date().toISOString().split('T')[0] ?? '',
        passed,
        failed,
        flaky,
      },
    ];

    return {
      totalTests,
      passed,
      failed,
      skipped,
      flaky,
      averageDuration,
      totalDuration,
      flakyTests,
      slowTests,
      trends,
    };
  }
}

export * from './quality-scorecard';

/**
 * HTML report generator
 */
export class HTMLReportGenerator {
  private readonly outputDir: string;
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  constructor(outputDir = './test-results/reports') {
    this.outputDir = outputDir;

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate HTML report
   */
  async generateReport(
    analytics: TestAnalytics,
    executions: TestExecution[],
    options: {
      includeScreenshots?: boolean;
      includeTraces?: boolean;
    } = {}
  ): Promise<string> {
    const context = contextManager.getContext();
    this.logger.info('Generating HTML test report', {
      traceId: context.traceId,
      outputDir: this.outputDir,
    });

    const reportPath = path.join(this.outputDir, `test-report-${Date.now()}.html`);
    const html = this.generateHTML(analytics, executions, options);

    fs.writeFileSync(reportPath, html, 'utf-8');

    this.logger.info('HTML test report generated', {
      traceId: context.traceId,
      reportPath,
    });

    return reportPath;
  }

  /**
   * Generate HTML content
   */
  private generateHTML(
    analytics: TestAnalytics,
    executions: TestExecution[],
    _options: { includeScreenshots?: boolean; includeTraces?: boolean }
  ): string {
    const passRate = analytics.totalTests > 0 ? (analytics.passed / analytics.totalTests) * 100 : 0;

    const flakyTestRows = analytics.flakyTests
      .map(
        (test) => `
            <tr>
              <td>${test.testName}</td>
              <td>${test.testPath}</td>
              <td>${(test.failureRate * 100).toFixed(1)}%</td>
              <td>${test.lastFailures}</td>
              <td>${test.lastPasses ?? 0}</td>
            </tr>
          `
      )
      .join('');

    const flakyTestsSection =
      analytics.flakyTests.length > 0
        ? `
    <div class="section">
      <h2>Flaky Tests (${analytics.flakyTests.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Test Path</th>
            <th>Failure Rate</th>
            <th>Last Failures</th>
            <th>Last Passes</th>
          </tr>
        </thead>
        <tbody>
          ${flakyTestRows}
        </tbody>
      </table>
    </div>
    `
        : '';

    const slowTestRows = analytics.slowTests
      .map(
        (test) => `
            <tr>
              <td>${test.testName}</td>
              <td>${test.testPath}</td>
              <td>${(test.averageDuration / 1000).toFixed(2)}s</td>
            </tr>
          `
      )
      .join('');

    const slowTestsSection =
      analytics.slowTests.length > 0
        ? `
    <div class="section">
      <h2>Slowest Tests (Top 10)</h2>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Test Path</th>
            <th>Average Duration</th>
          </tr>
        </thead>
        <tbody>
          ${slowTestRows}
        </tbody>
      </table>
    </div>
    `
        : '';

    const allExecutionsRows = executions
      .map(
        (execution) => `
            <tr>
              <td>${execution.testName}</td>
              <td><span class="status-badge status-${execution.status}">${execution.status}</span></td>
              <td>${(execution.duration / 1000).toFixed(2)}s</td>
              <td>${execution.error ? `<pre style="max-width: 400px; overflow: auto;">${this.escapeHtml(execution.error)}</pre>` : '-'}</td>
            </tr>
          `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Execution Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 30px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff; }
    .stat-card.passed { border-left-color: #28a745; }
    .stat-card.failed { border-left-color: #dc3545; }
    .stat-card.flaky { border-left-color: #ffc107; }
    .stat-value { font-size: 32px; font-weight: bold; color: #333; }
    .stat-label { color: #666; margin-top: 5px; }
    .section { margin-top: 40px; }
    .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #333; }
    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .status-passed { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-flaky { background: #fff3cd; color: #856404; }
    .status-skipped { background: #e2e3e5; color: #383d41; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Execution Report</h1>
    
    <div class="stats">
      <div class="stat-card passed">
        <div class="stat-value">${analytics.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${analytics.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card flaky">
        <div class="stat-value">${analytics.flaky}</div>
        <div class="stat-label">Flaky</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${passRate.toFixed(1)}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(analytics.totalDuration / 1000).toFixed(1)}s</div>
        <div class="stat-label">Total Duration</div>
      </div>
    </div>

    ${flakyTestsSection}
    ${slowTestsSection}

    <div class="section">
      <h2>All Test Executions</h2>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${allExecutionsRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const escapeMap = new Map<string, string>([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#039;'],
    ]);
    return text.replace(/[&<>"']/g, (match) => escapeMap.get(match) ?? match);
  }
}

/**
 * Create test execution recorder
 */
export function createTestExecutionRecorder(): TestExecutionRecorder {
  return new TestExecutionRecorder();
}

/**
 * Create flaky test detector
 */
export function createFlakyTestDetector(
  recorder: TestExecutionRecorder,
  threshold?: number
): FlakyTestDetector {
  return new FlakyTestDetector(recorder, threshold);
}

/**
 * Create analytics generator
 */
export function createAnalyticsGenerator(recorder: TestExecutionRecorder): TestAnalyticsGenerator {
  return new TestAnalyticsGenerator(recorder);
}

/**
 * Create HTML report generator
 */
export function createHTMLReportGenerator(outputDir?: string): HTMLReportGenerator {
  return new HTMLReportGenerator(outputDir);
}

/**
 * Generate test report
 */
export async function generateTestReport(
  recorder: TestExecutionRecorder,
  options: {
    outputDir?: string;
    includeScreenshots?: boolean;
    includeTraces?: boolean;
  } = {}
): Promise<string> {
  const analyticsGenerator = createAnalyticsGenerator(recorder);
  const analytics = analyticsGenerator.generateAnalytics();

  const reportGenerator = createHTMLReportGenerator(options.outputDir);
  return reportGenerator.generateReport(analytics, recorder.getAllExecutions(), options);
}
