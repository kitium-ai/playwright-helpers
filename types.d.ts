/**
 * TypeScript module declarations for @kitiumai/playwright-helpers
 * Provides type support for all subpath exports
 */

declare module '@kitiumai/playwright-helpers' {
  export * from '@kitiumai/playwright-helpers/index';
}

declare module '@kitiumai/playwright-helpers/page-objects' {
  import type { Page, Locator } from '@playwright/test';

  export class ApplicationPage {
    constructor(page: Page);
    protected page: Page;
    goto(url: string): Promise<void>;
    waitForLoad(): Promise<void>;
    clickElement(selector: string): Promise<void>;
    fillField(selector: string, value: string): Promise<void>;
    getText(selector: string): Promise<string>;
  }

  export class BasePage extends ApplicationPage {}

  export * from '@kitiumai/playwright-helpers/page-objects/index';
}

declare module '@kitiumai/playwright-helpers/assertions' {
  import type { Page, Locator } from '@playwright/test';

  export interface AssertionOptions {
    timeout?: number;
    message?: string;
  }

  export function createAssertion(page: Page): AssertionHelper;

  export class AssertionHelper {
    toBeVisible(locator: Locator, options?: AssertionOptions): Promise<void>;
    toHaveText(locator: Locator, text: string, options?: AssertionOptions): Promise<void>;
    toHaveValue(locator: Locator, value: string, options?: AssertionOptions): Promise<void>;
  }

  export * from '@kitiumai/playwright-helpers/assertions/index';
}

declare module '@kitiumai/playwright-helpers/network' {
  import type { Page, Route } from '@playwright/test';

  export interface MockRouteOptions {
    method?: string;
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
  }

  export class NetworkMockManager {
    constructor(page: Page);
    mockRoute(pattern: string | RegExp, options: MockRouteOptions): Promise<void>;
    clearMocks(): Promise<void>;
  }

  export function createNetworkMock(page: Page): NetworkMockManager;

  export * from '@kitiumai/playwright-helpers/network/index';
}

declare module '@kitiumai/playwright-helpers/auth' {
  import type { Page } from '@playwright/test';

  export interface LoginCredentials {
    email: string;
    password: string;
  }

  export interface AuthFlowOptions {
    loginUrl: string;
    emailSelector: string;
    passwordSelector: string;
    submitSelector: string;
  }

  export class AuthFlow {
    constructor(page: Page, options: AuthFlowOptions);
    login(credentials: LoginCredentials): Promise<void>;
    logout(): Promise<void>;
  }

  export function createLoginFlow(page: Page, options: AuthFlowOptions): AuthFlow;

  export * from '@kitiumai/playwright-helpers/auth/index';
}

declare module '@kitiumai/playwright-helpers/accessibility' {
  import type { Page } from '@playwright/test';

  export interface A11yOptions {
    includedImpacts?: ('critical' | 'serious' | 'moderate' | 'minor')[];
    rules?: Record<string, { enabled: boolean }>;
  }

  export interface A11yResult {
    violations: A11yViolation[];
    passes: number;
  }

  export interface A11yViolation {
    id: string;
    impact: string;
    description: string;
    nodes: A11yNode[];
  }

  export interface A11yNode {
    html: string;
    target: string[];
  }

  export class AccessibilityChecker {
    constructor(page: Page, options?: A11yOptions);
    checkPage(): Promise<A11yResult>;
    assertNoViolations(): Promise<void>;
  }

  export function createAccessibilityChecker(page: Page, options?: A11yOptions): AccessibilityChecker;

  export * from '@kitiumai/playwright-helpers/accessibility/index';
}

declare module '@kitiumai/playwright-helpers/visual' {
  import type { Page } from '@playwright/test';

  export interface VisualCompareOptions {
    threshold?: number;
    maxDiffPixels?: number;
  }

  export class VisualTester {
    constructor(page: Page);
    compareScreenshot(name: string, options?: VisualCompareOptions): Promise<void>;
  }

  export function createVisualTester(page: Page): VisualTester;

