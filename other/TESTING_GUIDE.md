# Veritas Onboard Testing Guide

## Quick Test

Run the automated test script:

```bash
./test-workflow.sh
```

This will:
1. Submit an onboarding request
2. Wait for the workflow to complete
3. Display the execution status
4. Query and display the final result from DynamoDB

## Manual Testing

### 1. Submit an Onboarding Request

```bash
aws lambda invoke \
  --function-name veritas-onboard-start-workflow \
  --payload file://test-payload.json \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json | python3 -m json.tool
```

### 2. Check Step Functions Execution Status

Replace `EXECUTION_ARN` with the ARN from the previous response:

```bash
aws stepfunctions describe-execution \
  --execution-arn "EXECUTION_ARN" \
  --no-cli-pager | python3 -m json.tool
```

### 3. Query Request Status from DynamoDB

Replace `REQUEST_ID` with the ID from step 1:

```bash
aws lambda invoke \
  --function-name veritas-onboard-query-status \
  --payload '{"pathParameters":{"requestId":"REQUEST_ID"}}' \
  --cli-binary-format raw-in-base64-out \
  status.json && cat status.json | python3 -m json.tool
```

## Test Payload

The default test payload (`test-payload.json`) contains:

```json
{
  "body": "{\"vendorName\":\"Acme Corporation\",\"contactEmail\":\"test@acme.com\",\"businessDescription\":\"We provide excellent software solutions for businesses\",\"taxId\":\"12-3456789\"}"
}
```

## Expected Results

### Successful Workflow

- **Status**: `SUCCEEDED`
- **Final Status**: `APPROVED` (for low-risk requests) or `MANUAL_REVIEW` (for high-risk)
- **Risk Scores**: Combined score between 0.0 and 1.0
- **PII Redaction**: Email and Tax ID should be masked in the response
- **Audit Trail**: Should contain 4 events:
  1. SUBMITTED
  2. PII_REDACTED
  3. RISK_ASSESSED
  4. STATUS_UPDATED_APPROVED (or STATUS_UPDATED_MANUAL_REVIEW)

### Risk Score Calculation

- **Fraud Score Weight**: 70%
- **Content Risk Weight**: 30%
- **Manual Review Threshold**: > 0.8

If combined risk score > 0.8, the request goes to manual review and triggers an SNS notification.

## Troubleshooting

### Check Lambda Logs

```bash
# Start workflow logs
aws logs tail /aws/lambda/veritas-onboard-start-workflow --follow

# Redact PII logs
aws logs tail /aws/lambda/veritas-onboard-redact-pii --follow

# Fraud detector logs
aws logs tail /aws/lambda/veritas-onboard-fraud-detector --follow

# Comprehend logs
aws logs tail /aws/lambda/veritas-onboard-comprehend --follow

# Combine scores logs
aws logs tail /aws/lambda/veritas-onboard-combine-scores --follow

# Save DynamoDB logs
aws logs tail /aws/lambda/veritas-onboard-save-dynamo --follow
```

### Check Step Functions Execution History

```bash
aws stepfunctions get-execution-history \
  --execution-arn "EXECUTION_ARN" \
  --no-cli-pager | python3 -m json.tool
```

### Query DynamoDB Directly

```bash
aws dynamodb get-item \
  --table-name OnboardingRequests \
  --key '{"requestId":{"S":"REQUEST_ID"}}' \
  --no-cli-pager | python3 -m json.tool
```

## Creating Custom Test Payloads

Create a new JSON file with your test data:

```json
{
  "body": "{\"vendorName\":\"Your Company\",\"contactEmail\":\"email@example.com\",\"businessDescription\":\"Your business description here\",\"taxId\":\"XX-XXXXXXX\"}"
}
```

Then use it with the invoke command:

```bash
aws lambda invoke \
  --function-name veritas-onboard-start-workflow \
  --payload file://your-test-payload.json \
  --cli-binary-format raw-in-base64-out \
  response.json
```

## Important Notes

1. **CLI Binary Format**: Always use `--cli-binary-format raw-in-base64-out` when invoking Lambda functions with JSON payloads
2. **Payload Format**: The start-workflow Lambda expects API Gateway format with a `body` field containing stringified JSON
3. **Query Status Format**: The query-status Lambda expects `pathParameters` with a `requestId` field
4. **Wait Time**: Allow 5-10 seconds for the workflow to complete before querying status
