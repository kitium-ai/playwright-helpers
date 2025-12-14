/**
 * AI-powered test generation and analysis
 * Uses OpenAI or similar for generating test scenarios
 */

import { contextManager, createLogger } from '@kitiumai/logger';

export type TestScenario = {
  name: string;
  description: string;
  steps: string[];
  expectedOutcome: string;
};

/**
 * AI test generator
 */
export class AITestGenerator {
  private readonly logger = createLogger('development', { serviceName: 'playwright-helpers' });

  /**
   * Generate test scenarios from user story
   */
  generateScenarios(userStory: string): Promise<TestScenario[]> {
    const context = contextManager.getContext();
    this.logger.debug('Generating test scenarios from user story', {
      traceId: context.traceId,
      userStory: userStory.substring(0, 100),
    });

    const scenarios: TestScenario[] = [];

    // Parse user story to extract key information
    const story = userStory.toLowerCase();

    // Extract main action and subject
    const actionPatterns = [
      /(?:as a|as an)\s+(.+?)(?:\s*,|\s*i want|\s*i can|\s*so that|\s*$)/,
      /(?:i want to|i can|i need to)\s+(.+?)(?:\s*,|\s*so that|\s*$)/,
      /(?:user can|users can|customer can)\s+(.+?)(?:\s*,|\s*so that|\s*$)/,
    ];

    let mainAction = '';
    for (const pattern of actionPatterns) {
      const match = story.match(pattern);
      const mainActionCandidate = match?.[1];
      if (mainActionCandidate) {
        mainAction = mainActionCandidate.trim();
        break;
      }
    }

    // Generate happy path scenario
    if (mainAction) {
      scenarios.push({
        name: 'Happy Path',
        description: `User successfully ${mainAction}`,
        steps: [
          'Navigate to the relevant page',
          `Perform ${mainAction}`,
          'Verify successful completion',
        ],
        expectedOutcome: 'Operation completes successfully with appropriate feedback',
      });
    } else {
      scenarios.push({
        name: 'Happy Path',
        description: 'User completes the primary flow successfully',
        steps: ['Navigate to the page', 'Fill required fields', 'Submit the form'],
        expectedOutcome: 'Success message displayed',
      });
    }

    // Generate error scenarios based on common failure patterns
    const errorScenarios = [
      {
        name: 'Invalid Input',
        description: 'System handles invalid input gracefully',
        steps: ['Navigate to the page', 'Enter invalid data', 'Attempt to submit'],
        expectedOutcome: 'Validation errors displayed with helpful messages',
      },
      {
        name: 'Network Error',
        description: 'System handles network failures appropriately',
        steps: ['Navigate to the page', 'Simulate network failure', 'Attempt operation'],
        expectedOutcome: 'Appropriate error handling and user feedback',
      },
      {
        name: 'Authentication Required',
        description: 'Unauthenticated users are redirected appropriately',
        steps: ['Navigate to protected page without authentication', 'Attempt to access'],
        expectedOutcome: 'Redirect to login page or access denied message',
      },
    ];

    // Add relevant error scenarios based on user story content
    if (story.includes('login') || story.includes('auth')) {
      scenarios.push({
        name: 'Invalid Credentials',
        description: 'System rejects invalid login attempts',
        steps: ['Navigate to login page', 'Enter wrong credentials', 'Submit login'],
        expectedOutcome: 'Login fails with appropriate error message',
      });
    }

    if (story.includes('form') || story.includes('input')) {
      const invalidInputScenario = errorScenarios[0];
      if (invalidInputScenario) {
        scenarios.push(invalidInputScenario);
      }
    }

    if (story.includes('save') || story.includes('submit') || story.includes('create')) {
      scenarios.push({
        name: 'Duplicate Entry',
        description: 'System prevents duplicate entries',
        steps: ['Navigate to the page', 'Submit valid data', 'Attempt to submit same data again'],
        expectedOutcome: 'Duplicate prevention with appropriate message',
      });
    }

    // Add accessibility scenario if relevant
    if (story.includes('user') || story.includes('interface')) {
      scenarios.push({
        name: 'Accessibility',
        description: 'Interface is accessible to all users',
        steps: [
          'Navigate to the page',
          'Test keyboard navigation',
          'Check screen reader compatibility',
        ],
        expectedOutcome: 'All accessibility standards met',
      });
    }

    // Limit to maximum 5 scenarios
    const finalScenarios = scenarios.slice(0, 5);

    this.logger.info('Test scenarios generated', {
      traceId: context.traceId,
      scenarioCount: finalScenarios.length,
      userStoryLength: userStory.length,
    });

    return Promise.resolve(finalScenarios);
  }

  /**
   * Analyze test flakiness patterns
   */
  analyzeFlakiness(testResults: unknown[]): Promise<{
    flakyTests: unknown[];
    recommendations: string[];
  }> {
    const context = contextManager.getContext();
    this.logger.debug('Analyzing test flakiness patterns', {
      traceId: context.traceId,
      resultCount: testResults.length,
    });

    const flakyTests: unknown[] = [];
    const recommendations: string[] = [];

    // Analyze test results for flakiness patterns
    if (testResults.length > 0) {
      // Group tests by name and analyze failure patterns
      const testGroups = new Map<string, unknown[]>();

      for (const result of testResults) {
        if (typeof result === 'object' && result !== null) {
          const testName = (result as { testName?: string }).testName;
          const status = (result as { status?: string }).status;

          if (testName && status) {
            const existing = testGroups.get(testName);
            if (existing) {
              existing.push(result);
            } else {
              testGroups.set(testName, [result]);
            }
          }
        }
      }

      // Identify flaky tests (tests that sometimes pass and sometimes fail)
      for (const [testName, results] of testGroups) {
        const statuses = results.map((r) => (r as { status?: string }).status);
        const hasPasses = statuses.includes('passed');
        const hasFailures = statuses.includes('failed');

        if (hasPasses && hasFailures) {
          const failureRate = statuses.filter((s) => s === 'failed').length / statuses.length;

          if (failureRate > 0.1) {
            // More than 10% failure rate
            flakyTests.push({
              testName,
              failureRate,
              totalRuns: results.length,
              recommendations: [
                'Consider adding retry logic',
                'Check for race conditions',
                'Review timing dependencies',
                'Add more robust selectors',
              ],
            });
          }
        }
      }

      // Generate general recommendations
      if (flakyTests.length > 0) {
        recommendations.push(
          'Multiple tests showing flaky behavior - consider implementing retry mechanisms'
        );
        recommendations.push('Review test isolation and cleanup procedures');
        recommendations.push(
          'Check for external dependencies that may cause intermittent failures'
        );
      }

      if (testResults.length > 100) {
        recommendations.push(
          'High test volume detected - consider parallel execution optimization'
        );
      }

      // Check for timing-related issues
      const slowTests = testResults.filter((result) => {
        const duration = (result as { duration?: number }).duration;
        return duration && duration > 30000; // Tests taking more than 30 seconds
      });

      if (slowTests.length > testResults.length * 0.1) {
        recommendations.push(
          'Many tests are running slowly - consider optimizing page loads or reducing test complexity'
        );
      }
    } else {
      recommendations.push('No test results provided for analysis');
    }

    this.logger.info('Flakiness analysis completed', {
      traceId: context.traceId,
      flakyTestCount: flakyTests.length,
      recommendationCount: recommendations.length,
    });

    return Promise.resolve({
      flakyTests,
      recommendations,
    });
  }
}

/**
 * Create AI test generator
 */
export function createAITestGenerator(): AITestGenerator {
  return new AITestGenerator();
}
