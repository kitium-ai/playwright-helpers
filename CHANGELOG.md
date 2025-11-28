# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Core fixture kit (`coreTest`) with console capture, trace-aware artifacts, and network mocking
- CLI scaffolder utility (`scaffoldPlaywrightAsset`) for tests, pages, and flows
- Semantic selector helpers (`strictLocator`, `warnOnNonSemantic`) for ARIA/data-testid-first queries
- Contract-backed network virtualization and OpenAPI-aware mocks
- Trace exporter helpers and quality scorecard gate (`npm run verify:test-quality`)

## [1.0.0] - 2025-11-25

### Added

#### Page Objects

- `BasePage` - Base page object class
- `ApplicationPage` - Extended page object with utilities
- `createPageObject()` - Create page object instance
- `PageObjectRegistry` - Page object registry
- `createPageObjectRegistry()` - Create page object registry

#### Test Flows

- `LoginFlow` - Login flow helper
  - `login()` - Perform login
  - `loginAndVerify()` - Login and verify success
  - `loginAndExpectError()` - Login and expect error
- `LogoutFlow` - Logout flow helper
  - `logout()` - Perform logout
- `FormSubmissionFlow` - Form submission helper
  - `fillAndSubmit()` - Fill and submit form
  - `fillAndVerifyValidation()` - Fill and verify validation errors
- `NavigationFlow` - Navigation helper
  - `navigateSequence()` - Navigate through page sequence
  - `navigateAndVerify()` - Navigate and verify page loaded
- `MultiStepOperation` - Multi-step operation helper
  - `addStep()` - Add step to operation
  - `execute()` - Execute all steps
  - `executeWithRollback()` - Execute with rollback on error
- `UserJourneyFlow` - Complete user journey helper
  - `completeLoginJourney()` - Complete login → dashboard → logout
  - `completeFullJourney()` - Complete custom journey

#### Test Patterns

- `TestDataManager` - Test data setup and teardown
  - `setupLocalStorage()` - Setup localStorage data
  - `setupSessionStorage()` - Setup sessionStorage data
  - `setupCookies()` - Setup cookies
  - `store()` - Store test data
  - `retrieve()` - Retrieve test data
  - `registerCleanup()` - Register cleanup action
  - `cleanup()` - Cleanup all test data
- `ErrorScenarioHelper` - Error scenario testing
  - `testFormValidation()` - Test form validation errors
  - `testApiError()` - Test API error handling
  - `testNetworkError()` - Test network error handling
  - `testUnauthorizedAccess()` - Test permission errors
- `CommonPatterns` - Common operation patterns
  - `waitForPageLoad()` - Wait for page to load
  - `retryAction()` - Retry action with backoff
  - `waitForElementState()` - Wait for element state
  - `waitForElements()` - Wait for multiple elements
  - `scrollToAndWait()` - Scroll to element and wait
  - `clickAndWaitForNavigation()` - Click and wait for navigation

#### Assertions

- `createAssertion()` - Create fluent assertion builder
- `AssertionBuilder` - Fluent assertion API
  - `hasText()` - Assert text content
  - `isVisible()` - Assert visibility
  - `isHidden()` - Assert hidden
  - `isEnabled()` - Assert enabled
  - `isDisabled()` - Assert disabled
  - `hasAttribute()` - Assert attribute
  - `hasValue()` - Assert value
  - `isChecked()` - Assert checked
  - `pageUrlMatches()` - Assert URL matches
  - `pageTitle()` - Assert page title
- Individual assertion functions
  - `assertTextContent()`
  - `assertIsVisible()`
  - `assertIsHidden()`
  - `assertIsEnabled()`
  - `assertIsDisabled()`
  - `assertUrlMatches()`
  - `assertHasAttribute()`
  - `assertHasClass()`
  - `assertElementCount()`
  - `assertPageTitle()`
  - `assertElementValue()`
  - `assertIsChecked()`
  - `assertTextAppears()`
  - `assertTextNotAppears()`
  - `assertConsoleMessages()`
  - `assertNoConsoleErrors()`
  - `assertResponseStatus()`

#### Network Mocking

- `NetworkMockManager` - Network mock manager
  - `setupRouteInterception()` - Setup route interception
  - `mockGet()` - Mock GET requests
  - `mockPost()` - Mock POST requests
  - `mockPut()` - Mock PUT requests
  - `mockDelete()` - Mock DELETE requests
  - `mockPatch()` - Mock PATCH requests
  - `getRequests()` - Get all requests
  - `getRequestsByUrl()` - Get requests by URL
  - `getRequestsByMethod()` - Get requests by method
  - `wasRequestMade()` - Check if request was made
  - `clear()` - Clear all mocks

#### Authentication

