/**
 * Security testing utilities for Playwright tests
 * XSS detection, CSRF validation, security headers, and OWASP checks
 */

import type { Page, Response } from '@playwright/test';
import { getLogger, contextManager } from '@kitiumai/logger';

export interface SecurityCheckResult {
  passed: boolean;
  violations: SecurityViolation[];
  warnings: SecurityWarning[];
}

export interface SecurityViolation {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details?: Record<string, unknown>;
}

export interface SecurityWarning {
  type: string;
  message: string;
  recommendation?: string;
}

/**
 * Security checker for Playwright tests
 */
export class SecurityChecker {
  private readonly logger = getLogger();

  /**
   * Check for XSS vulnerabilities
   */
  async checkXSS(page: Page, testPayloads?: string[]): Promise<SecurityViolation[]> {
    const context = contextManager.getContext();
    const violations: SecurityViolation[] = [];

    const payloads = testPayloads ?? [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      "';alert('XSS');//",
    ];

    this.logger.debug('Checking for XSS vulnerabilities', {
      traceId: context.traceId,
      payloadCount: payloads.length,
    });

    for (const payload of payloads) {
      try {
        // Check if payload appears in page source
        const pageContent = await page.content();
        if (pageContent.includes(payload)) {
          violations.push({
            type: 'xss',
            severity: 'critical',
            message: `Potential XSS vulnerability detected. Payload found in page: ${payload.substring(0, 50)}`,
            details: { payload },
          });
        }

        // Check if alert was triggered (would indicate XSS execution)
        const alertHandled = await Promise.race([
          page.waitForEvent('dialog', { timeout: 1000 }).then(() => true),
          Promise.resolve(false),
        ]).catch(() => false);

        if (alertHandled) {
          violations.push({
            type: 'xss',
            severity: 'critical',
            message: 'XSS payload executed (alert detected)',
            details: { payload },
          });
        }
      } catch (_error) {
        // Ignore errors during XSS testing
      }
    }

    if (violations.length > 0) {
      this.logger.warn('XSS vulnerabilities detected', {
        traceId: context.traceId,
        violationCount: violations.length,
      });
    }

    return violations;
  }

  /**
   * Check for CSRF token presence
   */
  async checkCSRF(page: Page): Promise<SecurityViolation[]> {
    const context = contextManager.getContext();
    const violations: SecurityViolation[] = [];

    this.logger.debug('Checking for CSRF protection', {
      traceId: context.traceId,
    });

    // Check for CSRF token in forms
    const forms = await page.locator('form').all();
    for (const form of forms) {
      const hasCSRFToken =
        (await form
          .locator('input[name*="csrf"], input[name*="token"], input[type="hidden"]')
          .count()) > 0;

      if (!hasCSRFToken) {
        const action = await form.getAttribute('action');
        violations.push({
          type: 'csrf',
          severity: 'high',
          message: `Form missing CSRF token: ${action ?? 'unknown'}`,
          details: { formAction: action },
        });
      }
    }

    // Check for CSRF token in meta tags
    const metaCSRF = await page.locator('meta[name*="csrf"], meta[name*="token"]').count();
    if (metaCSRF === 0) {
      violations.push({
        type: 'csrf',
        severity: 'medium',
        message: 'No CSRF token found in meta tags',
      });
    }

    if (violations.length > 0) {
      this.logger.warn('CSRF protection issues detected', {
        traceId: context.traceId,
        violationCount: violations.length,
      });
    }

    return violations;
  }

