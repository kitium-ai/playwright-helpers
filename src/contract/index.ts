/**
 * API contract testing utilities
 * OpenAPI/Swagger validation and schema checking
 */

import type { Page } from '@playwright/test';
import { contextManager } from '@kitiumai/logger';
import { getTestLogger } from '@kitiumai/test-core';

export interface ContractValidationResult {
  passed: boolean;
  violations: ContractViolation[];
  warnings: ContractWarning[];
}

export interface ContractViolation {
  type: 'request' | 'response' | 'schema';
  severity: 'error' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

export interface ContractWarning {
  type: string;
  message: string;
  recommendation?: string;
}

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  paths: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

/**
 * Contract validator for API testing
 */
export class ContractValidator {
  private readonly logger = getTestLogger();
  private spec: OpenAPISpec | null = null;

  /**
   * Load OpenAPI specification
   */
  async loadSpec(specPathOrUrl: string): Promise<void> {
    const context = contextManager.getContext();
    this.logger.debug('Loading OpenAPI specification', {
      traceId: context.traceId,
      specPath: specPathOrUrl,
    });

    try {
      // Try to load from URL or file
      const response = await fetch(specPathOrUrl);
      if (!response.ok) {
        throw new Error(`Failed to load OpenAPI spec: ${response.statusText}`);
      }

      this.spec = (await response.json()) as OpenAPISpec;
      this.logger.info('OpenAPI specification loaded', {
        traceId: context.traceId,
        openapiVersion: this.spec.openapi ?? this.spec.swagger,
        pathCount: Object.keys(this.spec.paths ?? {}).length,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to load OpenAPI specification', {
        traceId: context.traceId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Validate request against contract
   */
  async validateRequest(
    method: string,
    path: string,
    requestBody?: unknown,
    headers?: Record<string, string>
  ): Promise<ContractValidationResult> {
    const context = contextManager.getContext();
    const violations: ContractViolation[] = [];
    const warnings: ContractWarning[] = [];

    if (!this.spec) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: 'OpenAPI specification not loaded',
      });
      return { passed: false, violations, warnings };
    }

    this.logger.debug('Validating request against contract', {
      traceId: context.traceId,
      method,
      path,
    });

    // Find matching path in spec
    const specPath = this.findMatchingPath(path);
    if (!specPath) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: `Path not found in OpenAPI spec: ${path}`,
        details: { method, path },
      });
      return { passed: false, violations, warnings };
    }

