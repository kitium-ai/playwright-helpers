/**
 * Network and API mocking helpers for Playwright
 * Integrates with @kitiumai/logger for structured logging
 */

import { contextManager, createLogger } from '@kitiumai/logger';
import { type Page, type Route } from '@playwright/test';

const headerContentType = 'Content-Type';
const headerTestLatency = 'X-Test-Latency';

type GraphqlMockTools = {
  addMocksToSchema: (options: { schema: unknown; mocks?: Record<string, unknown> }) => unknown;
  makeExecutableSchema: (options: { typeDefs: string }) => unknown;
};

type GraphqlModule = {
  graphql: (options: {
    schema: unknown;
    source: string;
    variableValues?: Record<string, unknown>;
  }) => Promise<unknown>;
};

type GraphqlRequestBody = {
  query: string;
  variables?: Record<string, unknown>;
};

export type MockResponse = {
  status?: number;
  headers?: Record<string, string>;
  body: string | Record<string, unknown> | ((requestBody: unknown) => Promise<unknown>);
};

/**
 * Network mock manager
 */
export class NetworkMockManager {
  private readonly routes: Map<string, MockResponse> = new Map();
  private interceptedRequests: Array<{ url: string; method: string; body?: string }> = [];
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

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
  mockGet(urlPattern: string | RegExp, response: Record<string, unknown> | string): void {
    const mockResponse: MockResponse = {
      status: 200,
      headers: { [headerContentType]: 'application/json' },
      body: response,
    };
    this.registerRoute(urlPattern, mockResponse);
  }

  /**
   * Mock POST request
   */
  mockPost(urlPattern: string | RegExp, response: Record<string, unknown> | string): void {
    const mockResponse: MockResponse = {
      status: 200,
      headers: { [headerContentType]: 'application/json' },
      body: response,
    };
    this.registerRoute(urlPattern, mockResponse);
  }

  /**
   * Mock GraphQL endpoint
   */
  mockGraphQL(urlPattern: string | RegExp, schema: string, mocks?: Record<string, unknown>): void {
    const context = contextManager.getContext();
    const key = typeof urlPattern === 'string' ? urlPattern : urlPattern.source;

    this.routes.set(key, {
      status: 200,
      headers: { [headerContentType]: 'application/json' },
      body: async (requestBody: unknown) => {
        const parsed = requestBody as GraphqlRequestBody;
        try {
          const graphqlToolsModule = '@graphql-tools/mock';
          const graphqlModule = 'graphql';
          const tools = (await import(graphqlToolsModule)) as unknown as GraphqlMockTools;
          const graphql = (await import(graphqlModule)) as unknown as GraphqlModule;

          const executableSchema = tools.makeExecutableSchema({ typeDefs: schema });
          const schemaWithMocks = tools.addMocksToSchema({
            schema: executableSchema,
            mocks: mocks ?? {},
          });
          const graphqlOptions: Parameters<GraphqlModule['graphql']>[0] = {
            schema: schemaWithMocks,
            source: parsed.query,
          };
          if (parsed.variables !== undefined) {
            graphqlOptions.variableValues = parsed.variables;
          }
          return await graphql.graphql(graphqlOptions);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { errors: [{ message: `GraphQL mocking not available: ${message}` }] };
        }
      },
    });

    this.logger.debug('GraphQL mock registered', {
      traceId: context.traceId,
      urlPattern: key,
    });
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
        let responseBody: unknown = response.body;
        if (typeof response.body === 'function') {
          const requestBody = (() => {
            const requestPostData = request.postData();
            if (!requestPostData) {
              return;
            }
            try {
              return JSON.parse(requestPostData) as unknown;
            } catch {
              return requestPostData;
            }
          })();
          responseBody = await response.body(requestBody);
        }
        const body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
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
    return this.interceptedRequests.filter((request) => regex.test(request.url));
  }

  /**
   * Get requests by method
   */
  getRequestsByMethod(method: string): Array<{ url: string; method: string; body?: string }> {
    return this.interceptedRequests.filter((request) => request.method === method.toUpperCase());
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

  /**
   * Mock error response for a given URL pattern
   */
  mockError(urlPattern: string | RegExp, status: number, message: string): void {
    const key = typeof urlPattern === 'string' ? urlPattern : urlPattern.source;
    this.routes.set(key, {
      status,
      headers: { [headerContentType]: 'application/json' },
      body: { error: message },
    });
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
    [headerTestLatency]: String(latencyMs),
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

  mockEndpoint(
    _method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    response: Record<string, unknown>
  ): this {
    const pattern = new RegExp(path);
    const mockResponse: MockResponse = {
      status: 200,
      headers: { [headerContentType]: 'application/json' },
      body: response,
    };
    this.manager.registerRoute(pattern, mockResponse);
    return this;
  }

  mockError(path: string, status: number, message: string): this {
    const pattern = new RegExp(path);
    this.manager.mockError(pattern, status, message);
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
