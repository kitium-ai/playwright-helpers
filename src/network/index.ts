/**
 * Network and API mocking helpers for Playwright
 * Integrates with @kitiumai/logger for structured logging
 */

import { type Page, type Route } from '@playwright/test';
import { getLogger, contextManager } from '@kitiumai/logger';

export interface MockResponse {
  status?: number;
  headers?: Record<string, string>;
  body: string | object;
}

/**
 * Network mock manager
 */
export class NetworkMockManager {
  private readonly routes: Map<string, MockResponse> = new Map();
  private interceptedRequests: Array<{ url: string; method: string; body?: string }> = [];
  private readonly logger = getLogger();

  /**
   * Register a route mock
   */
  registerRoute(urlPattern: string | RegExp, response: MockResponse): void {
    const context = contextManager.getContext();
    const key = typeof urlPattern === 'string' ? urlPattern : urlPattern.source;
    this.routes.set(key, response);

    this.logger.debug('Route mock registered', {
      traceId: context.traceId,
      urlPattern: key,
      status: response.status,
    });
  }

  /**
   * Mock GET request
   */
  mockGet(urlPattern: string | RegExp, response: object | string): void {
    const mockResponse: MockResponse = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response,
    };
    this.registerRoute(urlPattern, mockResponse);
  }

  /**
   * Mock POST request
   */
  mockPost(urlPattern: string | RegExp, response: object | string): void {
    const mockResponse: MockResponse = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response,
    };
    this.registerRoute(urlPattern, mockResponse);
  }

  /**
   * Mock error response
   */
  mockError(urlPattern: string | RegExp, status: number, message: string): void {
    const mockResponse: MockResponse = {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { error: message },
    };
    this.registerRoute(urlPattern, mockResponse);
  }

  /**
   * Setup route interception on page
   */
  async setupRouteInterception(page: Page): Promise<void> {
    await page.route('**/*', (route) => this.handleRoute(route));
  }

  /**
   * Handle route and return mock or continue
   */
  private async handleRoute(route: Route): Promise<void> {
    const url = route.request().url();
    const request = route.request();

    // Record request
    const postData = request.postData();
    const requestRecord: { url: string; method: string; body?: string } = {
      url,
      method: request.method(),
    };
    if (postData) {
      requestRecord.body = postData;
    }
    this.interceptedRequests.push(requestRecord);

    // Check if URL matches any mock
    for (const [pattern, response] of this.routes) {
      const patternRegex = new RegExp(pattern);
      if (patternRegex.test(url)) {
        const body =
          typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
        const fulfillOptions: {
          status: number;
          headers?: Record<string, string>;
          body: string;
        } = {
          status: response.status ?? 200,
          body,
        };
        if (response.headers) {
          fulfillOptions.headers = response.headers;
        }
        await route.fulfill(fulfillOptions);
        return;
      }
    }

    // Continue with actual request if no mock found
    await route.continue();
  }

  /**
   * Get intercepted requests
   */
  getInterceptedRequests(): Array<{ url: string; method: string; body?: string }> {
    return [...this.interceptedRequests];
  }

  /**
   * Get requests by URL pattern
   */
  getRequestsByUrl(
    pattern: string | RegExp
  ): Array<{ url: string; method: string; body?: string }> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.interceptedRequests.filter((req) => regex.test(req.url));
  }

  /**
   * Get requests by method
   */
  getRequestsByMethod(method: string): Array<{ url: string; method: string; body?: string }> {
    return this.interceptedRequests.filter((req) => req.method === method.toUpperCase());
  }

  /**
   * Clear recorded requests
   */
  clearRequests(): void {
    this.interceptedRequests = [];
  }

  /**
   * Clear all mocks
   */
  clearMocks(): void {
    this.routes.clear();
    this.interceptedRequests = [];
  }
}

/**
 * Create network mock manager
 */
export function createNetworkMockManager(): NetworkMockManager {
  return new NetworkMockManager();
}

/**
 * Wait for network request
 */
export async function waitForRequest(page: Page, urlPattern: string | RegExp): Promise<string> {
  const response = await page.waitForResponse((resp) => {
    const url = resp.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });

  return await response.text();
}

/**
 * Wait for network response
 */
export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<{ status: number; body: string }> {
  const response = await page.waitForResponse((resp) => {
    const url = resp.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });

  return {
    status: response.status(),
    body: await response.text(),
  };
}

/**
 * Monitor network activity
 */
export async function monitorNetworkActivity(
  page: Page,
  action: () => Promise<void>
): Promise<{ requests: string[]; responses: number[] }> {
  const requests: string[] = [];
  const responses: number[] = [];

  page.on('request', (request) => {
    requests.push(request.url());
  });

  page.on('response', (response) => {
    responses.push(response.status());
  });

  await action();

  return { requests, responses };
}

/**
 * Abort network requests
 */
export async function abortRequests(page: Page, urlPattern: string | RegExp): Promise<void> {
  await page.route(urlPattern, (route) => route.abort());
}

/**
 * Slow down network
 */
export async function slowDownNetwork(page: Page, latencyMs: number): Promise<void> {
  const context = page.context();
  await context.setExtraHTTPHeaders({
    'X-Test-Latency': String(latencyMs),
  });
}

/**
 * Mock API with predefined responses
 */
export class ApiMockBuilder {
  private readonly manager: NetworkMockManager;

  constructor(_page?: Page) {
    this.manager = createNetworkMockManager();
  }

  mockEndpoint(_method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, response: object): this {
    const pattern = new RegExp(path);
    const mockResponse: MockResponse = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response,
    };
    this.manager.registerRoute(pattern, mockResponse);
    return this;
  }

  mockError(path: string, status: number, message: string): this {
    this.manager.mockError(path, status, message);
    return this;
  }

  getManager(): NetworkMockManager {
    return this.manager;
  }
}

/**
 * Create API mock builder
 */
export function createApiMockBuilder(): ApiMockBuilder {
  return new ApiMockBuilder();
}
