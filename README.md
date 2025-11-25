# @kitiumai/playwright-helpers

Playwright E2E test helpers for enterprise testing. Provides comprehensive utilities for Page Object Model, custom assertions, network mocking, authentication, accessibility testing, visual regression, performance monitoring, and reusable test flows.

## Installation

```bash
npm install @kitiumai/playwright-helpers
```

**Peer Dependencies:**

- `@playwright/test` ^1.40.0
- `typescript` ^5.0.0

## Features

- 📄 **Page Object Model** - Comprehensive POM framework
- ✅ **Custom Assertions** - Fluent assertion API
- 🌐 **Network Mocking** - Request interception and mocking
- 🔐 **Authentication** - Login/logout flow helpers
- ♿ **Accessibility** - A11y testing utilities
- 🎨 **Visual Testing** - Screenshot and visual regression
- ⚡ **Performance & Reporting** - Core Web Vitals monitoring plus HTML analytics
- 🔄 **Test Flows** - Reusable user flow patterns
- 🧩 **Test Patterns** - Common test patterns and utilities
- ⚙️ **Setup & Config** - Playwright presets, global hooks, `generatePlaywrightConfig()`
- 🛡️ **Resilience & Chaos** - Circuit breakers, timeouts, retries, and chaos injectors
- 🔍 **Tracing & Observability** - Trace propagation, child spans, and console capture

## Quick Start

```typescript
import { test, expect } from '@playwright/test';
import {
  ApplicationPage,
  createLoginFlow,
  createAssertion,
  createAccessibilityChecker,
} from '@kitiumai/playwright-helpers';

// Create page object
class LoginPage extends ApplicationPage {
  async login(email: string, password: string) {
    await this.fillField('input[type="email"]', email);
    await this.fillField('input[type="password"]', password);
    await this.click('button[type="submit"]');
    await this.waitForUrl(/dashboard/);
  }
}

test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page, { baseUrl: 'http://localhost:3000' });
  await loginPage.goto('/login');
  await loginPage.login('user@example.com', 'password');
  expect(page.url()).toContain('dashboard');
});
```

## API Reference

### Page Objects

#### `BasePage`

Base class for page objects.

**Example:**

```typescript
import { BasePage } from '@kitiumai/playwright-helpers';

class HomePage extends BasePage {
  async getWelcomeMessage() {
    return await this.getText('h1');
  }

  async clickLoginButton() {
    await this.click('button:has-text("Login")');
  }
}
```

#### `ApplicationPage`

Extended page object with additional utilities.

**Methods:**

- `goto(path, options?)` - Navigate to page
- `click(selector)` - Click element
- `type(selector, text)` - Type text
- `getText(selector)` - Get text content
- `isVisible(selector)` - Check visibility
- `waitForElement(selector)` - Wait for element
- `fillField(selector, value)` - Fill form field
- `selectOption(selector, value)` - Select dropdown option
- `waitForUrl(pattern)` - Wait for URL match
- `reload()` - Reload page
- `goBack()` - Navigate back
- `goForward()` - Navigate forward

**Example:**

```typescript
import { ApplicationPage } from '@kitiumai/playwright-helpers';

class DashboardPage extends ApplicationPage {
  async getUserName() {
    return await this.getText('[data-testid="user-name"]');
  }

  async logout() {
    await this.click('button:has-text("Logout")');
    await this.waitForUrl(/login/);
  }
}
```

### Test Flows

#### `LoginFlow`

Login flow helper.

**Example:**

```typescript
import { createLoginFlow } from '@kitiumai/playwright-helpers';

const loginFlow = createLoginFlow(page, { baseUrl: 'http://localhost:3000' });

// Simple login
await loginFlow.login(
  { email: 'user@example.com', password: 'password' },
  {
    loginUrl: '/login',
    emailSelector: 'input[type="email"]',
    passwordSelector: 'input[type="password"]',
    submitSelector: 'button[type="submit"]',
    waitForUrl: /dashboard/,
  }
);

// Login and verify
await loginFlow.loginAndVerify(
  { email: 'user@example.com', password: 'password' },
  {
    successIndicator: '[data-testid="user-menu"]',
    expectedUrl: /dashboard/,
  }
);

// Login and expect error
const errorText = await loginFlow.loginAndExpectError(
  { email: 'invalid@example.com', password: 'wrong' },
  {
    errorSelector: '[role="alert"]',
    expectedErrorText: 'Invalid credentials',
  }
);
```

