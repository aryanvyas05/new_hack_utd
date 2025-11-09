# Veritas Onboard

Serverless, AI-powered onboarding platform built on AWS that streamlines vendor and client onboarding with robust fraud detection, PII protection, and compliance management.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Deployment](#deployment)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Cleanup](#cleanup)
- [Documentation](#documentation)

## Overview

Veritas Onboard automates the vendor and client onboarding process using AWS serverless services and AI/ML capabilities. The platform provides:

- **Automated PII Detection & Redaction**: Protects sensitive information (SSN, credit cards, phone numbers, emails)
- **AI-Powered Fraud Detection**: Uses Amazon Fraud Detector to assess risk based on email, IP address, and business information
- **Sentiment Analysis**: Analyzes business descriptions using Amazon Comprehend to identify risky content
- **Intelligent Routing**: Automatically approves low-risk requests and routes high-risk requests for manual review
- **Real-time Notifications**: Alerts administrators when manual review is required
- **Comprehensive Audit Trail**: Tracks all actions and decisions in DynamoDB
- **Analytics Dashboard**: QuickSight integration for business intelligence and reporting

## Architecture

The system uses AWS CDK to deploy a serverless architecture consisting of:

### Core Components

- **Frontend**: React/Next.js hosted on AWS Amplify with Cognito authentication
- **API Layer**: API Gateway with AWS WAF protection (SQL injection, XSS, rate limiting)
- **Orchestration**: AWS Step Functions state machine coordinating the workflow
- **Compute**: AWS Lambda functions (Python 3.12) for each processing step
- **AI/ML Services**: 
  - Amazon Fraud Detector (New Account Fraud model)
  - Amazon Comprehend (Sentiment analysis and key phrase extraction)
- **Storage**: Amazon DynamoDB with on-demand billing and GSI for status queries
- **Notifications**: Amazon SNS for admin alerts
- **Analytics**: Amazon QuickSight for dashboards and reporting
- **Monitoring**: CloudWatch Logs, Metrics, Alarms, and X-Ray tracing

### Workflow

1. User submits onboarding request through authenticated web portal
2. API Gateway validates JWT token and forwards to Start Workflow Lambda
3. Step Functions orchestrates the following steps:
   - **Redact PII**: Masks sensitive information before processing
   - **Parallel Risk Assessment**: 
     - Fraud Detector evaluates email, IP, and business data
     - Comprehend analyzes business description sentiment
   - **Combine Scores**: Calculates weighted risk score (70% fraud, 30% content)
   - **Route Decision**: Auto-approve if score ≤ 0.8, otherwise manual review
   - **Save to DynamoDB**: Persists complete record with audit trail
   - **Notify Admin**: Sends SNS alert for manual review cases
4. User can query status via API or QuickSight dashboard

## Project Structure

```
veritas-onboard/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── amplify-stack.ts          # Frontend hosting + Cognito User Pool
│   ├── api-stack.ts              # API Gateway + WAF + Start Lambda
│   ├── database-stack.ts         # DynamoDB table with GSI
│   ├── workflow-stack.ts         # Step Functions + workflow Lambdas
│   └── monitoring-stack.ts       # CloudWatch dashboards and alarms
├── lambda/
│   ├── start-workflow/           # Workflow initiation and validation
│   ├── redact-pii/               # PII detection and masking
│   ├── fraud-detector/           # Fraud Detector integration
│   ├── comprehend/               # Sentiment analysis
│   ├── combine-scores/           # Risk score calculation
│   ├── save-dynamo/              # DynamoDB persistence
│   ├── notify-admin/             # SNS notifications
│   └── query-status/             # Status queries and QuickSight data
├── frontend/
│   ├── app/                      # Next.js App Router pages
│   ├── components/               # React components
│   ├── lib/                      # API client and Amplify config
│   └── types/                    # TypeScript type definitions
├── cdk.json                      # CDK configuration
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
└── deploy.sh                     # Automated deployment script
```

## Prerequisites

Before deploying Veritas Onboard, ensure you have the following installed and configured:

### Required Software

1. **Node.js** (v18.x or later)
   ```bash
   node --version  # Should be 18.x or higher
   ```

2. **Python** (v3.12 or later)
   ```bash
   python3 --version  # Should be 3.12 or higher
   ```

3. **AWS CLI** (v2.x)
   ```bash
   aws --version
   ```
   - Configure with credentials: `aws configure`
   - Ensure your IAM user/role has permissions to create:
     - Lambda functions
     - Step Functions state machines
     - DynamoDB tables
     - API Gateway APIs
     - Cognito User Pools
     - SNS topics
     - CloudWatch resources
     - IAM roles and policies
     - Fraud Detector resources
     - Comprehend access

4. **AWS CDK CLI** (v2.110.0 or later)
   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

### AWS Account Requirements

- AWS account with appropriate permissions
- Account must be bootstrapped for CDK (see Installation section)
- Sufficient service quotas for Lambda, API Gateway, DynamoDB
- Fraud Detector must be available in your region (us-east-1, us-west-2, eu-west-1, ap-southeast-1, ap-southeast-2)

### Optional Tools

- **jq**: For parsing JSON outputs in deployment script
- **Git**: For version control

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd veritas-onboard
```

### 2. Install Node.js Dependencies

```bash
npm install
```

This installs:
- AWS CDK libraries
- TypeScript compiler
- Type definitions

### 3. Install Python Dependencies (for Lambda functions)

Each Lambda function has its own dependencies. They will be packaged automatically during CDK deployment.

### 4. Bootstrap CDK (First Time Only)

Bootstrap your AWS account for CDK deployment:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Example:
```bash
cdk bootstrap aws://123456789012/us-east-1
```

This creates an S3 bucket and other resources needed for CDK deployments.

### 5. Build TypeScript Code

```bash
npm run build
```

This compiles the TypeScript CDK code to JavaScript.

## Deployment

### Quick Deployment (Recommended)

Use the automated deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
- Validate prerequisites
- Build the CDK code
- Deploy all stacks
- Display important outputs (API endpoint, Cognito IDs, SNS topic ARN)

### Manual Deployment

#### Step 1: Configure Fraud Detector

Before deploying the CDK stacks, set up Amazon Fraud Detector:

```bash
cd lambda/fraud-detector
chmod +x setup-fraud-detector.sh
./setup-fraud-detector.sh
cd ../..
```

This script creates:
- Event type: `onboarding_request`
- Variables: `email_address`, `ip_address`, `account_name`
- Detector: `veritas_onboard_detector`
- Model: Online Fraud Insights for new account fraud

**Alternative**: Follow the manual setup guide in `lambda/fraud-detector/SETUP.md`

#### Step 2: Deploy CDK Stacks

Deploy all stacks to the default environment:

```bash
npm run deploy
```

Or deploy with CDK directly:

```bash
cdk deploy --all
```

Deploy to a specific environment:

```bash
cdk deploy --all --context environment=prod
```

#### Step 3: Note the Outputs

After deployment, CDK will display important outputs:

```
Outputs:
VeritasOnboardApiStack.ApiEndpoint = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
VeritasOnboardAmplifyStack.UserPoolId = us-east-1_xxxxxxxxx
VeritasOnboardAmplifyStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
VeritasOnboardWorkflowStack.AdminNotificationTopicArn = arn:aws:sns:us-east-1:123456789012:VeritasOnboard-AdminNotifications
VeritasOnboardDatabaseStack.TableName = VeritasOnboard-OnboardingRequests
VeritasOnboardWorkflowStack.StateMachineArn = arn:aws:states:us-east-1:123456789012:stateMachine:VeritasOnboardWorkflow
```

Save these values for post-deployment configuration.

### Environment-Specific Deployment

Configure environments in `cdk.json` under the `context` section:

```json
{
  "context": {
    "dev": {
      "account": "123456789012",
      "region": "us-east-1"
    },
    "prod": {
      "account": "987654321098",
      "region": "us-west-2"
    }
  }
}
```

Deploy to production:

```bash
cdk deploy --all --context environment=prod
```

## Post-Deployment Configuration

### 1. Subscribe to Admin Notifications

Get the SNS topic ARN from the deployment outputs, then subscribe your email:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:VeritasOnboard-AdminNotifications \
  --protocol email \
  --notification-endpoint admin@example.com
```

Check your email and confirm the subscription.

### 2. Configure Frontend Environment Variables

**Option A: Automatic Configuration (Recommended)**

Use the provided script to automatically extract CloudFormation outputs and create the frontend configuration:

```bash
./scripts/configure-frontend.sh
```

For a specific environment:

```bash
./scripts/configure-frontend.sh prod
```

**Option B: Manual Configuration**

Update the frontend configuration with the deployed resources:

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` with the values from CDK outputs:

```env
NEXT_PUBLIC_API_ENDPOINT=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### 3. Deploy Frontend to Amplify

If using Amplify hosting:

```bash
cd frontend
npm install
npm run build
```

Then deploy via Amplify Console or CLI.

### 4. Set Up QuickSight Dashboard (Optional)

Follow the guide in `lambda/query-status/QUICKSIGHT_SETUP.md` to:

1. Connect QuickSight to the DynamoDB table
2. Create a dataset
3. Build visualizations for:
   - Onboarding requests by status
   - Risk score distribution
   - Time-series trends
   - Approval rates

### 5. Create Test User

Create a test user in Cognito:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_xxxxxxxxx \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS
```

Set permanent password:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_xxxxxxxxx \
  --username testuser@example.com \
  --password YourPassword123! \
  --permanent
```

## Testing

### Test the Complete Workflow

1. **Access the Frontend**:
   - Navigate to your Amplify app URL or `http://localhost:3000` if running locally
   - Sign in with your test user credentials

2. **Submit a Low-Risk Request**:
   ```json
   {
     "vendorName": "Acme Corporation",
     "contactEmail": "contact@acme.com",
     "businessDescription": "We provide excellent software solutions for businesses.",
     "taxId": "12-3456789"
   }
   ```
   - Expected: Auto-approved (risk score < 0.8)

3. **Submit a High-Risk Request**:
   ```json
   {
     "vendorName": "Suspicious Vendor",
     "contactEmail": "test@suspicious-domain.xyz",
     "businessDescription": "Offshore shell company for money laundering operations.",
     "taxId": "98-7654321"
   }
   ```
   - Expected: Manual review (risk score > 0.8)
   - Admin should receive SNS notification

4. **Verify in AWS Console**:
   - **Step Functions**: Check execution history
   - **DynamoDB**: Query the OnboardingRequests table
   - **CloudWatch Logs**: Review Lambda execution logs
   - **X-Ray**: View distributed traces

### Test Fraud Detector Lambda

```bash
cd lambda/fraud-detector
python3 test-lambda.py
```

See `lambda/fraud-detector/TESTING.md` for detailed testing instructions.

### Test API Endpoints

Using curl:

```bash
# Get JWT token from Cognito (use AWS CLI or Amplify)
TOKEN="your-jwt-token"

# Submit onboarding request
curl -X POST https://your-api-endpoint/prod/onboard \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test Vendor",
    "contactEmail": "test@example.com",
    "businessDescription": "Test business",
    "taxId": "12-3456789"
  }'

# Check status
curl -X GET https://your-api-endpoint/prod/status/REQUEST_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Monitoring

### CloudWatch Dashboards

Access the monitoring dashboard:

1. Go to CloudWatch Console
2. Navigate to Dashboards
3. Open "VeritasOnboard-Dashboard"

Metrics include:
- API Gateway request count and latency
- Lambda invocations and errors
- Step Functions execution metrics
- DynamoDB read/write capacity

### CloudWatch Alarms

The system includes pre-configured alarms:

- **Critical** (triggers SNS notification):
  - API Gateway 5XX error rate > 1% for 5 minutes
  - Step Functions execution failure rate > 5% for 5 minutes
  - Lambda error rate > 5% for 5 minutes

- **Warning**:
  - API Gateway latency p99 > 2000ms for 10 minutes
  - DynamoDB throttling events detected

### X-Ray Tracing

View distributed traces:

1. Go to X-Ray Console
2. Select "Service Map" to see request flow
3. Select "Traces" to view individual requests
4. Filter by error status or latency

### Logs

Access logs in CloudWatch Logs:

- `/aws/lambda/VeritasOnboard-StartWorkflow`
- `/aws/lambda/VeritasOnboard-RedactPII`
- `/aws/lambda/VeritasOnboard-FraudDetector`
- `/aws/lambda/VeritasOnboard-Comprehend`
- `/aws/lambda/VeritasOnboard-CombineScores`
- `/aws/lambda/VeritasOnboard-SaveDynamo`
- `/aws/lambda/VeritasOnboard-NotifyAdmin`
- `/aws/apigateway/VeritasOnboard-API`

## Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Error

**Error**: `This stack uses assets, so the toolkit stack must be deployed to the environment`

**Solution**:
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### 2. Fraud Detector Not Found

**Error**: `ResourceNotFoundException: Detector 'veritas_onboard_detector' not found`

**Solution**:
- Run the Fraud Detector setup script:
  ```bash
  cd lambda/fraud-detector
  ./setup-fraud-detector.sh
  ```
- Or follow manual setup in `lambda/fraud-detector/SETUP.md`
- Ensure Fraud Detector is available in your region

#### 3. Lambda Timeout

**Error**: Lambda function times out during execution

**Solution**:
- Check CloudWatch Logs for the specific Lambda
- Increase timeout in the CDK stack definition (lib/workflow-stack.ts)
- Verify external service (Fraud Detector, Comprehend) is responding

#### 4. DynamoDB Throttling

**Error**: `ProvisionedThroughputExceededException`

**Solution**:
- The table uses on-demand billing, so this shouldn't occur
- If it does, check for excessive request rates
- Review CloudWatch metrics for unusual patterns

#### 5. API Gateway 401 Unauthorized

**Error**: API returns 401 when calling endpoints

**Solution**:
- Verify JWT token is valid and not expired
- Check Cognito User Pool ID and Client ID in frontend config
- Ensure user is authenticated before making API calls
- Verify Authorization header format: `Bearer <token>`

#### 6. SNS Notifications Not Received

**Error**: Admin doesn't receive email notifications

**Solution**:
- Verify SNS subscription is confirmed (check email)
- Check SNS topic permissions
- Review CloudWatch Logs for notify-admin Lambda
- Verify email address is correct

#### 7. Frontend Build Errors

**Error**: Next.js build fails

**Solution**:
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run build
```

#### 8. Step Functions Execution Failed

**Error**: State machine execution shows failed status

**Solution**:
- Open the failed execution in Step Functions Console
- Click on the failed state to see error details
- Check CloudWatch Logs for the corresponding Lambda
- Review X-Ray trace for the execution
- Common causes:
  - Missing IAM permissions
  - Invalid input data format
  - External service unavailable

#### 9. PII Not Being Redacted

**Error**: Sensitive data appears in DynamoDB

**Solution**:
- Verify redact-pii Lambda is executing successfully
- Check regex patterns in `lambda/redact-pii/lambda_function.py`
- Review CloudWatch Logs for redaction errors
- Test PII detection with known patterns

#### 10. High Risk Scores for Legitimate Requests

**Error**: Valid requests are being routed to manual review

**Solution**:
- Review Fraud Detector model configuration
- Check Comprehend sentiment analysis results
- Adjust risk score weights in combine-scores Lambda
- Consider adjusting the 0.8 threshold in Step Functions state machine
- Train Fraud Detector model with more data

### Getting Help

If you encounter issues not covered here:

1. Check CloudWatch Logs for detailed error messages
2. Review X-Ray traces for request flow
3. Consult AWS service documentation:
   - [AWS CDK](https://docs.aws.amazon.com/cdk/)
   - [AWS Lambda](https://docs.aws.amazon.com/lambda/)
   - [AWS Step Functions](https://docs.aws.amazon.com/step-functions/)
   - [Amazon Fraud Detector](https://docs.aws.amazon.com/frauddetector/)
   - [Amazon Comprehend](https://docs.aws.amazon.com/comprehend/)
4. Review the design document: `.kiro/specs/veritas-onboard/design.md`

## Development

### Local Development

Build TypeScript code:
```bash
npm run build
```

Watch mode for development:
```bash
npm run watch
```

Synthesize CloudFormation templates (without deploying):
```bash
cdk synth
```

Compare deployed stack with current code:
```bash
cdk diff
```

### Frontend Development

Run Next.js development server:
```bash
cd frontend
npm install
npm run dev
```

Access at `http://localhost:3000`

### Testing Lambda Functions Locally

Use AWS SAM Local or LocalStack for local testing:

```bash
# Install SAM CLI
pip install aws-sam-cli

# Invoke Lambda locally
sam local invoke RedactPIIFunction -e test-event.json
```

### Code Quality

Run linters:
```bash
# TypeScript
npx eslint lib/**/*.ts

# Python
cd lambda/redact-pii
pylint lambda_function.py
```

## Cleanup

### Remove All Resources

To delete all deployed resources:

```bash
npm run destroy
```

Or use CDK directly:

```bash
cdk destroy --all
```

**Warning**: This will delete:
- All Lambda functions
- Step Functions state machine
- DynamoDB table (and all data)
- API Gateway
- Cognito User Pool (and all users)
- SNS topics
- CloudWatch Logs (after retention period)

### Selective Cleanup

Destroy specific stacks:

```bash
cdk destroy VeritasOnboardApiStack
cdk destroy VeritasOnboardWorkflowStack
```

### Manual Cleanup

Some resources may need manual deletion:

1. **Fraud Detector Resources**:
   ```bash
   aws frauddetector delete-detector --detector-id veritas_onboard_detector
   aws frauddetector delete-event-type --name onboarding_request
   ```

2. **CloudWatch Log Groups** (if retention is set to never expire):
   - Delete via AWS Console or CLI

3. **S3 Buckets** (CDK bootstrap bucket):
   - Must be emptied before deletion

## Documentation

### Project Documentation

- [Requirements Document](.kiro/specs/veritas-onboard/requirements.md) - Detailed requirements and acceptance criteria
- [Design Document](.kiro/specs/veritas-onboard/design.md) - Architecture and technical design
- [Implementation Tasks](.kiro/specs/veritas-onboard/tasks.md) - Task breakdown and progress tracking

### Component-Specific Documentation

- [Fraud Detector Setup](lambda/fraud-detector/SETUP.md) - Manual Fraud Detector configuration
- [Fraud Detector Testing](lambda/fraud-detector/TESTING.md) - Testing guide for fraud detection
- [QuickSight Setup](lambda/query-status/QUICKSIGHT_SETUP.md) - Dashboard configuration
- [Frontend Setup](frontend/SETUP.md) - Frontend configuration and development

### AWS Service Documentation

- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/)
- [Amazon Fraud Detector User Guide](https://docs.aws.amazon.com/frauddetector/)
- [Amazon Comprehend Developer Guide](https://docs.aws.amazon.com/comprehend/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
- [Amazon API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/)
- [Amazon Cognito Developer Guide](https://docs.aws.amazon.com/cognito/)

## Cost Estimation

Estimated monthly costs for 1,000 requests/day (~30,000/month):

| Service | Cost |
|---------|------|
| API Gateway | ~$3.50 |
| Lambda | ~$5.00 |
| Step Functions | ~$25.00 |
| DynamoDB | ~$2.50 |
| Fraud Detector | ~$75.00 |
| Comprehend | ~$15.00 |
| Cognito | Free tier |
| Amplify | ~$15.00 |
| QuickSight | ~$24.00 |
| **Total** | **~$165/month** |

Costs scale with usage. Monitor via AWS Cost Explorer.

## Security

### Best Practices

- All API calls use HTTPS/TLS 1.2+
- JWT tokens for authentication
- IAM roles follow least-privilege principle
- PII is automatically redacted before storage
- WAF protects against common attacks
- All data encrypted at rest and in transit
- CloudWatch Logs for audit trail

### Compliance

- **GDPR**: PII redaction, audit trail, right to erasure (implement delete API)
- **SOC 2**: Access logging, security monitoring, audit trail
- **PCI DSS**: Credit card number masking

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- Open an issue in the repository
- Contact the development team
- Review the troubleshooting section above

---

**Version**: 1.0.0  
**Last Updated**: November 2024
