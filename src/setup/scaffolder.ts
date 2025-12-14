import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { scaffoldFixtureUsage } from './fixtures';

export type ScaffoldKind = 'test' | 'page' | 'flow';

export type ScaffoldOptions = {
  destination: string;
  name: string;
  kind: ScaffoldKind;
};

const templates: Record<ScaffoldKind, (name: string) => Promise<string> | string> = {
  test: async () => scaffoldFixtureUsage(),
  page: (name: string) => `import { BasePage } from '@kitiumai/playwright-helpers/page-objects';

export class ${name}Page extends BasePage {
  async open() {
    await this.goto('/${name.toLowerCase()}');
  }
}
`,
  flow: (name: string) => `import { LoginFlow } from '@kitiumai/playwright-helpers/flows';

export class ${name}Flow extends LoginFlow {
  // Extend login flow with additional steps
}
`,
};

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function scaffoldPlaywrightAsset(options: ScaffoldOptions): Promise<string> {
  const { destination, name, kind } = options;
  const dir = path.resolve(destination);
  await ensureDirectory(dir);

  const filename = kind === 'test' ? `${name}.spec.ts` : `${name}.${kind}.ts`;
  const filePath = path.join(dir, filename);
  const template = templates[kind];
  const content = typeof template === 'function' ? await template(name) : '';

  await fs.writeFile(filePath, content, { encoding: 'utf-8' });
  return filePath;
}