- `createAuthHelper()` - Create authentication helper
- `AuthHelper` - Authentication helper class
  - `setTokenInStorage()` - Set auth token in storage
  - `isAuthenticated()` - Check authentication status
  - `login()` - Perform login
  - `logout()` - Perform logout
- `AuthPresets` - Authentication presets
  - `emailLogin()` - Email/password login preset
  - `oauth()` - OAuth preset
  - `tokenBased()` - Token-based preset

#### Accessibility

- `createAccessibilityChecker()` - Create accessibility checker
- `AccessibilityChecker` - Accessibility checker class
  - `fullCheck()` - Run full accessibility check
  - `assertNoAccessibilityErrors()` - Assert no errors
  - `checkFormLabels()` - Check form labels
  - `checkHeadingHierarchy()` - Check heading hierarchy
  - `checkColorContrast()` - Check color contrast
  - `checkKeyboardNavigation()` - Check keyboard navigation

#### Visual Testing

- `createVisualRegressionHelper()` - Create visual regression helper
- `VisualRegressionHelper` - Visual regression helper class
  - `compareScreenshot()` - Compare screenshot
  - `getElementBoundingBox()` - Get element dimensions
  - `captureElement()` - Capture element screenshot
  - `compareElements()` - Compare element screenshots

#### Performance

- `createPerformanceMonitor()` - Create performance monitor
- `PerformanceMonitor` - Performance monitor class
  - `getPageLoadTime()` - Get page load time
  - `getCoreWebVitals()` - Get Core Web Vitals
  - `measureOperation()` - Measure operation performance
  - `assertLoadTimeUnder()` - Assert load time under threshold
  - `getResourceTiming()` - Get resource timing
  - `getNavigationTiming()` - Get navigation timing

#### Testing Utilities

- `E2ETestData` - Test data storage
- `FormHelper` - Form interaction helper
- `TableHelper` - Table data helper
- `DialogHelper` - Dialog/modal helper
- `NavigationHelper` - Navigation helper
- `WaitHelper` - Wait utilities
- `ScreenshotHelper` - Screenshot utilities
- `StorageHelper` - Storage/cookie utilities
- `ConsoleHelper` - Console message capture
- `E2ETestHelper` - Composite helper combining all utilities

#### Setup

- `createTest()` - Create Playwright test with custom fixtures
- `PlaywrightPresets` - Pre-configured presets
  - `development` - Development preset
  - `ci` - CI/CD preset
  - `visualRegression` - Visual regression preset
  - `performance` - Performance test preset
  - `accessibility` - Accessibility test preset
- `globalSetup()` - Global test setup
- `globalTeardown()` - Global test teardown
- `setupPageForTesting()` - Setup page for testing
- `setupContextForTesting()` - Setup context for testing
- `setupEnvironmentVariables()` - Setup environment variables
- `cleanupAfterTest()` - Cleanup after test
- `generatePlaywrightConfig()` - Generate Playwright config

### Features

- Full TypeScript support
- Comprehensive Page Object Model framework
- Reusable test flow patterns
- Common test patterns and utilities
- Fluent assertion API
- Network request mocking
- Authentication flow helpers
- Accessibility testing
- Visual regression testing
- Performance monitoring
- Test data management
- Error scenario testing

### Documentation

- Complete API documentation
- Usage examples
- TypeScript type definitions
- README with quick start guide

## [Unreleased]

### Added

- **Resilience toolkit** (circuit breaker, chaos injector, timeout manager, `withResilience()`) for fault-tolerant Playwright flows.
- **Tracing utilities** (`TraceManager`, `traceTest`, `traceChild`, page trace propagation/extraction) for correlating browser activity with backend telemetry.
- **Reporting & analytics** upgrades: flaky-test detection, HTML report generator, enhanced execution recorder/exporters.
- **Playwright configuration generator** now exports a fully typed `PlaywrightTestConfig` aligned with the shared `@kitiumai/config` template and presets.
- **Console/storage helpers** capture structured browser logs (with optional trace/request IDs) and strictly typed cookie/session helpers.
- **Performance monitor** adds Core Web Vitals capture, resource timing exports, and profiling helpers.

### Changed

- Enforced strict TypeScript and eslint rules (`exactOptionalPropertyTypes`, no implicit `any`, nullish coalescing) across helpers for better DX.
- Page objects, flows, and patterns now include contextual retries, refined error surfaces, and shared logging metadata.
- README expanded with the new modules (resilience, tracing, reporting, performance, configuration) and updated dependency guidance.

### Fixed

- Timeout manager avoids returning Promises from `setTimeout`, satisfying lint rules and preventing unhandled rejections.
- Console helper normalises log arguments, removing raw JS handles and avoiding undefined metadata.
- Storage helper only forwards cookie fields accepted by Playwright, preventing runtime errors.