#### `LogoutFlow`

Logout flow helper.

**Example:**

```typescript
import { createLogoutFlow } from '@kitiumai/playwright-helpers';

const logoutFlow = createLogoutFlow(page);
await logoutFlow.logout({
  logoutSelector: 'button:has-text("Logout")',
  expectedUrl: /login/,
});
```

#### `FormSubmissionFlow`

Form submission helper.

**Example:**

```typescript
import { createFormSubmissionFlow } from '@kitiumai/playwright-helpers';

const formFlow = createFormSubmissionFlow(page);

// Fill and submit
await formFlow.fillAndSubmit(
  {
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Test message',
  },
  {
    submitSelector: 'button[type="submit"]',
    waitForUrl: /success/,
  }
);

// Fill and verify validation
const errors = await formFlow.fillAndVerifyValidation(
  { email: 'invalid' },
  {
    errorSelectors: {
      email: '[data-error="email"]',
    },
    expectedErrors: {
      email: 'Invalid email format',
    },
  }
);
```

#### `UserJourneyFlow`

Complete user journey helper.

**Example:**

```typescript
import { createUserJourneyFlow } from '@kitiumai/playwright-helpers';

const journey = createUserJourneyFlow(page);

// Complete login journey
await journey.completeLoginJourney(
  { email: 'user@example.com', password: 'password' },
  {
    dashboardPath: '/dashboard',
    dashboardVerifySelector: '[data-testid="dashboard"]',
  }
);

// Complete full journey
await journey.completeFullJourney([
  { type: 'login', credentials: { email: 'user@example.com', password: 'password' } },
  { type: 'navigate', path: '/dashboard', verifySelector: '[data-testid="dashboard"]' },
  { type: 'action', action: async () => await page.click('button:has-text("Create")') },
  { type: 'verify', verifySelector: '[data-testid="success"]' },
  { type: 'logout' },
]);
```

### Test Patterns

#### `TestDataManager`

Test data setup and teardown.

**Example:**

```typescript
import { createTestDataManager } from '@kitiumai/playwright-helpers';

const dataManager = createTestDataManager(page);

// Setup localStorage
await dataManager.setupLocalStorage({
  authToken: 'test-token',
  userId: '123',
});

// Setup cookies
await dataManager.setupCookies([{ name: 'session', value: 'abc123', domain: 'localhost' }]);

// Store and retrieve data
dataManager.store('userId', '123');
const userId = dataManager.retrieve<string>('userId');

// Cleanup
await dataManager.cleanup();
```

#### `ErrorScenarioHelper`

Error scenario testing.

**Example:**

```typescript
import { createErrorScenarioHelper } from '@kitiumai/playwright-helpers';

const errorHelper = createErrorScenarioHelper(page);

// Test form validation
const errors = await errorHelper.testFormValidation(
  { email: 'invalid', password: '' },
  {
    expectedErrors: {
      email: 'Invalid email',
      password: 'Required',
    },
  }
);

// Test API error
const errorText = await errorHelper.testApiError(
  async () => await page.click('button:has-text("Submit")'),
  {
    errorSelector: '[role="alert"]',
    expectedErrorText: 'Server error',
  }
);

// Test network error
await errorHelper.testNetworkError(async () => await page.click('button:has-text("Load")'), {
  simulateOffline: true,
  expectedErrorText: 'Network error',
});
```

#### `CommonPatterns`

Common operation patterns.

**Example:**

```typescript
import { createCommonPatterns } from '@kitiumai/playwright-helpers';

const patterns = createCommonPatterns(page);

// Wait for page load
await patterns.waitForPageLoad({
  waitForNetworkIdle: true,
  waitForSelector: '[data-testid="content"]',
});

// Retry action
const result = await patterns.retryAction(async () => await page.locator('button').click(), {
  maxAttempts: 3,
  delayMs: 1000,
});

// Wait for element state
await patterns.waitForElementState('button', 'visible', 5000);

// Scroll and wait
await patterns.scrollToAndWait('[data-testid="footer"]');

// Click and wait for navigation
await patterns.clickAndWaitForNavigation('a:has-text("Next")', {
  waitForUrl: /page-2/,
});
```

