/**
 * Reusable test flow patterns for Playwright E2E tests
 * Provides common user flows and multi-step operations
 */

import { type Page, expect } from '@playwright/test';
import { createFormHelper, createNavigationHelper } from '../testing';
import type { LoginCredentials } from '../auth';
import { getConfigManager } from '@kitiumai/test-core';

// Re-export LoginCredentials from auth for consistency
export type { LoginCredentials } from '../auth';

export interface UserFlowOptions {
  baseUrl?: string;
  timeout?: number;
}

/**
 * Login flow helper
 */
export class LoginFlow {
  private readonly page: Page;
  private readonly baseUrl: string;
  private readonly formHelper: ReturnType<typeof createFormHelper>;
  private readonly navigationHelper: ReturnType<typeof createNavigationHelper>;

  constructor(page: Page, options: UserFlowOptions = {}) {
    const config = getConfigManager();
    this.page = page;
    this.baseUrl = options.baseUrl ?? config.get('baseUrl') ?? 'http://localhost:3000';
    this.formHelper = createFormHelper(page);
    this.navigationHelper = createNavigationHelper(page);
  }

  /**
   * Perform login with credentials
   */
  async login(
    credentials: LoginCredentials,
    options: {
      loginUrl?: string;
      emailSelector?: string;
      passwordSelector?: string;
      submitSelector?: string;
      waitForUrl?: string | RegExp;
    } = {}
  ): Promise<void> {
    const {
      loginUrl = '/login',
      emailSelector = 'input[type="email"]',
      passwordSelector = 'input[type="password"]',
      submitSelector = 'button[type="submit"]',
      waitForUrl: waitForUrlPattern,
    } = options;

    // Navigate to login page
    await this.navigationHelper.navigateTo(this.baseUrl + loginUrl);

    // Fill login form - support both email and username
    const usernameOrEmail = credentials.email ?? credentials.username ?? '';
    await this.formHelper.fillField(emailSelector, usernameOrEmail);
    await this.formHelper.fillField(passwordSelector, credentials.password);

    // Submit form
    await this.page.locator(submitSelector).click();

    // Wait for navigation or specific URL
    if (waitForUrlPattern) {
      await this.page.waitForURL(waitForUrlPattern, { timeout: 10000 });
    } else {
      // Default: wait for navigation (assumes redirect after login)
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
    }
  }

  /**
   * Perform login and verify success
   */
  async loginAndVerify(
    credentials: LoginCredentials,
    options: {
      loginUrl?: string;
      emailSelector?: string;
      passwordSelector?: string;
      submitSelector?: string;
      successIndicator?: string;
      expectedUrl?: string | RegExp;
    } = {}
  ): Promise<void> {
    await this.login(credentials, options);

    // Verify login success
    if (options.successIndicator) {
      await expect(this.page.locator(options.successIndicator)).toBeVisible({ timeout: 5000 });
    }

    if (options.expectedUrl) {
      await expect(this.page).toHaveURL(options.expectedUrl);
    }
  }

  /**
   * Perform login and expect error
   */
  async loginAndExpectError(
    credentials: LoginCredentials,
    options: {
      loginUrl?: string;
      emailSelector?: string;
      passwordSelector?: string;
      submitSelector?: string;
      errorSelector?: string;
      expectedErrorText?: string;
    } = {}
  ): Promise<string> {
    const {
      loginUrl = '/login',
      emailSelector = 'input[type="email"]',
      passwordSelector = 'input[type="password"]',
      submitSelector = 'button[type="submit"]',
      errorSelector = '[role="alert"]',
    } = options;

    await this.navigationHelper.navigateTo(this.baseUrl + loginUrl);
    const usernameOrEmail = credentials.email ?? credentials.username ?? '';
    await this.formHelper.fillField(emailSelector, usernameOrEmail);
    await this.formHelper.fillField(passwordSelector, credentials.password);
    await this.page.locator(submitSelector).click();

    // Wait for error message
    const errorElement = this.page.locator(errorSelector);
    await expect(errorElement).toBeVisible({ timeout: 5000 });

    const errorText = await errorElement.textContent();

    if (options.expectedErrorText && errorText) {
      expect(errorText).toContain(options.expectedErrorText);
    }

    return errorText ?? '';
  }
}

