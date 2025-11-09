# 🚀 START YOUR DEMO NOW

## Everything is READY! Here's what to do:

### 1. Test Backend (30 seconds)
```bash
./test-workflow.sh
```
✅ Should show: Request APPROVED with risk scores

### 2. Start Frontend (1 minute)
```bash
cd frontend
npm run dev
```
✅ Opens at: http://localhost:3000

### 3. Create Test User (2 minutes)
Go to: https://console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_hIBE2rCam/users

Click "Create user":
- Username: `demo@example.com`
- Email: `demo@example.com`  
- Password: `DemoPass123!`
- Uncheck "Send invitation"

### 4. Test the App (2 minutes)
1. Go to http://localhost:3000
2. Fill out onboarding form:
   - Vendor Name: Acme Corp
   - Email: test@acme.com
   - Description: We provide software solutions
   - Tax ID: 12-3456789
3. Submit
4. See status page with results!

### 5. Open AWS Console Tabs for Demo
- Step Functions: https://console.aws.amazon.com/states/home?region=us-east-1#/statemachines
- DynamoDB: https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#table?name=OnboardingRequests
- CloudWatch: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards
- Cognito: https://console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_hIBE2rCam

## 🎬 Demo Flow (5 minutes)

1. **Show Frontend** (30s)
   - "This is our vendor onboarding portal"
   - Fill form, submit

2. **Show AWS Processing** (2m)
   - Open Step Functions
   - Show workflow executing
   - Explain: PII redaction → Fraud detection → Risk scoring

3. **Show Results** (1m)
   - Status page with scores
   - PII masked (email shows t***@acme.com)
   - Audit trail

4. **Show AWS Console** (1.5m)
   - DynamoDB: Real data
   - CloudWatch: Metrics
   - Cognito: Auth working

## 🔑 Key Points to Say

- "Real AWS AI services - Fraud Detector and Comprehend"
- "Production-ready with monitoring and error handling"
- "Serverless and scalable"
- "Complete security with PII redaction and auth"
- "Cost-effective: ~$130/month for 30k requests"

## ⚡ Quick Commands

```bash
# Test backend
./test-workflow.sh

# Start frontend
cd frontend && npm run dev

# Check logs
aws logs tail /aws/lambda/veritas-onboard-start-workflow --follow

# List recent executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:127214165197:stateMachine:veritas-onboard-workflow \
  --max-results 5
```

## 🎉 YOU'RE READY!

Everything works. Just follow the steps above and you'll crush it!

**GOOD LUCK!** 🏆