### Resilience & Chaos Testing

#### `withResilience()`

Wrap any async operation with circuit breaker, timeout, retry, and chaos simulation support.

```typescript
import { withResilience } from '@kitiumai/playwright-helpers/resilience';

const result = await withResilience(
  {
    circuitBreaker: { threshold: 3, timeout: 5000 },
    timeout: 10_000,
    retry: { maxAttempts: 3, delayMs: 500 },
    chaos: { networkFailure: { durationMs: 1000 } },
  },
  async () => {
    await page.goto('/api-heavy-page');
    return page.locator('[data-testid="summary"]').innerText();
  }
);
```

#### `createChaosInjector(page)`

Simulate network failures, slow networks, or random server errors directly in Playwright.

```typescript
import { createChaosInjector } from '@kitiumai/playwright-helpers/resilience';

const chaos = createChaosInjector(page);
await chaos.simulateNetworkFailure(2000);
await chaos.simulateServerErrors(503, 5000);
```

### Tracing & Observability

#### `TraceManager` / `traceTest`

Capture nested spans and propagate trace context through Playwright pages.

```typescript
import { traceTest, getTraceManager } from '@kitiumai/playwright-helpers/tracing';

await traceTest('user.checkout', async (spanId) => {
  await page.goto('/checkout');
  await traceTest('checkout.fill-form', async () => {
    await page.fill('#card', '4242 4242 4242 4242');
  });
  await page.click('button:has-text("Pay")');
});

const spans = getTraceManager().exportSpans();
console.log(spans.map((span) => span.name));
```

#### Console Helper

Automatically capture browser console output with trace/request IDs for assertions or logging.

```typescript
import { ConsoleHelper } from '@kitiumai/playwright-helpers/testing';

const consoleHelper = new ConsoleHelper(page);
// ... run test
consoleHelper.assertNoErrors();
```

### Reporting & Analytics

Generate analytics, detect flaky tests, or emit HTML reports from Playwright runs.

```typescript
import { createTestReporter } from '@kitiumai/playwright-helpers/reporting';

const { recorder, flakyDetector, analyticsGenerator, htmlReportGenerator } = createTestReporter();

recorder.record({
  testName: 'checkout e2e',
  testPath: 'tests/checkout.spec.ts',
  status: 'passed',
  duration: 1423,
  startTime: Date.now(),
  endTime: Date.now() + 1423,
});

const analytics = analyticsGenerator.generate();
htmlReportGenerator.generateReport(analytics, recorder.getExecutions(), {
  includeScreenshots: true,
});
```

### Assertions

#### `createAssertion(page, locator?)`

Create fluent assertion builder.

**Example:**

```typescript
import { createAssertion } from '@kitiumai/playwright-helpers';

const button = page.locator('button:has-text("Submit")');
const assertion = createAssertion(page, button);

assertion.isVisible().isEnabled().hasText('Submit').hasAttribute('type', 'submit');

// Page assertions
createAssertion(page)
  .pageUrlMatches(/dashboard/)
  .pageTitle('Dashboard');
```

### Network Mocking

#### `createNetworkMockManager()`

Network mock manager.

**Example:**

```typescript
import { createNetworkMockManager } from '@kitiumai/playwright-helpers';

const manager = createNetworkMockManager();
await manager.setupRouteInterception(page);

manager.mockGet(/api\/users\/\d+/, JSON.stringify({ id: 1, name: 'John' }));

manager.mockPost(/api\/users/, JSON.stringify({ success: true }), { status: 201 });

const requests = manager.getRequestsByUrl('api/users');
```

### Authentication

#### `createAuthHelper(config)`

Authentication helper.

**Example:**

```typescript
import { createAuthHelper, AuthPresets } from '@kitiumai/playwright-helpers';

const authHelper = createAuthHelper(AuthPresets.emailLogin('http://localhost:3000/login'));

// Set token in storage
await authHelper.setTokenInStorage(page, { accessToken: 'token123' }, 'authToken');

// Check authentication
const isAuth = await authHelper.isAuthenticated(page);
```

### Accessibility

#### `createAccessibilityChecker()`

Accessibility checker.

**Example:**

