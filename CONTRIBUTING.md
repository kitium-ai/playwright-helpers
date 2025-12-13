# Contributing to @kitiumai/playwright-helpers

Thank you for your interest in contributing to `@kitiumai/playwright-helpers`! This guide will help you get started.

## 🎯 Before You Start

1. **Read the main [CONTRIBUTING.md](../../../../CONTRIBUTING.md)** - Understand the monorepo workflow
2. **Check existing issues** - Avoid duplicating work
3. **Ask questions** - Open a discussion if you're unsure
4. **Setup your environment** - Follow the development setup below

## 🚀 Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd KitiumAI
pnpm install
```

### 2. Navigate to Package

```bash
cd packages/utils/@kitiumai/playwright-helpers
```

### 3. Install Dependencies

```bash
pnpm install
```

## 💻 Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### Building

```bash
# Build the package
pnpm build

# Clean and rebuild
pnpm build:clean

# Watch mode for development
pnpm watch
```

### Linting and Type Checking

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm typecheck

# Format code
pnpm format:fix
```

### Running Playwright Tests

```bash
# Run Playwright tests
pnpm playwright test

# Run with UI mode
pnpm playwright test --ui

# Run specific test file
pnpm playwright test tests/example.spec.ts

# Debug tests
pnpm playwright test --debug
```

## 📝 Code Standards

### TypeScript

- **Strict typing** - No `any` types unless absolutely necessary
- **Proper error handling** - Use try-catch and proper error types
- **Meaningful names** - Self-documenting code
- **Comments for complex logic** - Explain the "why"

### Playwright-Specific Guidelines

#### Page Object Model (POM)

Use the Page Object Model pattern for better maintainability:

```typescript
// Good - Page Object
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async getErrorMessage() {
    return this.page.textContent('[data-testid="error-message"]');
  }
}

// Usage in test
test('login with invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('invalid@email.com', 'wrong');
  expect(await loginPage.getErrorMessage()).toContain('Invalid credentials');
});
```

#### Selectors Best Practices

```typescript
// Good - Use data-testid
await page.click('[data-testid="submit-button"]');

// Good - Use role-based selectors
await page.click('button:has-text("Submit")');

// Avoid - Fragile CSS selectors
await page.click('.btn.btn-primary.submit-btn');

// Avoid - XPath when possible
await page.click('//button[@class="submit"]');
```

#### Waiting and Assertions

```typescript
// Good - Explicit waits
await page.waitForSelector('[data-testid="results"]');
await expect(page.locator('[data-testid="results"]')).toBeVisible();

// Good - Auto-waiting with Playwright assertions
await expect(page.locator('[data-testid="message"]')).toHaveText('Success');

// Avoid - Arbitrary timeouts
await page.waitForTimeout(5000);
```

#### Test Isolation

```typescript
// Good - Each test is independent
test('test 1', async ({ page }) => {
  await page.goto('/');
  // Test logic
});

test('test 2', async ({ page }) => {
  await page.goto('/');
  // Different test logic
});

// Avoid - Tests depending on each other
let sharedState: any;
test('test 1', async ({ page }) => {
  sharedState = await page.evaluate(() => /* ... */);
});
test('test 2', async ({ page }) => {
  // Uses sharedState - BAD!
});
```

### Naming Conventions

- **Test files:** `*.spec.ts` or `*.test.ts`
- **Page objects:** `{page-name}.page.ts`
- **Fixtures:** `{fixture-name}.fixture.ts`
- **Helpers:** `{helper-name}.helper.ts`

## 🧪 Testing Requirements

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup for each test
    await page.goto('/');
  });

  test('should do something specific', async ({ page }) => {
    // Arrange
    const button = page.locator('[data-testid="submit"]');

    // Act
    await button.click();

    // Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });

  test('should handle error case', async ({ page }) => {
    // Test error scenario
  });
});
```

### Coverage Requirements

- **Minimum coverage:** 80% for new code
- **All public APIs:** Must have tests
- **Edge cases:** Test boundary conditions and error scenarios
- **Visual regression:** Add screenshots for UI changes

### Visual Testing

```typescript
test('visual regression test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

## 📦 Adding Features

### Adding a New Helper

1. Create the helper file in `src/helpers/`
2. Export from `src/index.ts`
3. Add tests in `tests/`
4. Update documentation

Example:

```typescript
// src/helpers/my-helper.ts
export async function myHelper(page: Page, options: MyOptions) {
  // Implementation
}

// src/index.ts
export * from './helpers/my-helper';

// tests/my-helper.spec.ts
import { test, expect } from '@playwright/test';
import { myHelper } from '../src/helpers/my-helper';

test('myHelper should work', async ({ page }) => {
  // Test implementation
});
```

### Adding a New Fixture

```typescript
// src/fixtures/my-fixture.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  myFixture: async ({ page }, use) => {
    // Setup
    const fixture = await setupMyFixture(page);

    // Use
    await use(fixture);

    // Teardown
    await fixture.cleanup();
  },
});
```

## 🔄 Git Workflow

### Commit Messages

Follow conventional commits:

```
feat(helpers): add visual regression helper
fix(fixtures): resolve memory leak in cleanup
docs(readme): update installation instructions
test(helpers): add tests for navigation helper
```

### Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feat/add-visual-helper
   ```

2. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

3. **Run quality checks**

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

4. **Commit and push**

   ```bash
   git add .
   git commit -m "feat(helpers): add visual regression helper"
   git push origin feat/add-visual-helper
   ```

5. **Create Pull Request**
   - Fill out the PR template
   - Link related issues
   - Request review

## 📋 Pull Request Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Code lints (`pnpm lint`)
- [ ] Types check (`pnpm typecheck`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Tests added for new features
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages follow conventions

## 🐛 Bug Reports

When reporting a bug, include:

```markdown
## Description

Brief description of the bug

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- Node version:
- Playwright version:
- OS:
- Browser:

## Screenshots/Videos

If applicable

## Additional Context

Any other details
```

## 💡 Feature Requests

When requesting a feature:

```markdown
## Feature Description

What feature would you like?

## Use Case

Why is this feature needed?

## Proposed Solution

How should it work?

## Alternatives Considered

Other approaches you've thought about

## Additional Context

Any other details
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Main CONTRIBUTING.md](../../../../CONTRIBUTING.md)
- [Package README](./README.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## ❓ Questions?

- Check the [README](./README.md)
- Look at [existing issues](../../issues)
- Create a discussion
- Reach out to maintainers

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to @kitiumai/playwright-helpers!** 🙏
