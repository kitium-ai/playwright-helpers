/**
 * Simplified authentication flow API
 * Provides one-liner methods for common auth operations
 * Uses @kitiumai/test-core for configuration management
 */

import { type Page } from '@playwright/test';
import { LoginFlow } from './index';
import type { LoginCredentials } from '../auth';
import { getConfigManager } from '@kitiumai/test-core/config';

export interface QuickAuthOptions {
  baseUrl?: string;
  checkA11y?: boolean;
  screenshot?: boolean;
  debug?: boolean;
}

/**
 * Simplified authentication helper
 */
export class QuickAuth {
  private readonly page: Page;
  private readonly loginFlow: LoginFlow;
  private readonly options: QuickAuthOptions;

  constructor(page: Page, options: QuickAuthOptions = {}) {
    this.page = page;
    this.options = options;
    this.loginFlow = new LoginFlow(page, options.baseUrl ? { baseUrl: options.baseUrl } : {});
  }

  /**
   * Quick login - one-liner with smart defaults
   */
  async quick(email: string, password: string): Promise<void> {
    await this.loginFlow.login(
      { email, password },
      {
        loginUrl: '/login',
        waitForUrl: /dashboard|home|app/,
      }
    );
  }

  /**
   * Complete login with full verification and optional features
   */
  async complete(params: {
    credentials: LoginCredentials;
    verify?: boolean;
    checkA11y?: boolean;
    screenshot?: boolean;
    debug?: boolean;
  }): Promise<void> {
    const { credentials, verify = true, checkA11y, screenshot, debug } = params;

    if (debug) {
      console.log(`🔐 Logging in as: ${credentials.email ?? credentials.username}`);
    }

    if (screenshot) {
      await this.page.screenshot({
        path: `./test-results/screenshots/before-login-${Date.now()}.png`,
      });
    }

    if (verify) {
      await this.loginFlow.loginAndVerify(credentials);
    } else {
      await this.loginFlow.login(credentials);
    }

    if (checkA11y) {
      // Import accessibility checker dynamically
      const { createAccessibilityChecker } = await import('../accessibility');
      const a11y = createAccessibilityChecker();
      await a11y.assertNoAccessibilityErrors(this.page);
    }

    if (screenshot) {
      await this.page.screenshot({
        path: `./test-results/screenshots/after-login-${Date.now()}.png`,
      });
    }

    if (debug) {
      console.log(`✅ Login successful - URL: ${this.page.url()}`);
    }
  }

  /**
   * Login with username/password from configuration
   */
  async fromEnv(options?: { emailKey?: string; passwordKey?: string }): Promise<void> {
    const config = getConfigManager();
    const emailKey = options?.emailKey ?? 'testUserEmail';
    const passwordKey = options?.passwordKey ?? 'testUserPassword';

    const email = config.get(emailKey) as string | undefined;
    const password = config.get(passwordKey) as string | undefined;

    if (!email || !password) {
      throw new Error(
        `Missing configuration values. Set ${emailKey} and ${passwordKey} for authentication.`
      );
    }

    await this.quick(email, password);
  }

  /**
   * Login and save auth state for reuse
   */
  async loginAndSaveState(
    credentials: LoginCredentials,
    statePath = './test-results/auth-state.json'
  ): Promise<void> {
    await this.complete({ credentials, verify: true });

    await this.page.context().storageState({ path: statePath });

    if (this.options.debug) {
      console.log(`💾 Auth state saved to: ${statePath}`);
    }
  }

  /**
   * Load previously saved auth state
   */
  async loadState(statePath = './test-results/auth-state.json'): Promise<void> {
    // Note: This needs to be called before creating a page in the test
    // For now, we'll just provide a helpful message
    if (this.options.debug) {
      console.log(
        `ℹ️  To load auth state, use: { storageState: '${statePath}' } in test.use() or context creation`
      );
    }
  }
}

/**
 * Create quick auth helper
 */
export function createQuickAuth(page: Page, options?: QuickAuthOptions): QuickAuth {
  return new QuickAuth(page, options);
}

/**
 * Global auth - create once, use everywhere
 */
let globalAuth: QuickAuth | null = null;

export function getGlobalAuth(page: Page, options?: QuickAuthOptions): QuickAuth {
  if (globalAuth?.['page'] !== page) {
    globalAuth = new QuickAuth(page, options);
  }
  return globalAuth;
}
