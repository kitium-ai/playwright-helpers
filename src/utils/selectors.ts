/**
 * Smart selector utilities
 * Provides fallback strategies for finding elements
 */

/**
 * Generate multiple selector strategies for an element
 */
export function generateSelectorStrategies(identifier: string): string[] {
  const strategies: string[] = [];

  // Direct selector (if it looks like a valid CSS selector)
  if (
    identifier.includes('[') ||
    identifier.includes('#') ||
    identifier.includes('.') ||
    identifier.includes('>')
  ) {
    strategies.push(identifier);
  }

  // Data-testid
  strategies.push(`[data-testid="${identifier}"]`);
  strategies.push(`[data-test="${identifier}"]`);
  strategies.push(`[data-cy="${identifier}"]`);

  // ARIA label
  strategies.push(`[aria-label="${identifier}"]`);
  strategies.push(`[aria-labelledby="${identifier}"]`);

  // Name attribute
  strategies.push(`[name="${identifier}"]`);

  // ID
  if (!identifier.includes(' ')) {
    strategies.push(`#${identifier}`);
  }

  // Text content
  strategies.push(`text="${identifier}"`);
  strategies.push(`text=${identifier}`);

  // Button/link with text
  strategies.push(`button:has-text("${identifier}")`);
  strategies.push(`a:has-text("${identifier}")`);

  // Title attribute
  strategies.push(`[title="${identifier}"]`);

  // Placeholder
  strategies.push(`[placeholder="${identifier}"]`);

  return strategies;
}

/**
 * Generate selectors for common form fields
 */
export function generateFormFieldSelectors(
  fieldType: 'email' | 'password' | 'username' | 'submit'
): string[] {
  const selectors: string[] = [];

  switch (fieldType) {
    case 'email':
      selectors.push('input[type="email"]');
      selectors.push('input[name="email"]');
      selectors.push('input[id="email"]');
      selectors.push('[data-testid="email"]');
      selectors.push('[autocomplete="email"]');
      selectors.push('input[placeholder*="email" i]');
      break;

    case 'password':
      selectors.push('input[type="password"]');
      selectors.push('input[name="password"]');
      selectors.push('input[id="password"]');
      selectors.push('[data-testid="password"]');
      selectors.push('[autocomplete="current-password"]');
      selectors.push('[autocomplete="new-password"]');
      break;

    case 'username':
      selectors.push('input[name="username"]');
      selectors.push('input[id="username"]');
      selectors.push('[data-testid="username"]');
      selectors.push('[autocomplete="username"]');
      selectors.push('input[placeholder*="username" i]');
      selectors.push('input[type="text"][name*="user"]');
      break;

    case 'submit':
      selectors.push('button[type="submit"]');
      selectors.push('input[type="submit"]');
      selectors.push('button:has-text("Submit")');
      selectors.push('button:has-text("Login")');
      selectors.push('button:has-text("Sign in")');
      selectors.push('[data-testid="submit"]');
      selectors.push('[data-testid="login"]');
      break;
  }

  return selectors;
}

/**
 * Smart selector builder
 */
export class SelectorBuilder {
  private strategies: string[] = [];

  constructor(private readonly baseIdentifier: string) {
    this.strategies = generateSelectorStrategies(baseIdentifier);
  }

  /**
   * Add custom selector strategy
   */
  addStrategy(selector: string): this {
    this.strategies.unshift(selector); // Add to beginning for priority
    return this;
  }

  /**
   * Add multiple strategies
   */
  addStrategies(...selectors: string[]): this {
    this.strategies.unshift(...selectors);
    return this;
  }

  /**
   * Filter strategies by pattern
   */
  filterByPattern(pattern: RegExp): this {
    this.strategies = this.strategies.filter((s) => pattern.test(s));
    return this;
  }

  /**
   * Get all strategies
   */
  getStrategies(): string[] {
    return [...this.strategies];
  }

  /**
   * Get first strategy
   */
  getFirst(): string {
    return this.strategies[0] ?? this.baseIdentifier;
  }
}

/**
 * Create selector builder
 */
export function createSelectorBuilder(identifier: string): SelectorBuilder {
  return new SelectorBuilder(identifier);
}
