import { contextManager } from '@kitiumai/logger';
import { getTestLogger } from '@kitiumai/test-core';
import { type BrowserContext, type Page, test as base, type TestInfo } from '@playwright/test';

import { AccessibilityChecker } from '../accessibility';
import { LoginFlow } from '../flows';
import { createNetworkMockManager, type NetworkMockManager } from '../network';
import { getTraceManager } from '../tracing';

export interface ConsoleLogCapture {
  type: string;
  text: string;
  args: string[];
  traceId?: string;
  requestId?: string;
  timestamp: number;
}

export interface ArtifactCollector {
  recordScreenshot(label?: string): Promise<string>;
  recordHtml(label?: string): Promise<string>;
  getArtifacts(): string[];
}

export interface CoreFixtures {
  context: BrowserContext;
  page: Page;
  mockManager: NetworkMockManager;
  loginFlow: LoginFlow;
  accessibility: AccessibilityChecker;
  consoleLogs: ConsoleLogCapture[];
  traceSessionId: string;
  artifactCollector: ArtifactCollector;
  storageStatePath?: string;
}

function createArtifactCollector(
  page: Page,
  testInfo: TestInfo,
  traceId: string
): ArtifactCollector {
  const artifacts: string[] = [];

  const toPath = (suffix: string, extension: string): string => {
    const safeTitle = testInfo.title.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    return `test-results/${safeTitle}-${suffix}-${Date.now()}.${extension}`;
  };

  return {
    async recordScreenshot(label = 'screenshot') {
      const path = toPath(label, 'png');
      await page.screenshot({ path, fullPage: true });
      artifacts.push(path + `?traceId=${traceId}`);
      return path;
    },
    async recordHtml(label = 'page') {
      const path = toPath(label, 'html');
      const content = await page.content();
      await testInfo.attach(`${label}.html`, { body: content, contentType: 'text/html' });
      artifacts.push(path + `?traceId=${traceId}`);
      return path;
    },
    getArtifacts() {
      return artifacts;
    },
  };
}

export const coreTest = base.extend<CoreFixtures>({
  mockManager: async ({ page }, use) => {
    const manager = createNetworkMockManager();
    await manager.setupRouteInterception(page);
    await use(manager);
    manager.clearMocks();
  },
  loginFlow: async ({ page, baseURL }, use) => {
    const flow = new LoginFlow(page, { baseUrl: baseURL ?? 'http://localhost:3000' });
    await use(flow);
  },
  accessibility: async ({}, use) => {
    await use(new AccessibilityChecker());
  },
  consoleLogs: async ({ page }, use) => {
    const logs: ConsoleLogCapture[] = [];
    const logger = getTestLogger();
    page.on('console', (message) => {
      const context = contextManager.getContext();
      const entry: ConsoleLogCapture = {
        type: message.type(),
        text: message.text(),
        args: message.args().map((a) => a.toString()),
        traceId: context.traceId,
        requestId: context.requestId ?? 'unknown',
        timestamp: Date.now(),
      };
      logs.push(entry);
      logger.debug('Captured console message', entry);
    });

    await use(logs);
  },
  traceSessionId: async (_fixtures, use, testInfo) => {
    const traceManager = getTraceManager();
    const spanId = traceManager.startSpan(`test:${testInfo.title}`, {
      'test.file': testInfo.file,
      'test.project': testInfo.project.name,
    });
    await use(spanId);
    const status = testInfo.status === 'passed' ? 'ok' : 'error';
    if (testInfo.error) {
      traceManager.endSpan(spanId, status, testInfo.error as Error);
    } else {
      traceManager.endSpan(spanId, status);
    }
  },
  artifactCollector: async ({ page, traceSessionId }, use, testInfo) => {
    const collector = createArtifactCollector(page, testInfo, traceSessionId);
    await use(collector);
  },
  storageStatePath: async ({ context }, use, testInfo) => {
    const path = `test-results/storage-${testInfo.project.name}-${Date.now()}.json`;
    await use(path);
    await context.storageState({ path });
  },
});

export type CoreTest = typeof coreTest;

export async function scaffoldFixtureUsage(): Promise<string> {
  return `import { coreTest as test } from '@kitiumai/playwright-helpers/setup/fixtures';

 test('example with core fixtures', async ({ page, loginFlow, mockManager, consoleLogs, artifactCollector }) => {
   mockManager.mockGet('/api/profile', { name: 'Ada Lovelace' });
   await loginFlow.login({ email: 'demo@example.com', password: 'hunter2' });
   await page.getByRole('heading', { name: /welcome/i }).waitFor();
   await artifactCollector.recordScreenshot('home');
   consoleLogs.forEach((entry) => console.log(entry));
 });
`;
}