/**
 * Logout flow helper
 */
export class LogoutFlow {
  private readonly page: Page;

  constructor(page: Page, _options: UserFlowOptions = {}) {
    this.page = page;
  }

  /**
   * Perform logout
   */
  async logout(
    options: {
      logoutSelector?: string;
      expectedUrl?: string | RegExp;
    } = {}
  ): Promise<void> {
    const { logoutSelector = 'button:has-text("Logout")', expectedUrl = /login/ } = options;

    await this.page.locator(logoutSelector).click();
    await this.page.waitForURL(expectedUrl, { timeout: 10000 });
  }
}

/**
 * Form submission flow helper
 */
export class FormSubmissionFlow {
  private readonly page: Page;
  private readonly formHelper: ReturnType<typeof createFormHelper>;

  constructor(page: Page) {
    this.page = page;
    this.formHelper = createFormHelper(page);
  }

  /**
   * Fill and submit form
   */
  async fillAndSubmit(
    formData: Record<string, string>,
    options: {
      submitSelector?: string;
      waitForNavigation?: boolean;
      waitForUrl?: string | RegExp;
    } = {}
  ): Promise<void> {
    const {
      submitSelector = 'button[type="submit"]',
      waitForNavigation = true,
      waitForUrl,
    } = options;

    // Fill all fields
    await this.formHelper.fillFields(formData);

    // Submit form
    if (waitForNavigation) {
      await Promise.all([
        waitForUrl
          ? this.page.waitForURL(waitForUrl, { timeout: 10000 })
          : this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        this.page.locator(submitSelector).click(),
      ]);
    } else {
      await this.page.locator(submitSelector).click();
    }
  }

  /**
   * Fill form and verify validation errors
   */
  async fillAndVerifyValidation(
    formData: Record<string, string>,
    options: {
      submitSelector?: string;
      errorSelectors?: Record<string, string>;
      expectedErrors?: Record<string, string>;
    } = {}
  ): Promise<Record<string, string>> {
    const {
      submitSelector = 'button[type="submit"]',
      errorSelectors = {},
      expectedErrors = {},
    } = options;

    await this.formHelper.fillFields(formData);
    await this.page.locator(submitSelector).click();

    // Wait a bit for validation to appear
    await this.page.waitForTimeout(500);

    const errors: Record<string, string> = {};

    // Collect error messages
    for (const [field, errorSelector] of Object.entries(errorSelectors)) {
      const errorElement = this.page.locator(errorSelector);
      const isVisible = await errorElement.isVisible().catch(() => false);
      if (isVisible) {
        errors[field] = (await errorElement.textContent()) ?? '';
      }
    }

    // Verify expected errors
    for (const [field, expectedError] of Object.entries(expectedErrors)) {
      if (errors[field]) {
        expect(errors[field]).toContain(expectedError);
      } else {
        throw new Error(`Expected validation error for field '${field}' but none found`);
      }
    }

    return errors;
  }
}

/**
 * Navigation flow helper
 */
export class NavigationFlow {
  private readonly page: Page;
  private readonly baseUrl: string;
  private readonly navigationHelper: ReturnType<typeof createNavigationHelper>;

  constructor(page: Page, options: UserFlowOptions = {}) {
    this.page = page;
    this.baseUrl = options.baseUrl ?? process.env['BASE_URL'] ?? 'http://localhost:3000';
    this.navigationHelper = createNavigationHelper(page);
  }

