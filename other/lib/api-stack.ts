import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  stateMachine: sfn.StateMachine;
  table?: dynamodb.Table;
  userPool?: cognito.UserPool;
}

export class ApiStack extends cdk.Stack {
  public readonly apiEndpoint: string;
  public readonly api: apigateway.RestApi;
  private readonly startWorkflowFunction: lambda.Function;
  private readonly queryStatusFunction: lambda.Function;
  private readonly quicksightDataFunction: lambda.Function;

  /**
   * Get all Lambda functions for monitoring
   */
  public getAllLambdaFunctions(): lambda.Function[] {
    return [
      this.startWorkflowFunction,
      this.queryStatusFunction,
      this.quicksightDataFunction,
    ];
  }

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create Lambda functions
    this.startWorkflowFunction = this.createStartWorkflowFunction(props.stateMachine);
    this.queryStatusFunction = this.createQueryStatusFunction(props.table);
    this.quicksightDataFunction = this.createQuickSightDataFunction(props.table);

    // Create REST API Gateway (subtask 10.1)
    this.api = new apigateway.RestApi(this, 'OnboardingApi', {
      restApiName: 'Veritas Onboard API',
      description: 'API Gateway for Veritas Onboard serverless onboarding platform',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true, // Enable X-Ray tracing
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiAccessLogs', {
            logGroupName: `/aws/apigateway/${id}-access-logs`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Configure specific origins in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // Create Cognito authorizer if user pool is provided (subtask 10.3)
    // Temporarily disabled for demo/testing
    let authorizer: apigateway.CognitoUserPoolsAuthorizer | undefined;
    // if (props.userPool) {
    //   authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
    //     cognitoUserPools: [props.userPool],
    //     authorizerName: 'veritas-onboard-authorizer',
    //     identitySource: 'method.request.header.Authorization',
    //   });
    // }

    // Configure API Gateway endpoints and integrations (subtask 10.3)
    // Auth disabled for demo/testing
    this.configureEndpoints(undefined);

    // Implement AWS WAF with security rules (subtask 10.4)
    // NOTE: WAF temporarily disabled due to deployment timing issues
    // Can be re-enabled after initial deployment
    // this.configureWAF();

    // Store and export API endpoint
    this.apiEndpoint = this.api.url;

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.apiEndpoint,
      description: 'API Gateway endpoint URL',
      exportName: `${id}-api-endpoint`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway REST API ID',
      exportName: `${id}-api-id`,
    });
  }

  /**
   * Create Start Workflow Lambda function (subtask 10.2)
   */
  private createStartWorkflowFunction(stateMachine: sfn.StateMachine): lambda.Function {
    const fn = new lambda.Function(this, 'StartWorkflowFunction', {
      functionName: 'veritas-onboard-start-workflow',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/start-workflow')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Validates input and starts Step Functions workflow',
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    // Grant permission to start Step Functions execution
    stateMachine.grantStartExecution(fn);

    return fn;
  }

  /**
   * Create Query Status Lambda function
   */
  private createQueryStatusFunction(table?: dynamodb.Table): lambda.Function {
    const fn = new lambda.Function(this, 'QueryStatusFunction', {
      functionName: 'veritas-onboard-query-status',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/query-status')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Queries onboarding request status from DynamoDB',
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        TABLE_NAME: table?.tableName || 'OnboardingRequests',
      },
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    // Grant DynamoDB read permissions if table is provided
    if (table) {
      table.grantReadData(fn);
    }

    return fn;
  }

  /**
   * Create QuickSight Data Lambda function (subtask 15.1)
   */
  private createQuickSightDataFunction(table?: dynamodb.Table): lambda.Function {
    const fn = new lambda.Function(this, 'QuickSightDataFunction', {
      functionName: 'veritas-onboard-quicksight-data',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'quicksight_handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/query-status')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      description: 'Provides aggregated metrics for QuickSight dashboards',
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        TABLE_NAME: table?.tableName || 'OnboardingRequests',
      },
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    // Grant DynamoDB read permissions if table is provided
    if (table) {
      table.grantReadData(fn);
      // Grant access to StatusIndex GSI
      if (table.tableArn) {
        fn.addToRolePolicy(new iam.PolicyStatement({
          actions: ['dynamodb:Query'],
          resources: [`${table.tableArn}/index/StatusIndex`],
        }));
      }
    }

    return fn;
  }

  /**
   * Configure API Gateway endpoints and integrations (subtask 10.3)
   */
  private configureEndpoints(authorizer?: apigateway.CognitoUserPoolsAuthorizer): void {
    // Create /onboard resource
    const onboardResource = this.api.root.addResource('onboard');

    // POST /onboard endpoint with Lambda proxy integration
    const startWorkflowIntegration = new apigateway.LambdaIntegration(
      this.startWorkflowFunction,
      {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '202',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '400',
            selectionPattern: '.*"statusCode": 400.*',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '500',
            selectionPattern: '.*"statusCode": 500.*',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }
    );

    onboardResource.addMethod('POST', startWorkflowIntegration, {
      // Temporarily disable auth for demo/testing
      // authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.NONE,
      requestValidator: new apigateway.RequestValidator(this, 'OnboardRequestValidator', {
        restApi: this.api,
        requestValidatorName: 'onboard-request-validator',
        validateRequestBody: true,
        validateRequestParameters: false,
      }),
      requestModels: {
        'application/json': this.createOnboardRequestModel(),
      },
      methodResponses: [
        {
          statusCode: '202',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Create /status resource
    const statusResource = this.api.root.addResource('status');
    const statusRequestIdResource = statusResource.addResource('{requestId}');

    // GET /status/{requestId} endpoint with Lambda integration
    const queryStatusIntegration = new apigateway.LambdaIntegration(
      this.queryStatusFunction,
      {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '404',
            selectionPattern: '.*"statusCode": 404.*',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '500',
            selectionPattern: '.*"statusCode": 500.*',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }
    );

    statusRequestIdResource.addMethod('GET', queryStatusIntegration, {
      authorizer: authorizer,
      authorizationType: authorizer ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE,
      requestParameters: {
        'method.request.path.requestId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Create /analytics resource for QuickSight data (subtask 15.1)
    const analyticsResource = this.api.root.addResource('analytics');

    // GET /analytics endpoint with Lambda integration
    const quicksightDataIntegration = new apigateway.LambdaIntegration(
      this.quicksightDataFunction,
      {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '500',
            selectionPattern: '.*"statusCode": 500.*',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }
    );

    analyticsResource.addMethod('GET', quicksightDataIntegration, {
      authorizer: authorizer,
      authorizationType: authorizer ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE,
      requestParameters: {
        'method.request.querystring.type': false,
        'method.request.querystring.days': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
  }

  /**
   * Create request model for POST /onboard validation
   */
  private createOnboardRequestModel(): apigateway.Model {
    return new apigateway.Model(this, 'OnboardRequestModel', {
      restApi: this.api,
      modelName: 'OnboardRequest',
      description: 'Request model for onboarding submission',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['vendorName', 'contactEmail', 'businessDescription', 'taxId'],
        properties: {
          vendorName: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 1,
            maxLength: 200,
          },
          contactEmail: {
            type: apigateway.JsonSchemaType.STRING,
            format: 'email',
            minLength: 5,
            maxLength: 100,
          },
          businessDescription: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 10,
            maxLength: 5000,
          },
          taxId: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 9,
            maxLength: 20,
          },
        },
      },
    });
  }

  /**
   * Implement AWS WAF with security rules (subtask 10.4)
   */
  private configureWAF(): void {
    // Create WAF WebACL
    const webAcl = new wafv2.CfnWebACL(this, 'ApiWafWebAcl', {
      name: 'veritas-onboard-api-waf',
      description: 'WAF rules for Veritas Onboard API Gateway',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'veritas-onboard-api-waf',
      },
      rules: [
        // AWS Managed Core Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },
        // SQL Injection Protection
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSet',
          },
        },
        // XSS Protection
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        // Rate-based rule: 100 requests per 5 minutes per IP
        {
          name: 'RateLimitRule',
          priority: 4,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'rate-limit-response',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
      ],
      customResponseBodies: {
        'rate-limit-response': {
          contentType: 'APPLICATION_JSON',
          content: '{"error": "Rate limit exceeded. Please try again later."}',
        },
      },
    });

    // Associate WebACL with API Gateway
    new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${this.api.restApiId}/stages/prod`,
      webAclArn: webAcl.attrArn,
    });

    // Output WAF WebACL ARN
    new cdk.CfnOutput(this, 'WafWebAclArn', {
      value: webAcl.attrArn,
      description: 'WAF WebACL ARN',
      exportName: `${this.stackName}-waf-webacl-arn`,
    });
  }
}
