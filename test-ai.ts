import { createAITestGenerator } from '../src/ai/index.ts';

async function testGenerateScenarios() {
  const generator = createAITestGenerator();

  // Test with a login user story
  const loginStory = 'As a user, I want to login to the system so that I can access my account';
  const scenarios = await generator.generateScenarios(loginStory);

  console.log(`Generated ${scenarios.length} scenarios for login story:`);
  scenarios.forEach((scenario, i) => {
    console.log(`${i + 1}. ${scenario.name}: ${scenario.description}`);
    console.log(`   Steps: ${scenario.steps.join(' → ')}`);
    console.log(`   Expected: ${scenario.expectedOutcome}`);
    console.log();
  });

  // Test with a form submission story
  const formStory = 'As a customer, I want to submit a contact form so that I can get support';
  const formScenarios = await generator.generateScenarios(formStory);

  console.log(`Generated ${formScenarios.length} scenarios for form story:`);
  formScenarios.forEach((scenario, i) => {
    console.log(`${i + 1}. ${scenario.name}: ${scenario.description}`);
  });
}

testGenerateScenarios().catch(console.error);
