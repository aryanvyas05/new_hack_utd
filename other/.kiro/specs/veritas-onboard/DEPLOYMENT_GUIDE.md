# Veritas Onboard - Deployment and Testing Guide

This guide provides step-by-step instructions for deploying and validating the complete Veritas Onboard system.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Steps](#deployment-steps)
3. [Post-Deployment Verification](#post-deployment-verification)
4. [End-to-End Testing](#end-to-end-testing)
5. [Security Validation](#security-validation)
6. [Monitoring Verification](#monitoring-verification)
7. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] AWS CLI configured with appropriate credentials
- [ ] Node.js 18.x or later installed
- [ ] Python 3.12 or later installed
- [ ] AWS CDK CLI installed (`npm install -g aws-cdk`)
- [ ] AWS account bootstrapped for CDK (`cdk bootstrap`)
- [ ] Sufficient IAM permissions to create all required resources
- [ ] Fraud Detector available in your target region

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be v18.x or higher

# Check Python version
python3 --version  # Should be 3.12 or higher

# Check AWS CLI
aws --version

# Check AWS credentials
aws sts get-caller-identity

# Check CDK CLI
cdk --version  # Should be 2.110.0 or higher
```

## Deployment Steps

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository (if not already done)
cd veritas-onboard

# Install Node.js dependencies
npm install

# Build TypeScript code
npm run build
```

### Step 2: Bootstrap CDK (First Time Only)

```bash
# Get your AWS account ID and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

# Bootstrap CDK
cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
```

### Step 3: Set Up Fraud Detector

```bash
# Navigate to fraud detector setup
cd lambda/fraud-detector

# Make setup script executable
chmod +x setup-fraud-detector.sh

# Run setup script
./setup-fraud-detector.sh

# Return to project root
cd ../..
```

**Note**: This creates the Fraud Detector event type, variables, and detector. See `lambda/fraud-detector/SETUP.md` for manual setup instructions.

### Step 4: Deploy All Stacks

**Option A: Using the Deployment Script (Recommended)**

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

The script will:
- Validate prerequisites
- Build the project
- Check Fraud Detector setup
- Deploy all CDK stacks
- Display outputs
- Offer to configure frontend automatically

**Option B: Manual CDK Deployment**

```bash
# Synthesize CloudFormation templates (optional, for review)
cdk synth

# Deploy all stacks
cdk deploy --all

# Or deploy to a specific environment
cdk deploy --all --context environment=prod
```

### Step 5: Note the Deployment Outputs

After deployment, save the following outputs:

```
API Endpoint: https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
User Pool ID: us-east-1_xxxxxxxxx
User Pool Client ID: xxxxxxxxxxxxxxxxxxxxxxxxxx
DynamoDB Table: OnboardingRequests
State Machine ARN: arn:aws:states:us-east-1:123456789012:stateMachine:veritas-onboard-workflow
SNS Topic ARN: arn:aws:sns:us-east-1:123456789012:veritas-onboard-admin-notifications
```

These are also saved to `deployment-outputs.txt` by the deployment script.

## Post-Deployment Verification

### Verify Stack Creation

Check that all stacks were created successfully:

```bash
# List all CloudFormation stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?contains(StackName, 'veritas-onboard')].StackName" \
  --output table
```

Expected stacks:
- `veritas-onboard-dev-database`
- `veritas-onboard-dev-workflow`
- `veritas-onboard-dev-amplify`
- `veritas-onboard-dev-api`
- `veritas-onboard-dev-monitoring`

### Verify CloudFormation Outputs

```bash
# Get all outputs from all stacks
for stack in veritas-onboard-dev-database veritas-onboard-dev-workflow veritas-onboard-dev-amplify veritas-onboard-dev-api veritas-onboard-dev-monitoring; do
  echo "=== $stack ==="
  aws cloudformation describe-stacks \
    --stack-name $stack \
    --query 'Stacks[0].Outputs' \
    --output table
  echo ""
done
```

### Verify Resources in AWS Console

1. **DynamoDB**:
   - Go to DynamoDB Console
   - Verify `OnboardingRequests` table exists
   - Check that `StatusIndex` GSI is created
   - Verify point-in-time recovery is enabled

2. **Lambda Functions**:
   - Go to Lambda Console
   - Verify all 9 Lambda functions exist:
     - `veritas-onboard-start-workflow`
     - `veritas-onboard-redact-pii`
     - `veritas-onboard-fraud-detector`
     - `veritas-onboard-comprehend`
     - `veritas-onboard-combine-scores`
     - `veritas-onboard-save-dynamo`
     - `veritas-onboard-notify-admin`
     - `veritas-onboard-query-status`
     - `veritas-onboard-quicksight-data`

3. **Step Functions**:
   - Go to Step Functions Console
   - Verify `veritas-onboard-workflow` state machine exists
   - Check the visual workflow diagram

4. **API Gateway**:
   - Go to API Gateway Console
   - Verify `Veritas Onboard API` exists
   - Check that endpoints are configured:
     - `POST /onboard`
     - `GET /status/{requestId}`
     - `GET /analytics`

5. **Cognito**:
   - Go to Cognito Console
   - Verify User Pool exists
   - Check password policy settings
   - Verify App Client is configured

6. **WAF**:
   - Go to WAF & Shield Console
   - Verify `veritas-onboard-api-waf` WebACL exists
   - Check that rules are configured

7. **SNS**:
   - Go to SNS Console
   - Verify `veritas-onboard-admin-notifications` topic exists

8. **CloudWatch**:
   - Go to CloudWatch Console
   - Check that alarms are created
   - Verify log groups exist for all Lambda functions

### Configure Frontend

**Option A: Automatic Configuration**

```bash
# Run the configuration script
./scripts/configure-frontend.sh

# Or for a specific environment
./scripts/configure-frontend.sh prod
```

**Option B: Manual Configuration**

```bash
cd frontend
cp .env.local.example .env.local

# Edit .env.local with the values from deployment outputs
# NEXT_PUBLIC_API_ENDPOINT=...
# NEXT_PUBLIC_USER_POOL_ID=...
# NEXT_PUBLIC_USER_POOL_CLIENT_ID=...
# NEXT_PUBLIC_AWS_REGION=...
```

### Subscribe to Admin Notifications

```bash
# Replace with your email address
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:veritas-onboard-admin-notifications \
  --protocol email \
  --notification-endpoint admin@example.com

# Check your email and confirm the subscription
```

### Create Test User

```bash
# Get User Pool ID from outputs
USER_POOL_ID="us-east-1_xxxxxxxxx"

# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password TestPassword123! \
  --permanent
```

## End-to-End Testing

### Test 1: Low-Risk Onboarding Request (Auto-Approve)

#### 1.1 Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Access at `http://localhost:3000`

#### 1.2 Sign In

- Navigate to `http://localhost:3000`
- Sign in with test user credentials:
  - Email: `testuser@example.com`
  - Password: `TestPassword123!`

#### 1.3 Submit Low-Risk Request

Navigate to `/onboard` and submit:

```json
{
  "vendorName": "Acme Corporation",
  "contactEmail": "contact@acme.com",
  "businessDescription": "We provide excellent software solutions for businesses. Our team is dedicated to delivering high-quality products.",
  "taxId": "12-3456789"
}
```

#### 1.4 Verify Execution

1. **Note the Request ID** from the response

2. **Check Step Functions**:
   ```bash
   # List recent executions
   aws stepfunctions list-executions \
     --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:veritas-onboard-workflow \
     --max-results 5
   ```

3. **Verify in Console**:
   - Go to Step Functions Console
   - Open the execution
   - Verify all steps completed successfully
   - Check that it went through the "AutoApprove" path

4. **Check DynamoDB**:
   ```bash
   # Query the record
   aws dynamodb get-item \
     --table-name OnboardingRequests \
     --key '{"requestId": {"S": "YOUR_REQUEST_ID"}}'
   ```

   Verify:
   - Status is `APPROVED`
   - Risk scores are present
   - PII is redacted (email should be masked)
   - Audit trail is complete

5. **Check CloudWatch Logs**:
   ```bash
   # View logs for each Lambda
   aws logs tail /aws/lambda/veritas-onboard-redact-pii --follow
   aws logs tail /aws/lambda/veritas-onboard-fraud-detector --follow
   aws logs tail /aws/lambda/veritas-onboard-comprehend --follow
   ```

### Test 2: High-Risk Onboarding Request (Manual Review)

#### 2.1 Submit High-Risk Request

Submit through the frontend:

```json
{
  "vendorName": "Suspicious Vendor LLC",
  "contactEmail": "test@suspicious-domain.xyz",
  "businessDescription": "Offshore shell company for money laundering operations. We handle high-risk transactions.",
  "taxId": "98-7654321"
}
```

#### 2.2 Verify Execution

1. **Check Step Functions**:
   - Verify execution completed successfully
   - Check that it went through the "ManualReview" path
   - Verify "NotifyAdmin" step executed

2. **Check Email Notification**:
   - Admin should receive an email notification
   - Email should contain:
     - Request ID
     - Vendor name
     - Combined risk score
     - Timestamp

3. **Check DynamoDB**:
   ```bash
   aws dynamodb get-item \
     --table-name OnboardingRequests \
     --key '{"requestId": {"S": "YOUR_REQUEST_ID"}}'
   ```

   Verify:
   - Status is `MANUAL_REVIEW`
   - Combined risk score > 0.8
   - Fraud score and content risk score are present

4. **Check SNS**:
   ```bash
   # View SNS topic metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/SNS \
     --metric-name NumberOfMessagesPublished \
     --dimensions Name=TopicName,Value=veritas-onboard-admin-notifications \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 3600 \
     --statistics Sum
   ```

### Test 3: Status Query

#### 3.1 Query via Frontend

- Navigate to `/status/YOUR_REQUEST_ID`
- Verify status is displayed correctly
- Check that risk scores are shown

#### 3.2 Query via API

```bash
# Get JWT token (you'll need to extract this from the browser)
TOKEN="your-jwt-token"

# Query status
curl -X GET "https://your-api-endpoint/prod/status/YOUR_REQUEST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Test 4: PII Redaction

Verify that PII is properly redacted:

```bash
# Submit a request with PII
# Then check DynamoDB record

aws dynamodb get-item \
  --table-name OnboardingRequests \
  --key '{"requestId": {"S": "YOUR_REQUEST_ID"}}' \
  --query 'Item.contactEmail.S'
```

Expected: Email should be masked (e.g., `c***@example.com`)

## Security Validation

### Test 1: Unauthorized API Access

```bash
# Try to access API without JWT token
curl -X POST "https://your-api-endpoint/prod/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test",
    "contactEmail": "test@example.com",
    "businessDescription": "Test",
    "taxId": "12-3456789"
  }'
```

Expected: `401 Unauthorized`

### Test 2: SQL Injection Protection

```bash
# Try SQL injection in form field
TOKEN="your-jwt-token"

curl -X POST "https://your-api-endpoint/prod/onboard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test'; DROP TABLE users; --",
    "contactEmail": "test@example.com",
    "businessDescription": "Test",
    "taxId": "12-3456789"
  }'
```

Expected: `403 Forbidden` (blocked by WAF)

### Test 3: Rate Limiting

```bash
# Send 101 requests rapidly
TOKEN="your-jwt-token"

for i in {1..101}; do
  curl -X POST "https://your-api-endpoint/prod/onboard" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "vendorName": "Test",
      "contactEmail": "test@example.com",
      "businessDescription": "Test",
      "taxId": "12-3456789"
    }' &
done
wait
```

Expected: Some requests should return `429 Too Many Requests`

### Test 4: IAM Role Permissions

Verify least-privilege access:

```bash
# Check Lambda execution role policies
aws iam list-attached-role-policies \
  --role-name veritas-onboard-dev-workflow-RedactPiiFunctionServiceRole

# Check inline policies
aws iam list-role-policies \
  --role-name veritas-onboard-dev-workflow-RedactPiiFunctionServiceRole
```

Verify:
- Redact PII Lambda only has CloudWatch Logs permissions
- Fraud Detector Lambda only has Fraud Detector read permissions
- Save Dynamo Lambda only has DynamoDB write to specific table

## Monitoring Verification

### Test 1: CloudWatch Logs

```bash
# Check that logs are being created
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/veritas-onboard

# View recent logs
aws logs tail /aws/lambda/veritas-onboard-start-workflow --since 1h
```

### Test 2: X-Ray Traces

1. Go to X-Ray Console
2. Select "Service Map"
3. Verify you can see:
   - API Gateway
   - Lambda functions
   - DynamoDB
   - Step Functions

4. Select "Traces"
5. Find a recent trace
6. Verify complete request flow is visible

### Test 3: CloudWatch Alarms

Trigger an alarm to verify notifications:

```bash
# Simulate errors by invoking Lambda with invalid input
aws lambda invoke \
  --function-name veritas-onboard-start-workflow \
  --payload '{"invalid": "data"}' \
  response.json

# Repeat multiple times to trigger alarm threshold
for i in {1..10}; do
  aws lambda invoke \
    --function-name veritas-onboard-start-workflow \
    --payload '{"invalid": "data"}' \
    response.json
done
```

Check:
- CloudWatch alarm should transition to ALARM state
- SNS notification should be sent

### Test 4: Metrics

View metrics in CloudWatch Console:

1. **API Gateway Metrics**:
   - Request count
   - Latency (p50, p99)
   - 4XX and 5XX errors

2. **Lambda Metrics**:
   - Invocations
   - Duration
   - Errors
   - Throttles

3. **Step Functions Metrics**:
   - Executions started
   - Executions succeeded
   - Executions failed
   - Execution time

4. **DynamoDB Metrics**:
   - Consumed read/write capacity
   - Throttled requests
   - User errors

## Troubleshooting

### Issue: Stack Deployment Fails

**Check**:
```bash
# View stack events
aws cloudformation describe-stack-events \
  --stack-name veritas-onboard-dev-workflow \
  --max-items 20
```

**Common Causes**:
- Insufficient IAM permissions
- Resource limits exceeded
- Fraud Detector not configured
- CDK not bootstrapped

### Issue: Lambda Function Fails

**Check**:
```bash
# View Lambda logs
aws logs tail /aws/lambda/FUNCTION_NAME --follow

# Check Lambda configuration
aws lambda get-function --function-name FUNCTION_NAME
```

**Common Causes**:
- Missing environment variables
- IAM role lacks permissions
- Timeout too short
- External service unavailable

### Issue: Step Functions Execution Fails

**Check**:
1. Go to Step Functions Console
2. Open the failed execution
3. Click on the failed state
4. Review error message and cause

**Common Causes**:
- Lambda function error
- Invalid input format
- Timeout exceeded
- IAM permissions issue

### Issue: API Returns 401

**Check**:
- JWT token is valid and not expired
- Token is in correct format: `Bearer <token>`
- Cognito User Pool ID is correct in frontend config
- User is authenticated

### Issue: No SNS Notifications

**Check**:
```bash
# Verify subscription is confirmed
aws sns list-subscriptions-by-topic \
  --topic-arn YOUR_TOPIC_ARN

# Check Lambda logs for notify-admin
aws logs tail /aws/lambda/veritas-onboard-notify-admin --follow
```

**Common Causes**:
- Subscription not confirmed
- Email in spam folder
- Lambda lacks SNS publish permission
- Topic ARN incorrect

## Cleanup

To remove all deployed resources:

```bash
# Destroy all stacks
cdk destroy --all

# Or use npm script
npm run destroy
```

**Warning**: This will delete all data in DynamoDB and remove all resources.

## Next Steps

After successful deployment and testing:

1. **Set Up QuickSight Dashboard**:
   - Follow `lambda/query-status/QUICKSIGHT_SETUP.md`

2. **Configure Production Environment**:
   - Update `cdk.json` with production account/region
   - Deploy to production: `cdk deploy --all --context environment=prod`

3. **Set Up CI/CD Pipeline**:
   - Configure GitHub Actions or AWS CodePipeline
   - Automate testing and deployment

4. **Monitor and Optimize**:
   - Review CloudWatch metrics regularly
   - Adjust Lambda memory/timeout based on actual usage
   - Optimize DynamoDB capacity if needed

5. **Train Fraud Detector Model**:
   - Collect real onboarding data
   - Train custom model with historical data
   - Update detector configuration

## Support

For issues or questions:
- Review CloudWatch Logs for detailed error messages
- Check X-Ray traces for request flow
- Consult AWS service documentation
- Review the design document: `.kiro/specs/veritas-onboard/design.md`

---

**Last Updated**: November 2024
