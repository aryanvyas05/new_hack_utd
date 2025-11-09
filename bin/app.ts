#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { WorkflowStack } from '../lib/workflow-stack';
import { ApiStack } from '../lib/api-stack';
import { AmplifyStack } from '../lib/amplify-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';
const envConfig = app.node.tryGetContext(environment);

// Default environment configuration if not provided in context
const env = {
  account: envConfig?.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: envConfig?.region || process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack naming convention: veritas-onboard-{environment}-{stack-name}
const stackPrefix = `veritas-onboard-${environment}`;

// Create stacks in dependency order
const databaseStack = new DatabaseStack(app, `${stackPrefix}-database`, {
  env,
  description: 'Veritas Onboard - DynamoDB database stack',
  tags: {
    Environment: environment,
    Project: 'veritas-onboard',
    ManagedBy: 'CDK',
  },
});

const workflowStack = new WorkflowStack(app, `${stackPrefix}-workflow`, {
  env,
  description: 'Veritas Onboard - Step Functions workflow and Lambda functions',
  table: databaseStack.table,
  tags: {
    Environment: environment,
    Project: 'veritas-onboard',
    ManagedBy: 'CDK',
  },
});

// Note: Cognito needs to be created before API Gateway for authorizer
// Amplify hosting is optional and requires GitHub configuration
const amplifyStack = new AmplifyStack(app, `${stackPrefix}-amplify`, {
  env,
  description: 'Veritas Onboard - Cognito and Amplify hosting',
  // Optional: Provide these via CDK context for Amplify hosting
  githubRepo: app.node.tryGetContext('githubRepo'),
  githubBranch: app.node.tryGetContext('githubBranch') || 'main',
  githubToken: app.node.tryGetContext('githubToken'),
  tags: {
    Environment: environment,
    Project: 'veritas-onboard',
    ManagedBy: 'CDK',
  },
});

const apiStack = new ApiStack(app, `${stackPrefix}-api`, {
  env,
  description: 'Veritas Onboard - API Gateway and WAF',
  stateMachine: workflowStack.stateMachine,
  table: databaseStack.table,
  userPool: amplifyStack.userPool,
  tags: {
    Environment: environment,
    Project: 'veritas-onboard',
    ManagedBy: 'CDK',
  },
});

// Add stack dependencies to ensure proper deployment order
workflowStack.addDependency(databaseStack);
apiStack.addDependency(workflowStack);
apiStack.addDependency(amplifyStack);

// Create monitoring stack with CloudWatch alarms
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-monitoring`, {
  env,
  description: 'Veritas Onboard - CloudWatch alarms and monitoring',
  api: apiStack.api,
  stateMachine: workflowStack.stateMachine,
  lambdaFunctions: [
    ...workflowStack.getAllLambdaFunctions(),
    ...apiStack.getAllLambdaFunctions(),
  ],
  // Optional: Provide alarm email via CDK context
  alarmEmail: app.node.tryGetContext('alarmEmail'),
  tags: {
    Environment: environment,
    Project: 'veritas-onboard',
    ManagedBy: 'CDK',
  },
});

monitoringStack.addDependency(apiStack);

// Add comprehensive outputs for easy reference after deployment
new cdk.CfnOutput(monitoringStack, 'DeploymentSummary', {
  value: JSON.stringify({
    environment,
    region: env.region,
    stacks: {
      database: databaseStack.stackName,
      workflow: workflowStack.stackName,
      amplify: amplifyStack.stackName,
      api: apiStack.stackName,
      monitoring: monitoringStack.stackName,
    },
  }),
  description: 'Deployment summary with all stack names',
});

// Output frontend configuration instructions
new cdk.CfnOutput(monitoringStack, 'FrontendConfigInstructions', {
  value: `Create frontend/.env.local with:
NEXT_PUBLIC_USER_POOL_ID=${amplifyStack.userPool.userPoolId}
NEXT_PUBLIC_USER_POOL_CLIENT_ID=${amplifyStack.userPoolClient.userPoolClientId}
NEXT_PUBLIC_API_ENDPOINT=${apiStack.apiEndpoint}
NEXT_PUBLIC_AWS_REGION=${env.region}`,
  description: 'Frontend environment variables configuration',
});
