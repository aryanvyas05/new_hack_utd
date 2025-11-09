import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import { Construct } from 'constructs';

export interface AmplifyStackProps extends cdk.StackProps {
  apiEndpoint?: string;
  githubRepo?: string;
  githubBranch?: string;
  githubToken?: string;
}

export class AmplifyStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly amplifyApp?: amplify.CfnApp;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    // Task 11.1: Create Cognito User Pool with email sign-in
    this.userPool = new cognito.UserPool(this, 'OnboardingUserPool', {
      userPoolName: `${id}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      // Configure user attributes (email required, name optional)
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      // Configure password policy (min 8 chars, uppercase, lowercase, number, symbol)
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      // Enable email verification requirement
      autoVerify: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain user pool on stack deletion for safety
    });

    // Task 11.2: Configure Cognito App Client for Amplify
    this.userPoolClient = new cognito.UserPoolClient(this, 'OnboardingUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${id}-client`,
      // Configure appropriate auth flows (USER_SRP_AUTH, REFRESH_TOKEN_AUTH)
      authFlows: {
        userSrp: true,
        userPassword: false, // Disable for security (use SRP instead)
        custom: false,
      },
      // Set token expiration (access token 1 hour, refresh token 30 days)
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      // Enable OAuth implicit grant flow for Amplify integration
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: props.apiEndpoint 
          ? [`${props.apiEndpoint}/callback`, 'http://localhost:3000/callback']
          : ['http://localhost:3000/callback'],
        logoutUrls: props.apiEndpoint
          ? [`${props.apiEndpoint}/logout`, 'http://localhost:3000/logout']
          : ['http://localhost:3000/logout'],
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
    });

    // Task 11.3: Set up Amplify hosting for React frontend (optional)
    // Only create Amplify app if GitHub configuration is provided
    if (props.githubRepo && props.githubToken) {
      this.amplifyApp = new amplify.CfnApp(this, 'OnboardingAmplifyApp', {
        name: `${id}-frontend`,
        repository: props.githubRepo,
        accessToken: props.githubToken,
        // Configure build settings for Next.js application
        buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*`,
        // Set up environment variables for API endpoint and Cognito config
        environmentVariables: [
          {
            name: 'NEXT_PUBLIC_API_ENDPOINT',
            value: props.apiEndpoint || '',
          },
          {
            name: 'NEXT_PUBLIC_USER_POOL_ID',
            value: this.userPool.userPoolId,
          },
          {
            name: 'NEXT_PUBLIC_USER_POOL_CLIENT_ID',
            value: this.userPoolClient.userPoolClientId,
          },
          {
            name: 'NEXT_PUBLIC_AWS_REGION',
            value: this.region,
          },
        ],
        iamServiceRole: this.createAmplifyServiceRole().roleArn,
      });

      // Create branch for deployment
      const branch = new amplify.CfnBranch(this, 'OnboardingAmplifyBranch', {
        appId: this.amplifyApp.attrAppId,
        branchName: props.githubBranch || 'main',
        enableAutoBuild: true,
        enablePullRequestPreview: false,
      });

      // Output Amplify app URL
      new cdk.CfnOutput(this, 'AmplifyAppUrl', {
        value: `https://${props.githubBranch || 'main'}.${this.amplifyApp.attrDefaultDomain}`,
        description: 'Amplify App URL',
        exportName: `${id}-amplify-url`,
      });
    }

    // Export User Pool ID and Client ID as CloudFormation outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${id}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${id}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${id}-user-pool-arn`,
    });
  }

  private createAmplifyServiceRole(): cdk.aws_iam.Role {
    const role = new cdk.aws_iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for Amplify to access AWS resources',
    });

    // Add basic Amplify permissions
    role.addManagedPolicy(
      cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify')
    );

    return role;
  }
}