    const pathSpec = this.spec.paths[specPath];
    if (!pathSpec) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: `Path specification not found: ${specPath}`,
      });
      return { passed: false, violations, warnings };
    }
    const methodSpec = (pathSpec as Record<string, unknown>)[method.toLowerCase()] as
      | Record<string, unknown>
      | undefined;

    if (!methodSpec) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: `Method ${method} not allowed for path: ${path}`,
        details: { method, path, allowedMethods: pathSpec ? Object.keys(pathSpec) : [] },
      });
      return { passed: false, violations, warnings };
    }

    // Validate request body schema if present
    if (requestBody && methodSpec?.['requestBody']) {
      const bodySpec = (methodSpec['requestBody'] as { content?: Record<string, unknown> }).content;
      if (bodySpec) {
        // Basic schema validation (simplified - in production, use ajv or similar)
        const contentType = headers?.['content-type'] ?? 'application/json';
        const contentSpec = bodySpec[contentType];

        if (!contentSpec) {
          violations.push({
            type: 'request',
            severity: 'error',
            message: `Content-Type ${contentType} not supported for this endpoint`,
            details: { method, path, contentType, supportedTypes: Object.keys(bodySpec) },
          });
        }
      }
    }

    // Validate required headers
    const requiredHeaders = (
      methodSpec?.['parameters'] as
        | Array<{ in: string; name: string; required?: boolean }>
        | undefined
    )
      ?.filter((p) => p.in === 'header' && p.required)
      .map((p) => p.name);

    if (requiredHeaders && requiredHeaders.length > 0) {
      for (const header of requiredHeaders) {
        if (!headers?.[header.toLowerCase()]) {
          violations.push({
            type: 'request',
            severity: 'error',
            message: `Required header missing: ${header}`,
            details: { method, path, header },
          });
        }
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate response against contract
   */
  async validateResponse(
    method: string,
    path: string,
    statusCode: number,
    _responseBody?: unknown,
    _headers?: Record<string, string>
  ): Promise<ContractValidationResult> {
    const context = contextManager.getContext();
    const violations: ContractViolation[] = [];
    const warnings: ContractWarning[] = [];

    if (!this.spec) {
      violations.push({
        type: 'response',
        severity: 'error',
        message: 'OpenAPI specification not loaded',
      });
      return { passed: false, violations, warnings };
    }

    this.logger.debug('Validating response against contract', {
      traceId: context.traceId,
      method,
      path,
      statusCode,
    });

    const specPath = this.findMatchingPath(path);
    if (!specPath) {
      violations.push({
        type: 'response',
        severity: 'error',
        message: `Path not found in OpenAPI spec: ${path}`,
      });
      return { passed: false, violations, warnings };
    }

    const pathSpec = this.spec.paths[specPath];
    if (!pathSpec) {
      violations.push({
        type: 'response',
        severity: 'error',
        message: `Path specification not found: ${specPath}`,
      });
      return { passed: false, violations, warnings };
    }
    const methodSpec = pathSpec[method.toLowerCase()] as Record<string, unknown> | undefined;

    if (!methodSpec) {
      violations.push({
        type: 'response',
        severity: 'error',
        message: `Method ${method} not found in spec`,
      });
      return { passed: false, violations, warnings };
    }

    // Check if status code is defined in responses
    const responses = methodSpec?.['responses'] as Record<string, unknown> | undefined;
    if (responses) {
      const statusKey = String(statusCode);
      const statusRange = `${Math.floor(statusCode / 100)}xx`;

      if (!responses[statusKey] && !responses[statusRange] && !responses['default']) {
        warnings.push({
          type: 'unexpected-status-code',
          message: `Status code ${statusCode} not defined in OpenAPI spec`,
          recommendation: 'Add this status code to the API specification',
        });
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Find matching path in OpenAPI spec (handles path parameters)
   */
  private findMatchingPath(path: string): string | null {
    if (!this.spec) {
      return null;
    }

    // Exact match
    if (this.spec.paths[path]) {
      return path;
    }

    // Try to match with path parameters
    for (const specPath of Object.keys(this.spec.paths)) {
      const pattern = specPath.replace(/\{[^}]+\}/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        return specPath;
      }
    }

    return null;
  }

  /**
   * Record API request for contract validation
   */
  async recordRequest(
    method: string,
    path: string,
    requestBody?: unknown,
    responseStatus?: number,
    responseBody?: unknown
  ): Promise<ContractValidationResult> {
    const context = contextManager.getContext();
    this.logger.info('Recording API request for contract validation', {
      traceId: context.traceId,
      method,
      path,
      responseStatus,
    });

    const requestResult = await this.validateRequest(method, path, requestBody);
    const responseResult = responseStatus
      ? await this.validateResponse(method, path, responseStatus, responseBody)
      : { passed: true, violations: [], warnings: [] };

    return {
      passed: requestResult.passed && responseResult.passed,
      violations: [...requestResult.violations, ...responseResult.violations],
      warnings: [...requestResult.warnings, ...responseResult.warnings],
    };
  }
}

/**
 * Setup API contract validation for a page
 */
export async function setupContractValidation(
  page: Page,
  specPathOrUrl: string
): Promise<ContractValidator> {
  const validator = new ContractValidator();
  await validator.loadSpec(specPathOrUrl);

  const context = contextManager.getContext();
  const logger = getTestLogger();

  // Intercept API requests and validate
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    try {
      const requestBody = request.postData() ? JSON.parse(request.postData() ?? '{}') : undefined;
      const headers = request.headers();

      const result = await validator.validateRequest(method, path, requestBody, headers);

      if (!result.passed) {
        logger.warn('API contract violation detected', {
          traceId: context.traceId,
          method,
          path,
          violations: result.violations,
        });
      }

      await route.continue();
    } catch (error) {
      logger.error('Error validating API contract', {
        traceId: context.traceId,
        method,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      await route.continue();
    }
  });

  logger.info('API contract validation setup complete', {
    traceId: context.traceId,
    specPath: specPathOrUrl,
  });

  return validator;
}

/**
 * Create contract validator
 */
export function createContractValidator(): ContractValidator {
  return new ContractValidator();
}