  /**
   * Navigate through a sequence of pages
   */
  async navigateSequence(
    pages: Array<{
      path: string;
      verifySelector?: string;
      verifyText?: string;
      waitForUrl?: string | RegExp;
    }>
  ): Promise<void> {
    for (const pageConfig of pages) {
      await this.navigationHelper.navigateTo(this.baseUrl + pageConfig.path);

      if (pageConfig.waitForUrl) {
        await this.page.waitForURL(pageConfig.waitForUrl, { timeout: 10000 });
      }

      if (pageConfig.verifySelector) {
        await expect(this.page.locator(pageConfig.verifySelector)).toBeVisible({ timeout: 5000 });
      }

      if (pageConfig.verifyText) {
        await expect(this.page.locator(`text=${pageConfig.verifyText}`)).toBeVisible({
          timeout: 5000,
        });
      }
    }
  }

  /**
   * Navigate and verify page loaded
   */
  async navigateAndVerify(
    path: string,
    options: {
      verifySelector?: string;
      verifyText?: string;
      waitForUrl?: string | RegExp;
      waitForNetworkIdle?: boolean;
    } = {}
  ): Promise<void> {
    await this.navigationHelper.navigateTo(this.baseUrl + path);

    if (options.waitForNetworkIdle) {
      await this.page.waitForLoadState('networkidle');
    }

    if (options.waitForUrl) {
      await this.page.waitForURL(options.waitForUrl, { timeout: 10000 });
    }

    if (options.verifySelector) {
      await expect(this.page.locator(options.verifySelector)).toBeVisible({ timeout: 5000 });
    }

    if (options.verifyText) {
      await expect(this.page.locator(`text=${options.verifyText}`)).toBeVisible({ timeout: 5000 });
    }
  }
}

/**
 * Multi-step operation helper
 */
export class MultiStepOperation {
  private readonly steps: Array<{ name: string; action: () => Promise<void> }> = [];
  private onStepComplete?: (stepName: string) => void;
  private onError?: (stepName: string, error: Error) => void;

  constructor(_page: Page) {
    // Page is kept in constructor for future use or API consistency
  }

  /**
   * Add a step to the operation
   */
  addStep(name: string, action: () => Promise<void>): this {
    this.steps.push({ name, action });
    return this;
  }

  /**
   * Set callback for step completion
   */
  onStepCompleteCallback(callback: (stepName: string) => void): this {
    this.onStepComplete = callback;
    return this;
  }

  /**
   * Set callback for step errors
   */
  onErrorCallback(callback: (stepName: string, error: Error) => void): this {
    this.onError = callback;
    return this;
  }

  /**
   * Execute all steps
   */
  async execute(): Promise<void> {
    for (const step of this.steps) {
      try {
        await step.action();
        this.onStepComplete?.(step.name);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.onError?.(step.name, err);
        throw new Error(`Step '${step.name}' failed: ${err.message}`);
      }
    }
  }

  /**
   * Execute steps with rollback on error
   */
  async executeWithRollback(
    rollbackActions: Array<{ name: string; action: () => Promise<void> }>
  ): Promise<void> {
    const executedSteps: string[] = [];

    try {
      for (const step of this.steps) {
        await step.action();
        executedSteps.push(step.name);
        this.onStepComplete?.(step.name);
      }
    } catch (error) {
      // Rollback executed steps in reverse order
      for (let i = executedSteps.length - 1; i >= 0; i--) {
        const rollback = rollbackActions.find((r) => r.name === executedSteps[i]);
        if (rollback) {
          try {
            await rollback.action();
          } catch (rollbackError) {
            console.error(`Rollback for step '${executedSteps[i]}' failed:`, rollbackError);
          }
        }
      }
      throw error;
    }
  }
}

/**
 * Complete user journey flow
 */
export class UserJourneyFlow {
  private readonly page: Page;
  private readonly loginFlow: LoginFlow;
  private readonly logoutFlow: LogoutFlow;
  private readonly navigationFlow: NavigationFlow;

