# Fraud Detector Lambda Testing Guide

This guide covers testing the Fraud Detector Lambda function to ensure proper integration with Amazon Fraud Detector.

## Prerequisites

- Fraud Detector model deployed (see SETUP.md)
- AWS credentials configured
- Python 3.12 installed
- boto3 library installed: `pip install boto3`

## Test Methods

### Method 1: Automated Test Script

Run the provided test script:

```bash
cd lambda/fraud-detector
python3 test-lambda.py
```

This script tests:
- Low risk scenarios (legitimate businesses)
- Medium risk scenarios (new domains)
- High risk scenarios (suspicious patterns)
- Edge cases (missing data)
- Error handling (invalid detector)

Expected output:
```
Test Summary
============================================================
Tests passed: 4/4

✓ PASS: Low Risk - Legitimate Business
  Score: 0.250
  Model: 1.0

✓ PASS: Medium Risk - New Domain
  Score: 0.550
  Model: 1.0

✓ PASS: High Risk - Suspicious Email
  Score: 0.850
  Model: 1.0

✓ PASS: Edge Case - Missing Optional Fields
  Score: 0.500
  Model: default

All tests passed! ✓
```

### Method 2: Manual Lambda Invocation

Test the Lambda function directly using AWS CLI:

```bash
# Create test event
cat > test-event.json << EOF
{
  "requestId": "test-$(date +%s)",
  "email": "contact@example.com",
  "ipAddress": "192.168.1.100",
  "vendorName": "Example Corp"
}
EOF

# Invoke Lambda (if deployed)
aws lambda invoke \
  --function-name veritas-onboard-fraud-detector \
  --payload file://test-event.json \
  --cli-binary-format raw-in-base64-out \
  response.json

# View response
cat response.json | python3 -m json.tool
```

Expected response:
```json
{
  "fraudScore": 0.35,
  "modelVersion": "1.0",
  "riskFactors": [
    "low_risk_rule"
  ]
}
```

### Method 3: Direct Fraud Detector API Test

Test the Fraud Detector API directly:

```bash
aws frauddetector get-event-prediction \
  --detector-id veritas_onboard_detector \
  --event-id test-$(date +%s) \
  --event-type-name onboarding_request \
  --event-variables '{
    "email_address": "test@example.com",
    "ip_address": "192.168.1.1",
    "account_name": "Test Company"
  }' \
  --entities '[{
    "entityType": "customer",
    "entityId": "test@example.com"
  }]'
```

### Method 4: Step Functions Integration Test

Test the complete workflow:

```bash
# Start Step Functions execution
aws stepfunctions start-execution \
  --state-machine-arn <STATE_MACHINE_ARN> \
  --input '{
    "requestId": "test-integration-001",
    "email": "test@example.com",
    "ipAddress": "192.168.1.1",
    "vendorName": "Test Company",
    "businessDescription": "We provide software services"
  }'

# Check execution status
aws stepfunctions describe-execution \
  --execution-arn <EXECUTION_ARN>
```

## Test Scenarios

### Scenario 1: Low Risk (Auto-Approve)

**Input:**
```json
{
  "requestId": "test-low-001",
  "email": "contact@establishedcompany.com",
  "ipAddress": "192.168.1.100",
  "vendorName": "Established Company Inc"
}
```

**Expected:**
- Fraud score: 0.0 - 0.4
- Risk factors: `["low_risk_rule"]`
- Workflow outcome: AUTO_APPROVE

### Scenario 2: Medium Risk

**Input:**
```json
{
  "requestId": "test-medium-001",
  "email": "admin@newstartup.io",
  "ipAddress": "10.0.0.50",
  "vendorName": "New Startup LLC"
}
```

**Expected:**
- Fraud score: 0.4 - 0.8
- Risk factors: `["medium_risk_rule"]`
- Workflow outcome: AUTO_APPROVE (below 0.8 threshold)

### Scenario 3: High Risk (Manual Review)