```typescript
import { createAccessibilityChecker } from '@kitiumai/playwright-helpers';

const a11y = createAccessibilityChecker();

// Full check
const result = await a11y.fullCheck(page);
expect(result.issues.filter((i) => i.type === 'error')).toHaveLength(0);

// Assert no errors
await a11y.assertNoAccessibilityErrors(page);

// Check specific aspects
const formIssues = await a11y.checkFormLabels(page);
const headingIssues = await a11y.checkHeadingHierarchy(page);
```

### Performance

#### `createPerformanceMonitor()`

Performance monitor.

**Example:**

```typescript
import { createPerformanceMonitor } from '@kitiumai/playwright-helpers';

const perf = createPerformanceMonitor();

// Get page load time
const loadTime = await perf.getPageLoadTime(page);
expect(loadTime).toBeLessThan(3000);

// Get Core Web Vitals
const vitals = await perf.getCoreWebVitals(page);
expect(vitals.lcp).toBeLessThan(2500);
expect(vitals.cls).toBeLessThan(0.1);

// Measure operation
const { result, duration } = await perf.measureOperation(
  async () => await page.click('button'),
  'Click button'
);

// Assert load time
await perf.assertLoadTimeUnder(page, 5000);
```

### Visual Testing

#### `createVisualRegressionHelper()`

Visual regression helper.

**Example:**

```typescript
import { createVisualRegressionHelper } from '@kitiumai/playwright-helpers';

const visual = createVisualRegressionHelper();

// Compare screenshot
const result = await visual.compareScreenshot(page, 'home-page', {
  fullPage: true,
});

// Get element dimensions
const dimensions = await visual.getElementBoundingBox(page, 'button');
```

### Test Setup

#### `setupPageForTesting(page)`

Setup page for testing.

**Example:**

```typescript
import { setupPageForTesting } from '@kitiumai/playwright-helpers';

test.beforeEach(async ({ page }) => {
  await setupPageForTesting(page);
});
```

#### `PlaywrightPresets`

Pre-configured presets.

**Example:**

```typescript
import { PlaywrightPresets } from '@kitiumai/playwright-helpers';

// Use preset in config
export default defineConfig(PlaywrightPresets.development);
export default defineConfig(PlaywrightPresets.ci);
export default defineConfig(PlaywrightPresets.visualRegression);
```

#### `generatePlaywrightConfig(options)`

Produce a fully typed `PlaywrightTestConfig` aligned with Kitium’s shared presets.

```typescript
import { generatePlaywrightConfig } from '@kitiumai/playwright-helpers/setup';

export default generatePlaywrightConfig({
  baseURL: process.env.BASE_URL,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  projects: [
    { name: 'chromium', use: { channel: 'chrome' } },
    { name: 'firefox', use: {} },
  ],
});
```

## Examples

### Complete E2E Test

```typescript
import { test, expect } from '@playwright/test';
import {
  ApplicationPage,
  createLoginFlow,
  createAccessibilityChecker,
  createPerformanceMonitor,
  createTestDataManager,
} from '@kitiumai/playwright-helpers';

class LoginPage extends ApplicationPage {
  async login(email: string, password: string) {
    await this.fillField('input[type="email"]', email);
    await this.fillField('input[type="password"]', password);
    await this.click('button[type="submit"]');
    await this.waitForUrl(/dashboard/);
  }
}

test.describe('User Authentication', () => {
  test('should complete login flow', async ({ page }) => {
    const loginPage = new LoginPage(page, { baseUrl: 'http://localhost:3000' });
    const loginFlow = createLoginFlow(page);
    const a11y = createAccessibilityChecker();
    const perf = createPerformanceMonitor();
    const dataManager = createTestDataManager(page);

    // Setup test data
    await dataManager.setupLocalStorage({ theme: 'dark' });

    // Navigate and check accessibility
    await loginPage.goto('/login');
    await a11y.assertNoAccessibilityErrors(page);

    // Login
    await loginFlow.loginAndVerify(
      { email: 'user@example.com', password: 'password' },
      { expectedUrl: /dashboard/ }
    );

    // Check performance
    const loadTime = await perf.getPageLoadTime(page);
    expect(loadTime).toBeLessThan(3000);

    // Cleanup
    await dataManager.cleanup();
  });
});
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions.

```typescript
import type {
  PageObjectOptions,
  LoginCredentials,
  UserFlowOptions,
} from '@kitiumai/playwright-helpers';
```

## License

MIT
