# Fraud Detector Configuration - Task 13 Complete

## Summary

Task 13 "Configure Fraud Detector model" has been successfully implemented with all three subtasks completed:

### ✅ Subtask 13.1: Create Fraud Detector event type and variables
- Added CDK custom resources to create Fraud Detector variables
- Variables created: `email_address` (EMAIL_ADDRESS), `ip_address` (IP_ADDRESS), `account_name` (FREE_FORM_TEXT)
- Created entity type: `customer`
- Created event type: `onboarding_request`
- All resources are created automatically during CDK deployment

### ✅ Subtask 13.2: Set up New Account Fraud model
- Created comprehensive setup documentation (`lambda/fraud-detector/SETUP.md`)
- Created automated setup script (`lambda/fraud-detector/setup-fraud-detector.sh`)
- Documented both console-based and CLI-based setup approaches
- Model uses Online Fraud Insights template for new account fraud detection
- Configured three risk outcomes: high_risk, medium_risk, low_risk
- Created rules with appropriate thresholds

### ✅ Subtask 13.3: Update fraud-detector Lambda with model details
- Updated Lambda function to use environment variables for configuration
- Added `DETECTOR_NAME`, `EVENT_TYPE_NAME`, and `MODEL_VERSION` environment variables
- Updated workflow stack to pass configuration to Lambda
- Created comprehensive testing suite (`lambda/fraud-detector/test-lambda.py`)
- Created testing documentation (`lambda/fraud-detector/TESTING.md`)
- Updated main README with deployment instructions

## Files Created/Modified

### New Files
1. `lambda/fraud-detector/SETUP.md` - Detailed setup guide
2. `lambda/fraud-detector/setup-fraud-detector.sh` - Automated setup script
3. `lambda/fraud-detector/test-lambda.py` - Test suite
4. `lambda/fraud-detector/TESTING.md` - Testing documentation
5. `lambda/fraud-detector/README.md` - Lambda function documentation
6. `.kiro/specs/veritas-onboard/FRAUD_DETECTOR_SETUP_COMPLETE.md` - This file

### Modified Files
1. `lib/workflow-stack.ts` - Added Fraud Detector resource creation and updated Lambda configuration
2. `lambda/fraud-detector/lambda_function.py` - Updated to use environment variables
3. `README.md` - Added Fraud Detector setup instructions

## Implementation Details

### CDK Changes (lib/workflow-stack.ts)

Added method `createFraudDetectorResources()` that creates:
- Email address variable (EMAIL_ADDRESS type)
- IP address variable (IP_ADDRESS type)
- Account name variable (FREE_FORM_TEXT type)
- Customer entity type
- Onboarding request event type

Updated `createFraudDetectorFunction()` to include:
- Environment variables: DETECTOR_NAME, EVENT_TYPE_NAME, MODEL_VERSION
- Additional IAM permissions for Fraud Detector operations

### Lambda Changes (lambda/fraud-detector/lambda_function.py)

- Added environment variable imports
- Updated to use DETECTOR_NAME and EVENT_TYPE_NAME from environment
- Enhanced logging to show configuration being used
- Improved model version handling

### Setup Script (setup-fraud-detector.sh)

Automated script that:
1. Creates outcomes (high_risk, medium_risk, low_risk)
2. Creates detector
3. Creates model using Online Fraud Insights
4. Creates model version
5. Waits for model training
6. Creates rules with appropriate thresholds
7. Creates detector version
8. Activates detector

### Test Suite (test-lambda.py)

Comprehensive tests for:
- Low risk scenarios (legitimate businesses)
- Medium risk scenarios (new domains)
- High risk scenarios (suspicious patterns)
- Edge cases (missing data)
- Error handling (invalid detector)

## Deployment Instructions

### 1. Deploy CDK Stack

The CDK stack will automatically create the Fraud Detector variables and event type:

```bash
npm run build
cdk deploy WorkflowStack
```

### 2. Configure Fraud Detector Model

Run the setup script to create the detector and model:

```bash
cd lambda/fraud-detector
./setup-fraud-detector.sh
```

Or follow the manual setup guide in `lambda/fraud-detector/SETUP.md`.

### 3. Test the Configuration

Test the Lambda function:

```bash
cd lambda/fraud-detector
python3 test-lambda.py
```

Test the Fraud Detector API directly:

```bash
aws frauddetector get-event-prediction \
  --detector-id veritas_onboard_detector \
  --event-id test-$(date +%s) \
  --event-type-name onboarding_request \
  --event-variables '{"email_address":"test@example.com","ip_address":"192.168.1.1","account_name":"Test Company"}' \
  --entities '[{"entityType":"customer","entityId":"test@example.com"}]'
```

### 4. Verify Integration

Test the complete workflow:

```bash
aws stepfunctions start-execution \
  --state-machine-arn <STATE_MACHINE_ARN> \
  --input '{
    "requestId": "test-integration-001",
    "email": "test@example.com",
    "ipAddress": "192.168.1.1",
    "vendorName": "Test Company",
    "businessDescription": "We provide software services"
  }'
```

## Configuration Details

### Detector Configuration
- **Detector Name**: `veritas_onboard_detector`
- **Event Type**: `onboarding_request`
- **Model Type**: Online Fraud Insights (ONLINE_FRAUD_INSIGHTS)
- **Model Version**: 1.0

### Variables
- **email_address**: EMAIL_ADDRESS type, captures contact email
- **ip_address**: IP_ADDRESS type, captures source IP
- **account_name**: FREE_FORM_TEXT type, captures vendor name

### Risk Thresholds
- **High Risk** (> 0.8): Routes to manual review, triggers admin notification
- **Medium Risk** (0.4-0.8): Auto-approves but logs for monitoring
- **Low Risk** (< 0.4): Auto-approves

### Scoring Formula
```
combined_score = (fraud_score * 0.7) + (content_risk_score * 0.3)
```

## Monitoring

### CloudWatch Logs
- Log Group: `/aws/lambda/veritas-onboard-fraud-detector`
- Logs include: request details, fraud scores, model versions, errors

### CloudWatch Metrics
- Lambda invocations, errors, duration
- Fraud Detector prediction count and latency

### Key Metrics to Monitor
- Average fraud score
- Error rate
- Execution duration
- Manual review rate (scores > 0.8)

## Cost Estimate

For 1,000 requests/day (30,000/month):
- **Lambda**: ~$0.006/month (512MB, 1s avg)
- **Fraud Detector**: ~$75/month ($2.50 per 1,000 predictions)
- **Total**: ~$75/month

## Next Steps

1. ✅ Task 13 is complete
2. Continue with Task 14: Set up monitoring and observability
3. Continue with Task 15: Implement QuickSight dashboard
4. Continue with Task 16: Create deployment documentation
5. Continue with Task 17: Wire all components together

## References

- [Fraud Detector Setup Guide](../../lambda/fraud-detector/SETUP.md)
- [Testing Guide](../../lambda/fraud-detector/TESTING.md)
- [Lambda README](../../lambda/fraud-detector/README.md)
- [Requirements Document](./requirements.md) - Requirements 3.1, 3.2, 3.3
- [Design Document](./design.md) - Fraud Detector architecture
- [AWS Fraud Detector Documentation](https://docs.aws.amazon.com/frauddetector/)