**Input:**
```json
{
  "requestId": "test-high-001",
  "email": "temp123@tempmail.com",
  "ipAddress": "203.0.113.0",
  "vendorName": "Quick Cash Corp"
}
```

**Expected:**
- Fraud score: 0.8 - 1.0
- Risk factors: `["high_risk_rule", "suspicious_email_domain"]`
- Workflow outcome: MANUAL_REVIEW

### Scenario 4: Error Handling

**Input:**
```json
{
  "requestId": "test-error-001",
  "email": "",
  "ipAddress": "",
  "vendorName": ""
}
```

**Expected:**
- Fraud score: 0.5 (default)
- Model version: "default"
- Risk factors: `["error_default_score"]`
- No workflow failure

## Validation Checklist

After running tests, verify:

- [ ] Lambda function executes without errors
- [ ] Fraud scores are in range 0.0 - 1.0
- [ ] Model version is returned correctly
- [ ] Risk factors are populated
- [ ] Error handling returns default score (0.5)
- [ ] CloudWatch logs show detailed execution info
- [ ] Step Functions workflow completes successfully
- [ ] High risk requests trigger manual review
- [ ] Low risk requests auto-approve

## Performance Testing

Test Lambda performance:

```bash
# Run 10 concurrent invocations
for i in {1..10}; do
  aws lambda invoke \
    --function-name veritas-onboard-fraud-detector \
    --payload "{\"requestId\":\"perf-test-$i\",\"email\":\"test$i@example.com\",\"ipAddress\":\"192.168.1.$i\",\"vendorName\":\"Test $i\"}" \
    --cli-binary-format raw-in-base64-out \
    response-$i.json &
done
wait

# Check execution times in CloudWatch
aws logs filter-log-events \
  --log-group-name /aws/lambda/veritas-onboard-fraud-detector \
  --filter-pattern "Duration" \
  --start-time $(date -u -d '5 minutes ago' +%s)000
```

Expected performance:
- Cold start: < 3 seconds
- Warm execution: < 1 second
- Fraud Detector API latency: 200-500ms

## Monitoring

Monitor Lambda execution:

```bash
# View recent logs
aws logs tail /aws/lambda/veritas-onboard-fraud-detector --follow

# Check error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=veritas-onboard-fraud-detector \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Check invocation count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=veritas-onboard-fraud-detector \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Troubleshooting

### Issue: "Detector not found"

**Cause:** Fraud Detector not properly configured

**Solution:**
1. Run setup script: `./setup-fraud-detector.sh`
2. Verify detector exists: `aws frauddetector describe-detector --detector-id veritas_onboard_detector`
3. Check detector is ACTIVE

### Issue: "Access Denied"

**Cause:** Lambda IAM role missing permissions

**Solution:**
1. Check Lambda execution role has `frauddetector:GetEventPrediction` permission
2. Verify CDK deployed IAM policies correctly
3. Check CloudWatch logs for detailed error

### Issue: Always returns 0.5 score

**Cause:** Fraud Detector API errors being caught

**Solution:**
1. Check CloudWatch logs for warnings
2. Verify detector is activated
3. Test Fraud Detector API directly (see Method 3)
4. Check model version is deployed

### Issue: Timeout errors

**Cause:** Fraud Detector API latency

**Solution:**
1. Increase Lambda timeout (currently 60s)
2. Check Fraud Detector service health
3. Verify network connectivity
4. Consider implementing caching for repeated requests

## Next Steps

After successful testing:

1. **Load Testing**: Test with production-level traffic
2. **Monitoring Setup**: Configure CloudWatch alarms
3. **Model Tuning**: Adjust rules based on actual fraud patterns
4. **Custom Model**: Consider training custom model with historical data
5. **A/B Testing**: Compare Online Fraud Insights with custom models

## Additional Resources

- [AWS Fraud Detector Documentation](https://docs.aws.amazon.com/frauddetector/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Step Functions Testing](https://docs.aws.amazon.com/step-functions/latest/dg/testing-stepfunctions.html)