  constructor(page: Page, options: UserFlowOptions = {}) {
    this.page = page;
    this.loginFlow = new LoginFlow(page, options);
    this.logoutFlow = new LogoutFlow(page, options);
    this.navigationFlow = new NavigationFlow(page, options);
  }

  /**
   * Complete login -> dashboard -> logout flow
   */
  async completeLoginJourney(
    credentials: LoginCredentials,
    options: {
      loginOptions?: Parameters<LoginFlow['login']>[1];
      dashboardPath?: string;
      dashboardVerifySelector?: string;
      logoutOptions?: Parameters<LogoutFlow['logout']>[0];
    } = {}
  ): Promise<void> {
    const {
      loginOptions,
      dashboardPath = '/dashboard',
      dashboardVerifySelector,
      logoutOptions,
    } = options;

    // 1. Login
    await this.loginFlow.login(credentials, loginOptions);

    // 2. Verify dashboard
    if (dashboardVerifySelector) {
      await expect(this.page.locator(dashboardVerifySelector)).toBeVisible({ timeout: 5000 });
    } else {
      await this.page.waitForURL(new RegExp(dashboardPath), { timeout: 10000 });
    }

    // 3. Logout
    await this.logoutFlow.logout(logoutOptions);
  }

  /**
   * Complete full user journey with multiple steps
   */
  async completeFullJourney(
    steps: Array<{
      type: 'login' | 'navigate' | 'action' | 'verify' | 'logout';
      credentials?: LoginCredentials;
      path?: string;
      action?: () => Promise<void>;
      verifySelector?: string;
      verifyText?: string;
    }>
  ): Promise<void> {
    for (const step of steps) {
      switch (step.type) {
        case 'login':
          if (step.credentials) {
            await this.loginFlow.login(step.credentials);
          }
          break;
        case 'navigate':
          if (step.path) {
            const navOptions: {
              verifySelector?: string;
              verifyText?: string;
              waitForUrl?: string | RegExp;
              waitForNetworkIdle?: boolean;
            } = {};
            if (step.verifySelector !== undefined) {
              navOptions.verifySelector = step.verifySelector;
            }
            if (step.verifyText !== undefined) {
              navOptions.verifyText = step.verifyText;
            }
            await this.navigationFlow.navigateAndVerify(step.path, navOptions);
          }
          break;
        case 'action':
          if (step.action) {
            await step.action();
          }
          break;
        case 'verify':
          if (step.verifySelector) {
            await expect(this.page.locator(step.verifySelector)).toBeVisible({ timeout: 5000 });
          }
          if (step.verifyText) {
            await expect(this.page.locator(`text=${step.verifyText}`)).toBeVisible({
              timeout: 5000,
            });
          }
          break;
        case 'logout':
          await this.logoutFlow.logout();
          break;
      }
    }
  }
}

/**
 * Create login flow helper
 */
export function createLoginFlow(page: Page, options?: UserFlowOptions): LoginFlow {
  return new LoginFlow(page, options);
}

/**
 * Create logout flow helper
 */
export function createLogoutFlow(page: Page, options?: UserFlowOptions): LogoutFlow {
  return new LogoutFlow(page, options);
}

/**
 * Create form submission flow helper
 */
export function createFormSubmissionFlow(page: Page): FormSubmissionFlow {
  return new FormSubmissionFlow(page);
}

/**
 * Create navigation flow helper
 */
export function createNavigationFlow(page: Page, options?: UserFlowOptions): NavigationFlow {
  return new NavigationFlow(page, options);
}

/**
 * Create multi-step operation helper
 */
export function createMultiStepOperation(page: Page): MultiStepOperation {
  return new MultiStepOperation(page);
}

/**
 * Create user journey flow helper
 */
export function createUserJourneyFlow(page: Page, options?: UserFlowOptions): UserJourneyFlow {
  return new UserJourneyFlow(page, options);
}

// Enhanced APIs
export * from './quick-auth';