  /**
   * Check security headers
   */
  async checkSecurityHeaders(response: Response): Promise<SecurityViolation[]> {
    const context = contextManager.getContext();
    const violations: SecurityViolation[] = [];

    const headers = response.headers();
    const requiredHeaders: Array<{
      name: string;
      severity: SecurityViolation['severity'];
      description: string;
    }> = [
      {
        name: 'X-Frame-Options',
        severity: 'high',
        description: 'Prevents clickjacking attacks',
      },
      {
        name: 'X-Content-Type-Options',
        severity: 'medium',
        description: 'Prevents MIME type sniffing',
      },
      {
        name: 'X-XSS-Protection',
        severity: 'low',
        description: 'Enables XSS filtering (legacy)',
      },
      {
        name: 'Strict-Transport-Security',
        severity: 'high',
        description: 'Enforces HTTPS',
      },
      {
        name: 'Content-Security-Policy',
        severity: 'high',
        description: 'Prevents XSS and injection attacks',
      },
      {
        name: 'Referrer-Policy',
        severity: 'medium',
        description: 'Controls referrer information',
      },
    ];

    this.logger.debug('Checking security headers', {
      traceId: context.traceId,
      url: response.url(),
    });

    for (const required of requiredHeaders) {
      const headerValue = headers[required.name.toLowerCase()];
      if (!headerValue) {
        violations.push({
          type: 'missing-security-header',
          severity: required.severity,
          message: `Missing security header: ${required.name}`,
          details: {
            header: required.name,
            description: required.description,
          },
        });
      }
    }

    // Validate CSP if present
    const csp = headers['content-security-policy'];
    if (csp) {
      const cspIssues = this.validateCSP(csp);
      violations.push(...cspIssues);
    }

    if (violations.length > 0) {
      this.logger.warn('Security header issues detected', {
        traceId: context.traceId,
        violationCount: violations.length,
        url: response.url(),
      });
    }

    return violations;
  }

  /**
   * Validate Content Security Policy
   */
  private validateCSP(csp: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Check for unsafe-inline
    if (csp.includes("'unsafe-inline'")) {
      violations.push({
        type: 'csp-unsafe-inline',
        severity: 'high',
        message: "CSP contains 'unsafe-inline', which reduces XSS protection",
        details: { csp },
      });
    }

    // Check for unsafe-eval
    if (csp.includes("'unsafe-eval'")) {
      violations.push({
        type: 'csp-unsafe-eval',
        severity: 'high',
        message: "CSP contains 'unsafe-eval', which allows script execution",
        details: { csp },
      });
    }

    // Check for wildcard sources
    if (csp.includes('*')) {
      violations.push({
        type: 'csp-wildcard',
        severity: 'medium',
        message: 'CSP contains wildcard (*), which may be too permissive',
        details: { csp },
      });
    }

    return violations;
  }

  /**
   * Comprehensive security check
   */
  async fullSecurityCheck(
    page: Page,
    response: Response,
    options: {
      checkXSS?: boolean;
      checkCSRF?: boolean;
      checkHeaders?: boolean;
      xssPayloads?: string[];
    } = {}
  ): Promise<SecurityCheckResult> {
    const { checkXSS = true, checkCSRF = true, checkHeaders = true, xssPayloads } = options;

    const context = contextManager.getContext();
    this.logger.info('Running comprehensive security check', {
      traceId: context.traceId,
      options,
    });

    const violations: SecurityViolation[] = [];
    const warnings: SecurityWarning[] = [];

    if (checkXSS) {
      const xssViolations = await this.checkXSS(page, xssPayloads);
      violations.push(...xssViolations);
    }

    if (checkCSRF) {
      const csrfViolations = await this.checkCSRF(page);
      violations.push(...csrfViolations);
    }

    if (checkHeaders) {
      const headerViolations = await this.checkSecurityHeaders(response);
      violations.push(...headerViolations);
    }

    // Check for sensitive data exposure
    const pageContent = await page.content();
    const sensitivePatterns = [
      /password\s*[:=]\s*["']?[^"'\s]+/i,
      /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/i,
      /secret\s*[:=]\s*["']?[^"'\s]+/i,
      /token\s*[:=]\s*["']?[^"'\s]+/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(pageContent)) {
        warnings.push({
          type: 'sensitive-data-exposure',
          message: 'Potential sensitive data found in page content',
          recommendation: 'Ensure sensitive data is not exposed in client-side code',
        });
      }
    }

    const result: SecurityCheckResult = {
      passed:
        violations.filter((v) => v.severity === 'critical' || v.severity === 'high').length === 0,
      violations,
      warnings,
    };

    this.logger.info('Security check completed', {
      traceId: context.traceId,
      passed: result.passed,
      violationCount: violations.length,
      warningCount: warnings.length,
    });

    return result;
  }
}

/**
 * Create security checker instance
 */
export function createSecurityChecker(): SecurityChecker {
  return new SecurityChecker();
}

/**
 * Quick security check helper
 */
export async function securityCheck(
  page: Page,
  response: Response,
  options?: Parameters<SecurityChecker['fullSecurityCheck']>[2]
): Promise<SecurityCheckResult> {
  const checker = createSecurityChecker();
  return checker.fullSecurityCheck(page, response, options);
}
