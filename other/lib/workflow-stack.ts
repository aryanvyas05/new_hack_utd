import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as path from 'path';

export interface WorkflowStackProps extends cdk.StackProps {
  table: dynamodb.Table;
}

export class WorkflowStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;
  public readonly adminTopic: sns.Topic;

  // Lambda functions
  private readonly redactPiiFunction: lambda.Function;
  private readonly fraudDetectorFunction: lambda.Function;
  private readonly comprehendFunction: lambda.Function;
  private readonly combineScoresFunction: lambda.Function;
  private readonly saveDynamoFunction: lambda.Function;
  private readonly notifyAdminFunction: lambda.Function;

  /**
   * Get all Lambda functions for monitoring
   */
  public getAllLambdaFunctions(): lambda.Function[] {
    return [
      this.redactPiiFunction,
      this.fraudDetectorFunction,
      this.comprehendFunction,
      this.combineScoresFunction,
      this.saveDynamoFunction,
      this.notifyAdminFunction,
    ];
  }

  // Fraud Detector configuration
  private readonly detectorName = 'veritas_onboard_detector';
  private readonly eventTypeName = 'onboarding_request';

  constructor(scope: Construct, id: string, props: WorkflowStackProps) {
    super(scope, id, props);

    // Create Fraud Detector resources (subtask 13.1)
    // NOTE: Fraud Detector setup moved to manual script (lambda/fraud-detector/setup-fraud-detector.sh)
    // this.createFraudDetectorResources();

    // Create SNS topic for admin notifications (subtask 9.5)
    this.adminTopic = new sns.Topic(this, 'AdminNotificationTopic', {
      displayName: 'Veritas Onboard Admin Notifications',
      topicName: 'veritas-onboard-admin-notifications',
    });

    // Export topic ARN for manual email subscription
    new cdk.CfnOutput(this, 'AdminTopicArn', {
      value: this.adminTopic.topicArn,
      description: 'SNS topic ARN for admin notifications',
      exportName: `${id}-admin-topic-arn`,
    });

    // Define all Lambda functions (subtask 9.1)
    this.redactPiiFunction = this.createRedactPiiFunction();
    this.fraudDetectorFunction = this.createFraudDetectorFunction();
    this.comprehendFunction = this.createComprehendFunction();
    this.combineScoresFunction = this.createCombineScoresFunction();
    this.saveDynamoFunction = this.createSaveDynamoFunction(props.table);
    this.notifyAdminFunction = this.createNotifyAdminFunction();

    // Create Step Functions state machine (subtask 9.3 and 9.4)
    this.stateMachine = this.createStateMachine();

    // Export state machine ARN
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'Step Functions state machine ARN',
      exportName: `${id}-state-machine-arn`,
    });
  }

  /**
   * Create Redact PII Lambda function
   * Memory: 512 MB, Timeout: 60 seconds
   */
  private createRedactPiiFunction(): lambda.Function {
    const fn = new lambda.Function(this, 'RedactPiiFunction', {
      functionName: 'veritas-onboard-redact-pii',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/redact-pii')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      description: 'Detects and redacts PII from onboarding requests',
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    return fn;
  }

  /**
   * Create Fraud Detector Lambda function
   * Memory: 512 MB, Timeout: 60 seconds
   * Updated with model details (subtask 13.3)
   */
  private createFraudDetectorFunction(): lambda.Function {
    const fn = new lambda.Function(this, 'FraudDetectorFunction', {
      functionName: 'veritas-onboard-fraud-detector',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/fraud-detector')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      description: 'Analyzes fraud risk using Amazon Fraud Detector',
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
      environment: {
        DETECTOR_NAME: this.detectorName,
        EVENT_TYPE_NAME: this.eventTypeName,
        MODEL_VERSION: '1.0',
      },
    });

    // Grant Fraud Detector read permissions (subtask 9.2)
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'frauddetector:GetEventPrediction',
        'frauddetector:GetDetectors',
        'frauddetector:GetEventTypes',
      ],
      resources: ['*'], // Fraud Detector doesn't support resource-level permissions
    }));

    return fn;
  }

  /**
   * Create Comprehend Lambda function
   * Memory: 512 MB, Timeout: 60 seconds
   */
  private createComprehendFunction(): lambda.Function {
    const fn = new lambda.Function(this, 'ComprehendFunction', {
      functionName: 'veritas-onboard-comprehend',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/comprehend')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      description: 'Analyzes sentiment and key phrases using Amazon Comprehend',
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    // Grant Comprehend read permissions (subtask 9.2)
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'comprehend:DetectSentiment',
        'comprehend:DetectKeyPhrases',
      ],
      resources: ['*'], // Comprehend doesn't support resource-level permissions
    }));

    return fn;
  }

  /**
   * Create Combine Scores Lambda function
   * Memory: 256 MB, Timeout: 30 seconds
   */
  private createCombineScoresFunction(): lambda.Function {
    const fn = new lambda.Function(this, 'CombineScoresFunction', {
      functionName: 'veritas-onboard-combine-scores',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/combine-scores')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Combines fraud and content risk scores',
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    return fn;
  }

  /**
   * Create Save to DynamoDB Lambda function
   * Memory: 256 MB, Timeout: 30 seconds
   */
  private createSaveDynamoFunction(table: dynamodb.Table): lambda.Function {
    const fn = new lambda.Function(this, 'SaveDynamoFunction', {
      functionName: 'veritas-onboard-save-dynamo',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/save-dynamo')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Saves onboarding request to DynamoDB',
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Grant DynamoDB write permissions to specific table only (subtask 9.2)
    table.grantWriteData(fn);

    return fn;
  }

  /**
   * Create Notify Admin Lambda function
   * Memory: 256 MB, Timeout: 30 seconds
   */
  private createNotifyAdminFunction(): lambda.Function {
    const fn = new lambda.Function(this, 'NotifyAdminFunction', {
      functionName: 'veritas-onboard-notify-admin',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/notify-admin')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Sends SNS notification to admins for manual review',
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
      environment: {
        TOPIC_ARN: this.adminTopic.topicArn,
      },
    });

    // Grant SNS publish permissions to specific topic only (subtask 9.2)
    this.adminTopic.grantPublish(fn);

    return fn;
  }

  /**
   * Create Step Functions state machine with complete workflow
   * Includes error handling and retry configuration (subtasks 9.3 and 9.4)
   */
  private createStateMachine(): sfn.StateMachine {
    // Define retry configuration for all Lambda tasks (subtask 9.4)
    const retryConfig: sfn.RetryProps[] = [{
      errors: ['States.ALL'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 2,
      backoffRate: 2.0,
    }];

    // Step 1: Redact PII
    const redactPiiTask = new tasks.LambdaInvoke(this, 'RedactPII', {
      lambdaFunction: this.redactPiiFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    redactPiiTask.addRetry(...retryConfig);

    // Step 2: Parallel Risk Assessment
    // Branch 1: Fraud Detection
    const fraudDetectorTask = new tasks.LambdaInvoke(this, 'CheckFraudDetector', {
      lambdaFunction: this.fraudDetectorFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    fraudDetectorTask.addRetry(...retryConfig);

    // Branch 2: Sentiment Analysis
    const comprehendTask = new tasks.LambdaInvoke(this, 'CheckComprehend', {
      lambdaFunction: this.comprehendFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    comprehendTask.addRetry(...retryConfig);

    // Parallel state for risk assessment
    const parallelRiskAssessment = new sfn.Parallel(this, 'ParallelRiskAssessment', {
      resultPath: '$.riskAssessments',
    });
    parallelRiskAssessment.branch(fraudDetectorTask);
    parallelRiskAssessment.branch(comprehendTask);

    // Transform parallel results into format expected by combine-scores
    const transformScores = new sfn.Pass(this, 'TransformScores', {
      parameters: {
        'requestId.$': '$.requestId',
        'vendorName.$': '$.vendorName',
        'contactEmail.$': '$.contactEmail',
        'businessDescription.$': '$.businessDescription',
        'taxId.$': '$.taxId',
        'sourceIp.$': '$.sourceIp',
        'submittedAt.$': '$.submittedAt',
        'fraudScore.$': '$.riskAssessments[0].fraudScore',
        'contentRiskScore.$': '$.riskAssessments[1].contentRiskScore',
      },
    });

    // Step 3: Combine Scores
    const combineScoresTask = new tasks.LambdaInvoke(this, 'CombineScores', {
      lambdaFunction: this.combineScoresFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    combineScoresTask.addRetry(...retryConfig);

    // Step 4: Manual Review path - Save with MANUAL_REVIEW status
    const manualReviewTask = new tasks.LambdaInvoke(this, 'ManualReview', {
      lambdaFunction: this.saveDynamoFunction,
      payload: sfn.TaskInput.fromObject({
        'requestId.$': '$.requestId',
        'vendorName.$': '$.vendorName',
        'contactEmail.$': '$.contactEmail',
        'businessDescription.$': '$.businessDescription',
        'taxId.$': '$.taxId',
        'sourceIp.$': '$.sourceIp',
        'submittedAt.$': '$.submittedAt',
        'fraudScore.$': '$.fraudScore',
        'contentRiskScore.$': '$.contentRiskScore',
        'combinedRiskScore.$': '$.combinedRiskScore',
        'recommendation.$': '$.recommendation',
        'status': 'MANUAL_REVIEW',
      }),
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    manualReviewTask.addRetry(...retryConfig);

    // Step 5: Notify Admin
    const notifyAdminTask = new tasks.LambdaInvoke(this, 'NotifyAdmin', {
      lambdaFunction: this.notifyAdminFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    notifyAdminTask.addRetry(...retryConfig);

    // Step 6: Auto Approve path - Save with APPROVED status
    const autoApproveTask = new tasks.LambdaInvoke(this, 'AutoApprove', {
      lambdaFunction: this.saveDynamoFunction,
      payload: sfn.TaskInput.fromObject({
        'requestId.$': '$.requestId',
        'vendorName.$': '$.vendorName',
        'contactEmail.$': '$.contactEmail',
        'businessDescription.$': '$.businessDescription',
        'taxId.$': '$.taxId',
        'sourceIp.$': '$.sourceIp',
        'submittedAt.$': '$.submittedAt',
        'fraudScore.$': '$.fraudScore',
        'contentRiskScore.$': '$.contentRiskScore',
        'combinedRiskScore.$': '$.combinedRiskScore',
        'recommendation.$': '$.recommendation',
        'status': 'APPROVED',
      }),
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });
    autoApproveTask.addRetry(...retryConfig);

    // Choice state: Evaluate risk score threshold (> 0.8)
    const evaluateRisk = new sfn.Choice(this, 'EvaluateRisk')
      .when(
        sfn.Condition.numberGreaterThan('$.combinedRiskScore', 0.8),
        manualReviewTask.next(notifyAdminTask)
      )
      .otherwise(autoApproveTask);

    // Define the workflow chain
    const definition = redactPiiTask
      .next(parallelRiskAssessment)
      .next(transformScores)
      .next(combineScoresTask)
      .next(evaluateRisk);

    // Create the state machine
    const stateMachine = new sfn.StateMachine(this, 'OnboardingWorkflow', {
      stateMachineName: 'veritas-onboard-workflow',
      definition,
      timeout: cdk.Duration.minutes(5),
      tracingEnabled: true, // Enable X-Ray tracing
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          logGroupName: '/aws/vendedlogs/states/veritas-onboard-workflow',
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    return stateMachine;
  }

  /**
   * Create Fraud Detector event type and variables (subtask 13.1)
   * Uses CloudFormation custom resources to configure Fraud Detector
   */
  private createFraudDetectorResources(): void {
    // Create variables for Fraud Detector
    const emailVariable = new cr.AwsCustomResource(this, 'FraudDetectorEmailVariable', {
      onCreate: {
        service: 'FraudDetector',
        action: 'putVariable',
        parameters: {
          name: 'email_address',
          dataType: 'EMAIL_ADDRESS',
          dataSource: 'EVENT',
          defaultValue: 'unknown@example.com',
          description: 'Contact email address from onboarding request',
        },
        physicalResourceId: cr.PhysicalResourceId.of('email_address_variable'),
      },
      onUpdate: {
        service: 'FraudDetector',
        action: 'putVariable',
        parameters: {
          name: 'email_address',
          dataType: 'EMAIL_ADDRESS',
          dataSource: 'EVENT',
          defaultValue: 'unknown@example.com',
          description: 'Contact email address from onboarding request',
        },
        physicalResourceId: cr.PhysicalResourceId.of('email_address_variable'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const ipVariable = new cr.AwsCustomResource(this, 'FraudDetectorIpVariable', {
      onCreate: {
        service: 'FraudDetector',
        action: 'putVariable',
        parameters: {
          name: 'ip_address',
          dataType: 'IP_ADDRESS',
          dataSource: 'EVENT',
          defaultValue: '0.0.0.0',
          description: 'Source IP address from onboarding request',
        },
        physicalResourceId: cr.PhysicalResourceId.of('ip_address_variable'),
      },
      onUpdate: {
        service: 'FraudDetector',
        action: 'putVariable',
        parameters: {
          name: 'ip_address',
          dataType: 'IP_ADDRESS',
          dataSource: 'EVENT',
          defaultValue: '0.0.0.0',
          description: 'Source IP address from onboarding request',
        },
        physicalResourceId: cr.PhysicalResourceId.of('ip_address_variable'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const accountNameVariable = new cr.AwsCustomResource(this, 'FraudDetectorAccountNameVariable', {
      onCreate: {
        service: 'FraudDetector',
        action: 'putVariable',
        parameters: {
          name: 'account_name',
          dataType: 'FREE_FORM_TEXT',
          dataSource: 'EVENT',
          defaultValue: 'unknown',
          description: 'Vendor/account name from onboarding request',
        },
        physicalResourceId: cr.PhysicalResourceId.of('account_name_variable'),
      },
      onUpdate: {
        service: 'FraudDetector',
        action: 'putVariable',
        parameters: {
          name: 'account_name',
          dataType: 'FREE_FORM_TEXT',
          dataSource: 'EVENT',
          defaultValue: 'unknown',
          description: 'Vendor/account name from onboarding request',
        },
        physicalResourceId: cr.PhysicalResourceId.of('account_name_variable'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Create entity type for customer
    const entityType = new cr.AwsCustomResource(this, 'FraudDetectorEntityType', {
      onCreate: {
        service: 'FraudDetector',
        action: 'putEntityType',
        parameters: {
          name: 'customer',
          description: 'Customer entity for onboarding requests',
        },
        physicalResourceId: cr.PhysicalResourceId.of('customer_entity_type'),
      },
      onUpdate: {
        service: 'FraudDetector',
        action: 'putEntityType',
        parameters: {
          name: 'customer',
          description: 'Customer entity for onboarding requests',
        },
        physicalResourceId: cr.PhysicalResourceId.of('customer_entity_type'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Create event type
    const eventType = new cr.AwsCustomResource(this, 'FraudDetectorEventType', {
      onCreate: {
        service: 'FraudDetector',
        action: 'putEventType',
        parameters: {
          name: this.eventTypeName,
          eventVariables: ['email_address', 'ip_address', 'account_name'],
          entityTypes: ['customer'],
          description: 'Onboarding request event for fraud detection',
        },
        physicalResourceId: cr.PhysicalResourceId.of('onboarding_request_event_type'),
      },
      onUpdate: {
        service: 'FraudDetector',
        action: 'putEventType',
        parameters: {
          name: this.eventTypeName,
          eventVariables: ['email_address', 'ip_address', 'account_name'],
          entityTypes: ['customer'],
          description: 'Onboarding request event for fraud detection',
        },
        physicalResourceId: cr.PhysicalResourceId.of('onboarding_request_event_type'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Ensure proper dependency order
    ipVariable.node.addDependency(emailVariable);
    accountNameVariable.node.addDependency(ipVariable);
    entityType.node.addDependency(accountNameVariable);
    eventType.node.addDependency(entityType);

    // Output the event type name
    new cdk.CfnOutput(this, 'FraudDetectorEventTypeOutput', {
      value: this.eventTypeName,
      description: 'Fraud Detector event type name',
      exportName: `${this.stackName}-fraud-detector-event-type`,
    });

    new cdk.CfnOutput(this, 'FraudDetectorDetectorNameOutput', {
      value: this.detectorName,
      description: 'Fraud Detector detector name (to be created manually)',
      exportName: `${this.stackName}-fraud-detector-name`,
    });
  }
}
