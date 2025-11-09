# Deploy Veritas Onboard via AWS Management Console

This guide walks you through deploying the entire Veritas Onboard platform using AWS CloudShell (no local AWS CLI needed).

## Prerequisites

- AWS Account with admin access
- Access to AWS Management Console
- Credit card on file (for AWS charges ~$165/month)

## Step-by-Step Deployment

### Step 1: Prepare Your Project for Upload

First, create a deployment package on your local machine:

```bash
# Create a clean deployment package
cd ~/new_hack_utd

# Create a zip file (excluding node_modules and other large files)
zip -r veritas-onboard-deploy.zip . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "frontend/node_modules/*" \
  -x "frontend/.next/*" \
  -x "cdk.out/*" \
  -x "*.zip"

# This creates: veritas-onboard-deploy.zip (~5-10 MB)
```

### Step 2: Open AWS CloudShell

1. **Sign in to AWS Console**: https://console.aws.amazon.com/
2. **Open CloudShell**: 
   - Click the CloudShell icon (>_) in the top navigation bar
   - Or search for "CloudShell" in the services search
3. **Wait for CloudShell to initialize** (takes ~30 seconds)

### Step 3: Upload Your Project to CloudShell

In CloudShell:

1. **Click "Actions" → "Upload file"**
2. **Select** `veritas-onboard-deploy.zip`
3. **Wait for upload** to complete (may take 1-2 minutes)

### Step 4: Extract and Prepare

In the CloudShell terminal, run:

```bash
# Extract the project
unzip veritas-onboard-deploy.zip -d veritas-onboard
cd veritas-onboard

# Verify files
ls -la

# Install Node.js dependencies
npm install

# Build the CDK project
npm run build
```

### Step 5: Bootstrap CDK (First Time Only)

```bash
# Get your AWS account ID and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

echo "Account: $AWS_ACCOUNT"
echo "Region: $AWS_REGION"

# Bootstrap CDK (only needed once per account/region)
npx cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
```

**Expected output**: "✅ Environment aws://ACCOUNT/REGION bootstrapped"

### Step 6: Set Up Fraud Detector

```bash
# Navigate to fraud detector setup
cd lambda/fraud-detector

# Make script executable
chmod +x setup-fraud-detector.sh

# Run setup
./setup-fraud-detector.sh

# Return to project root
cd ../..
```

**Expected output**: Fraud Detector resources created successfully

**Note**: If this fails, you can set up Fraud Detector manually (see Step 6b below)

### Step 6b: Manual Fraud Detector Setup (If Script Fails)

If the automated script fails, set up manually:

1. **Go to Fraud Detector Console**: https://console.aws.amazon.com/frauddetector/
2. **Create Variables**:
   - Click "Variables" → "Create variable"
   - Create these 3 variables:
     - `email_address` (Type: EMAIL_ADDRESS)
     - `ip_address` (Type: IP_ADDRESS)
     - `account_name` (Type: FREE_FORM_TEXT)

3. **Create Entity Type**:
   - Click "Entity types" → "Create entity type"
   - Name: `customer`

4. **Create Event Type**:
   - Click "Event types" → "Create event type"
   - Name: `onboarding_request`
   - Entity type: `customer`
   - Event variables: Select all 3 variables created above

5. **Create Detector**:
   - Click "Detectors" → "Create detector"
   - Name: `veritas_onboard_detector`
   - Event type: `onboarding_request`
   - Model: Select "Online Fraud Insights for new account fraud"
   - Follow wizard to complete setup

### Step 7: Deploy All CDK Stacks

```bash
# Deploy all stacks (takes 10-15 minutes)
npx cdk deploy --all --require-approval never

# Or deploy with verbose output
npx cdk deploy --all --require-approval never --verbose
```

**What's being deployed**:
- ✅ Database Stack (DynamoDB table)
- ✅ Workflow Stack (Step Functions + 6 Lambda functions)
- ✅ Amplify Stack (Cognito User Pool)
- ✅ API Stack (API Gateway + WAF + 3 Lambda functions)
- ✅ Monitoring Stack (CloudWatch alarms)

**Expected time**: 10-15 minutes

**Watch for**: CloudFormation stack creation progress in the output

### Step 8: Save the Deployment Outputs

After deployment completes, you'll see outputs like:

```
Outputs:
veritas-onboard-dev-api.ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/prod
veritas-onboard-dev-amplify.UserPoolId = us-east-1_ABC123
veritas-onboard-dev-amplify.UserPoolClientId = 1234567890abcdef
veritas-onboard-dev-workflow.AdminNotificationTopicArn = arn:aws:sns:us-east-1:123456789012:...
veritas-onboard-dev-database.TableName = OnboardingRequests
```

**IMPORTANT**: Copy these values! You'll need them for the next steps.

### Step 9: Subscribe to Admin Notifications

```bash
# Replace with your email address
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:veritas-onboard-admin-notifications \
  --protocol email \
  --notification-endpoint your-email@example.com
```

**Then**: Check your email and click the confirmation link

### Step 10: Create a Test User

```bash
# Replace USER_POOL_ID with the value from Step 8
USER_POOL_ID="us-east-1_ABC123"

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

**Test credentials**:
- Email: `testuser@example.com`
- Password: `TestPassword123!`

### Step 11: Test the API (Optional - Verify Deployment)

```bash
# Test the API endpoint (should return 401 without auth)
API_ENDPOINT="https://abc123.execute-api.us-east-1.amazonaws.com/prod"

curl -X POST $API_ENDPOINT/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test Corp",
    "contactEmail": "test@example.com",
    "businessDescription": "Test business",
    "taxId": "12-3456789"
  }'
