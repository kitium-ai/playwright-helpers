import * as fs from 'node:fs';

import { contextManager } from '@kitiumai/logger';
import { getPlaywrightLogger } from '../internal/logger';

import type { TestExecution } from './index';

export interface QualityThresholds {
  minimumAccessibilityCoverage: number;
  maximumAverageRetry: number;
  maximumFlakeRate: number;
  maximumDurationMs: number;
}

export interface QualityMetrics {
  accessibilityCoverage: number;
  averageRetries: number;
  flakeRate: number;
  averageDurationMs: number;
  executions: TestExecution[];
}

const defaultThresholds: QualityThresholds = {
  minimumAccessibilityCoverage: 0.8,
  maximumAverageRetry: 1,
  maximumFlakeRate: 0.1,
  maximumDurationMs: 45000,
};

export function scoreQuality(
  metrics: QualityMetrics,
  thresholds: QualityThresholds = defaultThresholds
): string[] {
  const violations: string[] = [];
  if (metrics.accessibilityCoverage < thresholds.minimumAccessibilityCoverage) {
    violations.push(
      `Accessibility coverage ${metrics.accessibilityCoverage * 100}% below target ${thresholds.minimumAccessibilityCoverage * 100}%`
    );
  }

  if (metrics.averageRetries > thresholds.maximumAverageRetry) {
    violations.push(
      `Average retry count ${metrics.averageRetries} exceeds ${thresholds.maximumAverageRetry}`
    );
  }

  if (metrics.flakeRate > thresholds.maximumFlakeRate) {
    violations.push(
      `Flake rate ${metrics.flakeRate * 100}% exceeds ${thresholds.maximumFlakeRate * 100}%`
    );
  }

  if (metrics.averageDurationMs > thresholds.maximumDurationMs) {
    violations.push(
      `Average duration ${metrics.averageDurationMs}ms exceeds ${thresholds.maximumDurationMs}ms`
    );
  }

  return violations;
}

export function summarizeExecutions(executions: TestExecution[]): QualityMetrics {
  const total = executions.length || 1;
  const failed = executions.filter((e) => e.status === 'failed').length;
  const flaky = executions.filter((e) => e.status === 'flaky').length;
  const retries =
    executions.reduce((sum, e) => sum + ((e.metadata?.['retries'] as number | undefined) ?? 0), 0) /
    total;
  const averageDuration = executions.reduce((sum, e) => sum + e.duration, 0) / total;

  return {
    accessibilityCoverage: 1 - failed / total,
    averageRetries: retries,
    flakeRate: flaky / total,
    averageDurationMs: averageDuration,
    executions,
  };
}

export async function runQualityGate(
  metricsPath = 'test-results/quality-metrics.json',
  thresholds: QualityThresholds = defaultThresholds
): Promise<void> {
  const logger = getPlaywrightLogger();
  const context = contextManager.getContext();
  const parsed: QualityMetrics = fs.existsSync(metricsPath)
    ? (JSON.parse(fs.readFileSync(metricsPath, 'utf-8')) as QualityMetrics)
    : summarizeExecutions([]);

  const violations = scoreQuality(parsed, thresholds);
  if (violations.length > 0) {
    violations.forEach((violation) =>
      logger.error('Test quality violation', { traceId: context.traceId, violation })
    );
    throw new Error(`Test quality gate failed: ${violations.join('; ')}`);
  }

  logger.info('Test quality gate passed', {
    traceId: context.traceId,
    accessibilityCoverage: parsed.accessibilityCoverage,
    flakeRate: parsed.flakeRate,
    averageDurationMs: parsed.averageDurationMs,
  });
}