  export * from '@kitiumai/playwright-helpers/visual/index';
}

declare module '@kitiumai/playwright-helpers/performance' {
  import type { Page } from '@playwright/test';

  export interface PerformanceMetrics {
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    fcp: number;
  }

  export class PerformanceMonitor {
    constructor(page: Page);
    getCoreWebVitals(): Promise<PerformanceMetrics>;
    assertMetricsWithinBudget(budget: Partial<PerformanceMetrics>): Promise<void>;
  }

  export function createPerformanceMonitor(page: Page): PerformanceMonitor;

  export * from '@kitiumai/playwright-helpers/performance/index';
}

declare module '@kitiumai/playwright-helpers/setup' {
  export interface PlaywrightPreset {
    timeout: number;
    retries: number;
    workers: number;
    use: Record<string, unknown>;
  }

  export function getPlaywrightPreset(preset: 'unit' | 'integration' | 'e2e'): PlaywrightPreset;
  export function generatePlaywrightConfig(overrides?: Partial<PlaywrightPreset>): PlaywrightPreset;

  export * from '@kitiumai/playwright-helpers/setup/index';
}

declare module '@kitiumai/playwright-helpers/testing' {
  import type { Page } from '@playwright/test';

  export interface TestFixtures {
    page: Page;
    context: unknown;
  }

  export function createTestFixtures(): TestFixtures;

  export * from '@kitiumai/playwright-helpers/testing/index';
}

declare module '@kitiumai/playwright-helpers/flows' {
  import type { Page } from '@playwright/test';

  export interface FlowStep {
    name: string;
    action: () => Promise<void>;
  }

  export class TestFlow {
    constructor(page: Page);
    addStep(step: FlowStep): this;
    execute(): Promise<void>;
  }

  export function createTestFlow(page: Page): TestFlow;

  export * from '@kitiumai/playwright-helpers/flows/index';
}

declare module '@kitiumai/playwright-helpers/patterns' {
  export * from '@kitiumai/playwright-helpers/patterns/index';
}

declare module '@kitiumai/playwright-helpers/tracing' {
  import type { Page } from '@playwright/test';

  export interface TraceSpan {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    traceId: string;
    spanId: string;
    status: 'ok' | 'error';
  }

  export class TraceManager {
    startSpan(name: string, attributes?: Record<string, unknown>): string;
    endSpan(spanId: string, status?: 'ok' | 'error', error?: Error): void;
    exportSpans(): TraceSpan[];
  }

  export function createTraceManager(): TraceManager;

  export * from '@kitiumai/playwright-helpers/tracing/index';
}

declare module '@kitiumai/playwright-helpers/resilience' {
  export interface CircuitBreakerOptions {
    threshold: number;
    timeout: number;
  }

  export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

  export class CircuitBreaker {
    constructor(options: CircuitBreakerOptions);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    getState(): CircuitBreakerState;
  }

  export * from '@kitiumai/playwright-helpers/resilience/index';
}

declare module '@kitiumai/playwright-helpers/data' {
  export { createBuilder, createFactory, Generators, type Factory } from '@kitiumai/test-core';

  export * from '@kitiumai/playwright-helpers/data/index';
}

declare module '@kitiumai/playwright-helpers/security' {
  import type { Page } from '@playwright/test';

  export interface SecurityCheckOptions {
    checkCSP?: boolean;
    checkXSS?: boolean;
  }

  export class SecurityChecker {
    constructor(page: Page, options?: SecurityCheckOptions);
    checkSecurity(): Promise<void>;
  }

  export * from '@kitiumai/playwright-helpers/security/index';
}

declare module '@kitiumai/playwright-helpers/contract' {
  export interface ContractValidationOptions {
    schemaPath: string;
    strict?: boolean;
  }

  export * from '@kitiumai/playwright-helpers/contract/index';
}

declare module '@kitiumai/playwright-helpers/reporting' {
  export interface TestReport {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
  }

  export * from '@kitiumai/playwright-helpers/reporting/index';
}