```

**Expected**: `{"message":"Unauthorized"}` (this is correct - you need a JWT token)

### Step 12: Configure Frontend (On Your Local Machine)

Back on your local machine:

```bash
cd ~/new_hack_utd

# Create frontend environment file
cat > frontend/.env.local << EOF
# AWS Configuration from CloudFormation Outputs
NEXT_PUBLIC_API_ENDPOINT=https://abc123.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_USER_POOL_ID=us-east-1_ABC123
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1234567890abcdef
NEXT_PUBLIC_AWS_REGION=us-east-1
EOF

# Install frontend dependencies
cd frontend
npm install

# Run the frontend
npm run dev
```

**Access**: http://localhost:3000

### Step 13: Test End-to-End

1. **Open browser**: http://localhost:3000
2. **Sign in**: 
   - Email: `testuser@example.com`
   - Password: `TestPassword123!`

3. **Submit Low-Risk Request**:
   - Vendor Name: "Acme Corporation"
   - Contact Email: "contact@acme.com"
   - Business Description: "We provide excellent software solutions for businesses"
   - Tax ID: "12-3456789"
   - **Expected**: Status = APPROVED ✅

4. **Submit High-Risk Request**:
   - Vendor Name: "Suspicious Vendor LLC"
   - Contact Email: "test@suspicious-domain.xyz"
   - Business Description: "Offshore money laundering operations"
   - Tax ID: "98-7654321"
   - **Expected**: Status = MANUAL_REVIEW + Email notification 📧

5. **Check Status**: Navigate to `/status/REQUEST_ID` to see the result

## Verification Checklist

After deployment, verify in AWS Console:

### ✅ DynamoDB
- Go to: https://console.aws.amazon.com/dynamodb/
- Verify: `OnboardingRequests` table exists
- Check: `StatusIndex` GSI is present

### ✅ Lambda Functions
- Go to: https://console.aws.amazon.com/lambda/
- Verify: 9 functions exist (all starting with `veritas-onboard-`)

### ✅ Step Functions
- Go to: https://console.aws.amazon.com/states/
- Verify: `veritas-onboard-workflow` state machine exists
- Check: Visual workflow shows all 6 steps

### ✅ API Gateway
- Go to: https://console.aws.amazon.com/apigateway/
- Verify: `Veritas Onboard API` exists
- Check: 3 endpoints configured

### ✅ Cognito
- Go to: https://console.aws.amazon.com/cognito/
- Verify: User Pool exists
- Check: Test user is created

### ✅ CloudWatch
- Go to: https://console.aws.amazon.com/cloudwatch/
- Check: Alarms are created
- Verify: Log groups exist for all Lambda functions

## Troubleshooting

### Issue: CDK Bootstrap Fails

**Error**: "Unable to resolve AWS account"

**Solution**:
```bash
# Verify AWS credentials
aws sts get-caller-identity

# If this fails, CloudShell may need to be restarted
# Close and reopen CloudShell
```

### Issue: Fraud Detector Setup Fails

**Error**: "Fraud Detector not available in region"

**Solution**: Fraud Detector is only available in these regions:
- us-east-1 (N. Virginia)
- us-west-2 (Oregon)
- eu-west-1 (Ireland)
- ap-southeast-1 (Singapore)
- ap-southeast-2 (Sydney)

Switch to one of these regions and redeploy.

### Issue: CDK Deploy Fails

**Error**: "Stack creation failed"

**Solution**:
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name veritas-onboard-dev-workflow \
  --max-items 20

# View detailed error messages
```

### Issue: Lambda Function Errors

**Error**: "Function execution failed"

**Solution**:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/veritas-onboard-start-workflow --follow

# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/veritas-onboard-start-workflow \
  --filter-pattern "ERROR"
```

### Issue: Frontend Can't Connect

**Error**: "Network error" or "401 Unauthorized"

**Solution**:
1. Verify API endpoint in `.env.local` is correct
2. Verify Cognito User Pool ID and Client ID are correct
3. Check that you're signed in
4. Verify JWT token is being sent in Authorization header

## Cost Management

### Monitor Costs

1. **Go to AWS Cost Explorer**: https://console.aws.amazon.com/cost-management/
2. **Set up billing alerts**:
   - Go to CloudWatch → Alarms
   - Create billing alarm for $200/month threshold

### Estimated Monthly Costs (30,000 requests)

| Service | Cost |
|---------|------|
| API Gateway | $3.50 |
| Lambda | $5.00 |
| Step Functions | $25.00 |
| DynamoDB | $2.50 |
| Fraud Detector | $75.00 |
| Comprehend | $15.00 |
| Cognito | Free |
| CloudWatch | $5.00 |
| **Total** | **~$131/month** |

### Clean Up (When Done Testing)

To avoid ongoing charges:

```bash
# In CloudShell
cd veritas-onboard

# Destroy all stacks
npx cdk destroy --all

# Confirm when prompted
```

**Warning**: This deletes all data and resources!

## Next Steps

After successful deployment:

1. **Set Up QuickSight Dashboard**:
   - See: `lambda/query-status/QUICKSIGHT_SETUP.md`

2. **Configure Production Environment**:
   - Update `cdk.json` with production settings
   - Deploy to production account

3. **Set Up CI/CD**:
   - Configure GitHub Actions
   - Automate deployments

4. **Train Fraud Detector Model**:
   - Collect real data
   - Train custom model
   - Improve accuracy

## Support

- **Documentation**: See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting
- **AWS Support**: https://console.aws.amazon.com/support/
- **CloudWatch Logs**: Check for detailed error messages

---

**Deployment Time**: ~20-30 minutes total
**Difficulty**: Intermediate
**Cost**: ~$131/month for 30,000 requests

Good luck! 🚀
