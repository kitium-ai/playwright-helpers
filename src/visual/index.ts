/**
 * Visual regression and screenshot helpers for Playwright
 * Integrates with @kitiumai/test-core/logger for structured logging
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { contextManager } from '@kitiumai/logger';
import { getTestLogger } from '@kitiumai/test-core';
import type { Locator, Page } from '@playwright/test';

export interface ScreenshotOptions {
  fullPage?: boolean;
  omitBackground?: boolean;
  mask?: Locator[];
  maskColor?: string;
}

/**
 * Visual regression helper
 */
export class VisualRegressionHelper {
  private readonly baselineDir: string;
  private readonly actualDir: string;
  private readonly logger = getTestLogger();

  constructor(baselineDir = 'visual-baselines', actualDir = 'visual-actual') {
    this.baselineDir = baselineDir;
    this.actualDir = actualDir;

    // Create directories if they don't exist
    if (!fs.existsSync(this.baselineDir)) {
      fs.mkdirSync(this.baselineDir, { recursive: true });
    }
    if (!fs.existsSync(this.actualDir)) {
      fs.mkdirSync(this.actualDir, { recursive: true });
    }
  }

  /**
   * Take screenshot for visual comparison
   */
  async compareScreenshot(
    page: Page,
    name: string,
    options: ScreenshotOptions = {}
  ): Promise<{ matches: boolean; path: string }> {
    const context = contextManager.getContext();
    const actualPath = path.join(this.actualDir, `${name}.png`);
    const baselinePath = path.join(this.baselineDir, `${name}.png`);

    this.logger.debug('Taking screenshot for visual comparison', {
      traceId: context.traceId,
      name,
      actualPath,
      baselinePath,
    });

    // Take screenshot
    await page.screenshot({
      path: actualPath,
      fullPage: options.fullPage ?? false,
      omitBackground: options.omitBackground ?? false,
      ...(options.mask ? { mask: options.mask } : {}),
      maskColor: options.maskColor ?? '#FF00FF',
    });

    // Compare with baseline if it exists
    let matches = false;
    if (fs.existsSync(baselinePath)) {
      const baseline = fs.readFileSync(baselinePath);
      const actual = fs.readFileSync(actualPath);
      matches = baseline.equals(actual);

      this.logger.info('Visual comparison completed', {
        traceId: context.traceId,
        name,
        matches,
      });
    } else {
      this.logger.warn('No baseline found for comparison', {
        traceId: context.traceId,
        name,
        baselinePath,
      });
    }

    return { matches, path: actualPath };
  }

  /**
   * Update baseline screenshot
   */
  async updateBaseline(page: Page, name: string, options: ScreenshotOptions = {}): Promise<string> {
    const context = contextManager.getContext();
    const baselinePath = path.join(this.baselineDir, `${name}.png`);

    this.logger.info('Updating baseline screenshot', {
      traceId: context.traceId,
      name,
      baselinePath,
    });

    await page.screenshot({
      path: baselinePath,
      fullPage: options.fullPage ?? false,
      omitBackground: options.omitBackground ?? false,
      ...(options.mask ? { mask: options.mask } : {}),
      maskColor: options.maskColor ?? '#FF00FF',
    });

    return baselinePath;
  }

  /**
   * Get baseline path
   */
  getBaselinePath(name: string): string {
    return path.join(this.baselineDir, `${name}.png`);
  }

  /**
   * Get actual path
   */
  getActualPath(name: string): string {
    return path.join(this.actualDir, `${name}.png`);
  }

  /**
   * Clear actual screenshots
   */
  clearActual(): void {
    if (fs.existsSync(this.actualDir)) {
      fs.rmSync(this.actualDir, { recursive: true });
      fs.mkdirSync(this.actualDir, { recursive: true });
    }
  }

  /**
   * Compare layouts of two elements
   */
  async compareLayouts(page: Page, selector1: string, selector2: string): Promise<boolean> {
    const box1 = await page.locator(selector1).boundingBox();
    const box2 = await page.locator(selector2).boundingBox();

    if (!box1 || !box2) {
      return false;
    }

    return (
      box1.x === box2.x &&
      box1.y === box2.y &&
      box1.width === box2.width &&
      box1.height === box2.height
    );
  }

  /**
   * Get element bounding box
   */
  async getElementBoundingBox(
    page: Page,
    selector: string
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return await page.locator(selector).boundingBox();
  }
}

/**
 * Create visual regression helper
 */
export function createVisualRegressionHelper(
  baselineDir?: string,
  actualDir?: string
): VisualRegressionHelper {
  return new VisualRegressionHelper(baselineDir, actualDir);
}

/**
 * Screenshot builder for fluent API
 */
export class ScreenshotBuilder {
  private readonly page: Page;
  private readonly options: ScreenshotOptions = {};

  constructor(page: Page) {
    this.page = page;
  }

  withName(_name: string): this {
    // Name is stored in options if needed for future use
    return this;
  }

  fullPage(): this {
    this.options.fullPage = true;
    return this;
  }

  omitBackground(): this {
    this.options.omitBackground = true;
    return this;
  }

  maskElements(locators: Locator[]): this {
    this.options.mask = locators;
    return this;
  }

  async take(): Promise<Buffer> {
    const screenshotOptions: Parameters<typeof this.page.screenshot>[0] = {
      maskColor: this.options.maskColor ?? '#FF00FF',
    };
    if (this.options.fullPage !== undefined) {
      screenshotOptions.fullPage = this.options.fullPage;
    }
    if (this.options.omitBackground !== undefined) {
      screenshotOptions.omitBackground = this.options.omitBackground;
    }
    if (this.options.mask) {
      screenshotOptions.mask = this.options.mask;
    }
    const buffer = await this.page.screenshot(screenshotOptions);
    return buffer;
  }

  async saveAs(filePath: string): Promise<void> {
    const buffer = await this.take();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
  }
}

/**
 * Create screenshot builder
 */
export function createScreenshotBuilder(page: Page): ScreenshotBuilder {
  return new ScreenshotBuilder(page);
}

/**
 * Get pixel color at position
 */
export async function getPixelColor(page: Page, x: number, y: number): Promise<string> {
  const color = await page.evaluate(
    ({ x: px, y: py }) => {
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        return 'rgba(0,0,0,0)';
      }
      const imageData = context.getImageData(px, py, 1, 1);
      const [r, g, b, a] = imageData.data;
      return `rgba(${r},${g},${b},${a})`;
    },
    { x, y }
  );
  return color;
}

/**
 * Assert element is in viewport
 */
export async function assertInViewport(locator: Locator): Promise<void> {
  const isInViewport = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  });

  if (!isInViewport) {
    throw new Error('Element is not in viewport');
  }
}

/**
 * Measure element dimensions
 */
export async function measureElement(locator: Locator): Promise<{ width: number; height: number }> {
  const dimensions = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  });

  return dimensions;
}

/**
 * Get computed styles
 */
export async function getComputedStyles(locator: Locator): Promise<Record<string, string>> {
  const styles = await locator.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity,
      position: computed.position,
      zIndex: computed.zIndex,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
    };
  });

  return styles;
}
