import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly tableName: string;
  public readonly tableArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table for onboarding requests
    this.table = new dynamodb.Table(this, 'OnboardingRequestsTable', {
      tableName: 'OnboardingRequests',
      partitionKey: { 
        name: 'requestId', 
        type: dynamodb.AttributeType.STRING 
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add Global Secondary Index for status queries
    this.table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Store table name and ARN for cross-stack references
    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;

    // Export table name and ARN as CloudFormation outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name for onboarding requests',
      exportName: 'OnboardingRequestsTableName',
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN for onboarding requests',
      exportName: 'OnboardingRequestsTableArn',
    });
  }
}
