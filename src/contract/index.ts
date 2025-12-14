/**
 * API contract testing utilities
 * OpenAPI/Swagger validation and schema checking
 */

import { contextManager, createLogger } from '@kitiumai/logger';
import {
  createNetworkMockManager,
  type NetworkMockManager,
} from '@kitiumai/playwright-helpers/network';
import ajv from 'ajv';

import type { Page } from '@playwright/test';

const headerContentType = 'Content-Type';
const headerContractBacked = 'x-contract-backed';

const getTraceId = (): string => contextManager.getContext().traceId;
const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

export type ContractValidationResult = {
  passed: boolean;
  violations: ContractViolation[];
  warnings: ContractWarning[];
};

export type ContractViolation = {
  type: 'request' | 'response' | 'schema';
  severity: 'error' | 'warning';
  message: string;
  details?: Record<string, unknown>;
};

export type ContractWarning = {
  type: string;
  message: string;
  recommendation?: string;
};

export type OpenAPISpec = {
  openapi?: string;
  swagger?: string;
  paths: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

export type ContractedRouteOptions = {
  method: string;
  path: string;
  status?: number;
  fixture?: unknown;
  schema?: Record<string, unknown>;
  jsonSchema?: Record<string, unknown>; // Add JSON Schema support
};

/**
 * Contract validator for API testing
 */
export class ContractValidator {
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });
  private spec: OpenAPISpec | null = null;

  private getMethodSpec(options: {
    method: string;
    path: string;
  }):
    | { kind: 'ok'; specPath: string; methodSpec: Record<string, unknown> }
    | { kind: 'error'; result: ContractValidationResult } {
    const violations: ContractViolation[] = [];
    const warnings: ContractWarning[] = [];

    if (!this.spec) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: 'OpenAPI specification not loaded',
      });
      return { kind: 'error', result: { passed: false, violations, warnings } };
    }

    const specPath = this.findMatchingPath(options.path);
    if (!specPath) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: `Path not found in OpenAPI spec: ${options.path}`,
        details: { method: options.method, path: options.path },
      });
      return { kind: 'error', result: { passed: false, violations, warnings } };
    }

    const pathSpec = this.spec.paths[specPath];
    if (!pathSpec) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: `Path specification not found: ${specPath}`,
      });
      return { kind: 'error', result: { passed: false, violations, warnings } };
    }

    const methodSpec = (pathSpec as Record<string, unknown>)[options.method.toLowerCase()] as
      | Record<string, unknown>
      | undefined;
    if (!methodSpec) {
      violations.push({
        type: 'request',
        severity: 'error',
        message: `Method ${options.method} not allowed for path: ${options.path}`,
        details: {
          method: options.method,
          path: options.path,
          allowedMethods: Object.keys(pathSpec),
        },
      });
      return { kind: 'error', result: { passed: false, violations, warnings } };
    }

    return { kind: 'ok', specPath, methodSpec };
  }

  private validateContentType(options: {
    method: string;
    path: string;
    requestBody?: unknown;
    headers?: Record<string, string>;
    methodSpec: Record<string, unknown>;
  }): ContractViolation[] {
    if (!options.requestBody || !options.methodSpec['requestBody']) {
      return [];
    }

    const bodySpec = (options.methodSpec['requestBody'] as { content?: Record<string, unknown> })
      .content;
    if (!bodySpec) {
      return [];
    }

    const contentType = options.headers?.['content-type'] ?? 'application/json';
    const contentSpec = bodySpec[contentType];
    if (contentSpec) {
      return [];
    }

    return [
      {
        type: 'request',
        severity: 'error',
        message: `Content-Type ${contentType} not supported for this endpoint`,
        details: {
          method: options.method,
          path: options.path,
          contentType,
          supportedTypes: Object.keys(bodySpec),
        },
      },
    ];
  }

  private validateRequiredHeaders(options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    methodSpec: Record<string, unknown>;
  }): ContractViolation[] {
    const requiredHeaders = (
      options.methodSpec['parameters'] as
        | Array<{ in: string; name: string; required?: boolean }>
        | undefined
    )
      ?.filter((parameter) => parameter.in === 'header' && parameter.required)
      .map((parameter) => parameter.name);

    if (!requiredHeaders || requiredHeaders.length === 0) {
      return [];
    }

    const missingHeaders: ContractViolation[] = [];
    for (const header of requiredHeaders) {
      if (!options.headers?.[header.toLowerCase()]) {
        missingHeaders.push({
          type: 'request',
          severity: 'error',
          message: `Required header missing: ${header}`,
          details: { method: options.method, path: options.path, header },
        });
      }
    }
    return missingHeaders;
  }

  /**
   * Load OpenAPI specification
   */
  async loadSpec(specPathOrUrl: string): Promise<void> {
    this.logger.debug('Loading OpenAPI specification', {
      specPath: specPathOrUrl,
      traceId: getTraceId(),
    });

    try {
      // Try to load from URL or file
      const response = await fetch(specPathOrUrl);
      if (!response.ok) {
        throw new Error(`Failed to load OpenAPI spec: ${response.statusText}`);
      }

      this.spec = (await response.json()) as OpenAPISpec;
      this.logger.info('OpenAPI specification loaded', {
        openapiVersion: this.spec.openapi ?? this.spec.swagger,
        pathCount: Object.keys(this.spec.paths ?? {}).length,
        traceId: getTraceId(),
      });
    } catch (error) {
      const error_ = toError(error);
      this.logger.error('Failed to load OpenAPI specification', {
        error: error_.message,
        traceId: getTraceId(),
      });
      throw error_;
    }
  }

  /**
   * Validate data against JSON Schema
   */
  async validateJsonSchema(
    data: unknown,
    schema: Record<string, unknown>
  ): Promise<ContractValidationResult> {
    const violations: ContractViolation[] = [];
    const warnings: ContractWarning[] = [];

    const validator = new ajv({ allErrors: true });
    const validate = validator.compile(schema);
    const isValid = validate(data);

    if (!isValid && validate.errors) {
      validate.errors.forEach((error) => {
        violations.push({
          type: 'schema',
          severity: 'error',
          message: `${error.instancePath} ${error.message}`,
          details: error as unknown as Record<string, unknown>,
        });
      });
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
    };
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
    const violations: ContractViolation[] = [];
    const warnings: ContractWarning[] = [];

    this.logger.debug('Validating request against contract', {
      method,
      path,
      traceId: getTraceId(),
    });

    const methodSpecResult = this.getMethodSpec({ method, path });
    if (methodSpecResult.kind === 'error') {
      return methodSpecResult.result;
    }

    violations.push(
      ...this.validateContentType({
        method,
        path,
        requestBody,
        ...(headers ? { headers } : {}),
        methodSpec: methodSpecResult.methodSpec,
      })
    );
    violations.push(
      ...this.validateRequiredHeaders({
        method,
        path,
        ...(headers ? { headers } : {}),
        methodSpec: methodSpecResult.methodSpec,
      })
    );

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
      method,
      path,
      statusCode,
      traceId: getTraceId(),
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
    this.logger.info('Recording API request for contract validation', {
      method,
      path,
      responseStatus,
      traceId: getTraceId(),
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
 * Contract-aware network virtualization
 */
export class ContractMockManager {
  private readonly validator: ContractValidator;
  private readonly mockManager: NetworkMockManager;
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  constructor(validator: ContractValidator, mockManager = createNetworkMockManager()) {
    this.validator = validator;
    this.mockManager = mockManager;
  }

  private validateFixtureAgainstSchema(fixture: unknown, schema?: Record<string, unknown>): void {
    if (!schema || typeof fixture !== 'object' || fixture === null) {
      return;
    }

    const missing = Object.keys(schema).filter(
      (key) => !(key in (fixture as Record<string, unknown>))
    );
    if (missing.length > 0) {
      throw new Error(`Fixture missing required contract keys: ${missing.join(', ')}`);
    }
  }

  async registerRoute(page: Page, options: ContractedRouteOptions): Promise<void> {
    const { method, path, status = 200, fixture, schema } = options;
    this.validateFixtureAgainstSchema(fixture, schema);

    this.mockManager.registerRoute(path, {
      status,
      headers: { [headerContentType]: 'application/json', [headerContractBacked]: 'true' },
      body: (fixture ?? {}) as Record<string, unknown>,
    });

    await this.validator.validateRequest(method, path, fixture as unknown);

    await page.route(path, async (route) => {
      const result = await this.validator.validateRequest(
        method,
        path,
        route.request().postDataJSON()
      );
      if (!result.passed) {
        this.logger.warn('Contract validation failed for mocked route', {
          path,
          method,
          violations: result.violations,
        });
      }
      await route.fulfill({
        status,
        headers: { [headerContentType]: 'application/json', [headerContractBacked]: 'true' },
        body: JSON.stringify(fixture ?? {}),
      });
    });
  }

  getNetworkManager(): NetworkMockManager {
    return this.mockManager;
  }
}

export async function setupContractBackedMocks(
  page: Page,
  specPathOrUrl: string,
  routes: ContractedRouteOptions[]
): Promise<ContractMockManager> {
  const validator = new ContractValidator();
  await validator.loadSpec(specPathOrUrl);
  const manager = new ContractMockManager(validator);

  for (const route of routes) {
    await manager.registerRoute(page, route);
  }

  return manager;
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

  const logger = createLogger('development', { serviceName: 'playwright-helpers' });

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
          method,
          path,
          violations: result.violations,
          traceId: getTraceId(),
        });
      }

      await route.continue();
    } catch (error) {
      const error_ = toError(error);
      logger.error('Error validating API contract', {
        method,
        path,
        error: error_.message,
        traceId: getTraceId(),
      });
      await route.continue();
    }
  });

  logger.info('API contract validation setup complete', {
    specPath: specPathOrUrl,
    traceId: getTraceId(),
  });

  return validator;
}

/**
 * Create contract validator
 */
export function createContractValidator(): ContractValidator {
  return new ContractValidator();
}
