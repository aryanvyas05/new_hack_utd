# ✅ Veritas Onboard Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment

- [ ] AWS Account created and accessible
- [ ] Credit card on file (for AWS charges)
- [ ] `veritas-onboard-deploy.zip` file ready (225KB)
- [ ] Read cost estimate (~$130-165/month)

## AWS CloudShell Setup

- [ ] Opened AWS Management Console (https://console.aws.amazon.com/)
- [ ] Clicked CloudShell icon (>_) in top-right
- [ ] CloudShell terminal loaded successfully
- [ ] Uploaded `veritas-onboard-deploy.zip`
- [ ] Extracted project: `unzip veritas-onboard-deploy.zip -d veritas-onboard`
- [ ] Changed directory: `cd veritas-onboard`
- [ ] Installed dependencies: `npm install`
- [ ] Built project: `npm run build`

## CDK Bootstrap

- [ ] Got AWS account ID: `aws sts get-caller-identity`
- [ ] Ran bootstrap: `npx cdk bootstrap aws://ACCOUNT/REGION`
- [ ] Saw success message: "Environment bootstrapped"

## Fraud Detector Setup

- [ ] Changed to fraud detector directory: `cd lambda/fraud-detector`
- [ ] Made script executable: `chmod +x setup-fraud-detector.sh`
- [ ] Ran setup script: `./setup-fraud-detector.sh`
- [ ] Saw success messages for:
  - [ ] Variables created (email_address, ip_address, account_name)
  - [ ] Entity type created (customer)
  - [ ] Event type created (onboarding_request)
  - [ ] Detector created (veritas_onboard_detector)
- [ ] Returned to root: `cd ../..`

## CDK Deployment

- [ ] Started deployment: `npx cdk deploy --all --require-approval never`
- [ ] Waited 10-15 minutes for completion
- [ ] Saw success for all 5 stacks:
  - [ ] veritas-onboard-dev-database (DynamoDB)
  - [ ] veritas-onboard-dev-workflow (Step Functions + Lambdas)
  - [ ] veritas-onboard-dev-amplify (Cognito)
  - [ ] veritas-onboard-dev-api (API Gateway + WAF)
  - [ ] veritas-onboard-dev-monitoring (CloudWatch)

## Save Deployment Outputs

Copy these values from the deployment output:

```
API Endpoint: _________________________________
User Pool ID: _________________________________
User Pool Client ID: __________________________
SNS Topic ARN: ________________________________
Table Name: ___________________________________
State Machine ARN: ____________________________
```

## Post-Deployment Configuration

- [ ] Subscribed to SNS notifications:
  ```bash
  aws sns subscribe --topic-arn <ARN> --protocol email --notification-endpoint your@email.com
  ```
- [ ] Confirmed email subscription (checked inbox)
- [ ] Created test user in Cognito:
  ```bash
  aws cognito-idp admin-create-user --user-pool-id <ID> --username testuser@example.com ...
  ```
- [ ] Set permanent password for test user

## Frontend Configuration (Local Machine)

- [ ] Created `frontend/.env.local` with:
  - [ ] NEXT_PUBLIC_API_ENDPOINT
  - [ ] NEXT_PUBLIC_USER_POOL_ID
  - [ ] NEXT_PUBLIC_USER_POOL_CLIENT_ID
  - [ ] NEXT_PUBLIC_AWS_REGION
- [ ] Installed frontend dependencies: `npm install`
- [ ] Started frontend: `npm run dev`
- [ ] Accessed http://localhost:3000

## Verification in AWS Console

### DynamoDB
- [ ] Opened DynamoDB Console
- [ ] Found `OnboardingRequests` table
- [ ] Verified `StatusIndex` GSI exists
- [ ] Checked point-in-time recovery enabled

### Lambda Functions
- [ ] Opened Lambda Console
- [ ] Verified 9 functions exist:
  - [ ] veritas-onboard-start-workflow
  - [ ] veritas-onboard-redact-pii
  - [ ] veritas-onboard-fraud-detector
  - [ ] veritas-onboard-comprehend
  - [ ] veritas-onboard-combine-scores
  - [ ] veritas-onboard-save-dynamo
  - [ ] veritas-onboard-notify-admin
  - [ ] veritas-onboard-query-status
  - [ ] veritas-onboard-quicksight-data

### Step Functions
- [ ] Opened Step Functions Console
- [ ] Found `veritas-onboard-workflow` state machine
- [ ] Viewed visual workflow (6 steps visible)

### API Gateway
- [ ] Opened API Gateway Console
- [ ] Found `Veritas Onboard API`
- [ ] Verified 3 endpoints:
  - [ ] POST /onboard
  - [ ] GET /status/{requestId}
  - [ ] GET /analytics

### Cognito
- [ ] Opened Cognito Console
- [ ] Found User Pool
- [ ] Verified test user exists
- [ ] Checked password policy settings

### WAF
- [ ] Opened WAF Console
- [ ] Found `veritas-onboard-api-waf` WebACL
- [ ] Verified rules configured:
  - [ ] AWS Managed Rules
  - [ ] SQL Injection protection
  - [ ] Rate limiting (100 req/5min)

### CloudWatch
- [ ] Opened CloudWatch Console
- [ ] Found alarms (3 critical + 2 warning)
- [ ] Verified log groups exist for all Lambdas
- [ ] Checked dashboard created

## End-to-End Testing

### Test 1: Low-Risk Request (Auto-Approve)
- [ ] Signed in to frontend
- [ ] Submitted request:
  - Vendor: "Acme Corporation"
  - Email: "contact@acme.com"
  - Description: "We provide excellent software solutions"
  - Tax ID: "12-3456789"
- [ ] Received request ID
- [ ] Checked status page
- [ ] Verified status = APPROVED
- [ ] Verified risk score < 0.8
- [ ] Checked Step Functions execution (success)
- [ ] Checked DynamoDB record exists

### Test 2: High-Risk Request (Manual Review)
- [ ] Submitted request:
  - Vendor: "Suspicious Vendor LLC"
  - Email: "test@suspicious-domain.xyz"
  - Description: "Offshore money laundering operations"
  - Tax ID: "98-7654321"
- [ ] Received request ID
- [ ] Checked status page
- [ ] Verified status = MANUAL_REVIEW
- [ ] Verified risk score > 0.8
- [ ] Received email notification
- [ ] Checked Step Functions execution (manual review path)
- [ ] Checked DynamoDB record exists

### Test 3: Security Validation
- [ ] Tested API without JWT token → Got 401 Unauthorized
- [ ] Tested SQL injection → Got 403 Forbidden (WAF blocked)
- [ ] Tested rate limiting → Got 429 after 100 requests
- [ ] Verified PII redacted in DynamoDB

### Test 4: Monitoring
- [ ] Checked CloudWatch Logs for Lambda executions
- [ ] Viewed X-Ray traces in X-Ray Console
- [ ] Verified service map shows all components
- [ ] Checked CloudWatch metrics for API Gateway
- [ ] Verified alarms are in OK state

## Optional: QuickSight Dashboard

- [ ] Set up QuickSight account
- [ ] Created dataset from DynamoDB
- [ ] Built visualizations
- [ ] Created dashboard
- [ ] Shared with team

## Cost Management

- [ ] Set up billing alert for $200/month
- [ ] Reviewed Cost Explorer
- [ ] Understood monthly cost estimate (~$130-165)
- [ ] Planned cleanup strategy

## Cleanup (When Done Testing)

- [ ] Ran: `npx cdk destroy --all`
- [ ] Confirmed deletion of all stacks
- [ ] Verified resources deleted in AWS Console
- [ ] Checked no ongoing charges in billing

## Documentation Review

- [ ] Read `AWS_CONSOLE_DEPLOYMENT.md` (detailed guide)
- [ ] Read `QUICK_START_CONSOLE.md` (quick reference)
- [ ] Read `DEPLOYMENT_GUIDE.md` (comprehensive guide)
- [ ] Read `IMPLEMENTATION_COMPLETE.md` (project summary)
- [ ] Bookmarked troubleshooting section

## Success Criteria

✅ **Deployment is successful if**:
- All 5 CDK stacks deployed without errors
- All 9 Lambda functions are active
- Step Functions workflow executes successfully
- Low-risk requests are auto-approved
- High-risk requests trigger manual review
- Email notifications are received
- Frontend can authenticate and submit requests
- PII is properly redacted
- CloudWatch logs show execution details
- X-Ray traces are visible

## Troubleshooting

If you encounter issues, check:
- [ ] CloudFormation events for stack errors
- [ ] CloudWatch Logs for Lambda errors
- [ ] Step Functions execution history
- [ ] IAM permissions
- [ ] Fraud Detector availability in region
- [ ] AWS service quotas

## Next Steps After Successful Deployment

- [ ] Train Fraud Detector with real data
- [ ] Set up CI/CD pipeline
- [ ] Configure production environment
- [ ] Implement additional features
- [ ] Set up monitoring alerts
- [ ] Document operational procedures

---

## Status

**Deployment Date**: _______________
**Deployed By**: _______________
**Environment**: ☐ Dev  ☐ Staging  ☐ Production
**Status**: ☐ In Progress  ☐ Complete  ☐ Failed

**Notes**:
_____________________________________________
_____________________________________________
_____________________________________________

---

**Congratulations on deploying Veritas Onboard!** 🎉
