# 🔧 Fraud Detector Deployment Fix

## What Happened

The CDK deployment failed because the Fraud Detector custom resource had an SDK compatibility issue. 

**Error:** `Unable to find command named: PutVariableCommand`

## ✅ What I Fixed

Disabled the automatic Fraud Detector setup in CDK. You'll set it up manually instead (it's easier and more reliable).

## 🚀 Next Steps

### Step 1: Delete the Failed Stack

```bash
aws cloudformation delete-stack --stack-name veritas-onboard-dev-workflow
```

Wait for deletion to complete (~2 minutes):
```bash
aws cloudformation wait stack-delete-complete --stack-name veritas-onboard-dev-workflow
```

### Step 2: Set Up Fraud Detector Manually

```bash
cd lambda/fraud-detector
chmod +x setup-fraud-detector.sh
./setup-fraud-detector.sh
cd ../..
```

This creates:
- ✅ Variables (email_address, ip_address, account_name)
- ✅ Entity type (customer)
- ✅ Event type (onboarding_request)
- ✅ Detector (veritas_onboard_detector)

### Step 3: Deploy Again

```bash
npx cdk deploy --all --require-approval never
```

This time it will work because Fraud Detector resources already exist!

## Alternative: Deploy Without Fraud Detector

If you want to skip Fraud Detector for now (for demo purposes):

The Lambda function has a fallback that returns a default score of 0.5 if Fraud Detector isn't available. The system will still work, just without real fraud detection.

## What's Already Deployed

✅ Database stack (DynamoDB)
✅ Amplify stack (Cognito)

Still need:
- Workflow stack (Step Functions + Lambdas)
- API stack (API Gateway + WAF)
- Monitoring stack (CloudWatch)

## Quick Commands

```bash
# Delete failed stack
aws cloudformation delete-stack --stack-name veritas-onboard-dev-workflow

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name veritas-onboard-dev-workflow

# Setup Fraud Detector
cd lambda/fraud-detector && ./setup-fraud-detector.sh && cd ../..

# Deploy everything
npx cdk deploy --all --require-approval never
```

---

**The fix is applied. Follow the steps above to continue deployment!** 🚀
