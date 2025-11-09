# Fraud Detector Lambda Function

This Lambda function integrates with Amazon Fraud Detector to assess fraud risk for vendor onboarding requests.

## Overview

The function analyzes three key variables:
- **Email address**: Contact email from the onboarding request
- **IP address**: Source IP of the request
- **Account name**: Vendor/company name

It returns a fraud score (0.0 - 1.0) that determines whether the request is auto-approved or sent for manual review.

## Configuration

### Environment Variables

- `DETECTOR_NAME`: Fraud Detector detector ID (default: `veritas_onboard_detector`)
- `EVENT_TYPE_NAME`: Event type name (default: `onboarding_request`)
- `MODEL_VERSION`: Model version identifier (default: `1.0`)

### IAM Permissions Required

```json
{
  "Effect": "Allow",
  "Action": [
    "frauddetector:GetEventPrediction",
    "frauddetector:GetDetectors",
    "frauddetector:GetEventTypes"
  ],
  "Resource": "*"
}
```

## Setup

### Quick Start

1. **Deploy Fraud Detector resources** (automated via CDK):
   ```bash
   cd lambda/fraud-detector
   ./setup-fraud-detector.sh
   ```

2. **Verify setup**:
   ```bash
   aws frauddetector describe-detector --detector-id veritas_onboard_detector
   ```

3. **Test the Lambda**:
   ```bash
   python3 test-lambda.py
   ```

### Manual Setup

See [SETUP.md](./SETUP.md) for detailed manual configuration instructions.

## Usage

### Input Format

```json
{
  "requestId": "uuid",
  "email": "contact@example.com",
  "ipAddress": "192.168.1.100",
  "vendorName": "Example Corp"
}
```

### Output Format

```json
{
  "fraudScore": 0.35,
  "modelVersion": "1.0",
  "riskFactors": ["low_risk_rule"]
}
```

### Error Handling

On error, the function returns a default response:

```json
{
  "fraudScore": 0.5,
  "modelVersion": "default",
  "riskFactors": ["error_default_score"],
  "error": "ErrorType"
}
```

This ensures the workflow continues even if Fraud Detector is unavailable.

## Risk Scoring

The fraud score determines the workflow path:

- **0.0 - 0.8**: Auto-approve (low to medium risk)
- **> 0.8**: Manual review (high risk)

The score is combined with content risk score (from Comprehend) using weighted average:
```
combined_score = (fraud_score * 0.7) + (content_risk_score * 0.3)
```

## Testing

### Unit Tests

```bash
python3 test-lambda.py
```

### Integration Tests

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

### Sample Test Cases

**Low Risk:**
```bash
aws lambda invoke \
  --function-name veritas-onboard-fraud-detector \
  --payload '{"requestId":"test-1","email":"contact@legitimate.com","ipAddress":"192.168.1.1","vendorName":"Legitimate Corp"}' \
  response.json
```

**High Risk:**
```bash
aws lambda invoke \
  --function-name veritas-onboard-fraud-detector \
  --payload '{"requestId":"test-2","email":"temp@tempmail.com","ipAddress":"203.0.113.0","vendorName":"Quick Cash"}' \
  response.json
```

## Monitoring

### CloudWatch Logs

View logs:
```bash
aws logs tail /aws/lambda/veritas-onboard-fraud-detector --follow
```

### Key Metrics

- **Invocations**: Total number of fraud checks
- **Errors**: Failed predictions
- **Duration**: Execution time (target: < 1s warm, < 3s cold)
- **Throttles**: Rate limiting events

### CloudWatch Insights Queries

**Average fraud score:**
```
fields @timestamp, fraudScore
| stats avg(fraudScore) as avg_score by bin(5m)
```

**Error rate:**
```
filter @message like /ERROR/
| stats count() as errors by bin(5m)
```

## Performance

- **Cold start**: ~2-3 seconds
- **Warm execution**: ~500-800ms
- **Fraud Detector API**: ~200-500ms latency
- **Memory**: 512 MB
- **Timeout**: 60 seconds

## Cost

- **Lambda**: ~$0.0000002 per invocation (512MB, 1s avg)
- **Fraud Detector**: ~$2.50 per 1,000 predictions
- **Total**: ~$2.50 per 1,000 requests

## Troubleshooting

### Common Issues

1. **"Detector not found"**
   - Run setup script: `./setup-fraud-detector.sh`
   - Verify detector is ACTIVE

2. **Always returns 0.5**
   - Check CloudWatch logs for errors
   - Verify Fraud Detector is properly configured
   - Test API directly

3. **Timeout errors**
   - Check Fraud Detector service health
   - Increase Lambda timeout if needed
   - Verify network connectivity

4. **Access denied**
   - Check IAM role has required permissions
   - Verify CDK deployed policies correctly

See [TESTING.md](./TESTING.md) for detailed troubleshooting guide.

## Files

- `lambda_function.py`: Main Lambda handler
- `SETUP.md`: Detailed setup instructions
- `TESTING.md`: Comprehensive testing guide
- `setup-fraud-detector.sh`: Automated setup script
- `test-lambda.py`: Unit test suite
- `README.md`: This file

## References

- [Amazon Fraud Detector Documentation](https://docs.aws.amazon.com/frauddetector/)
- [Online Fraud Insights Model](https://docs.aws.amazon.com/frauddetector/latest/ug/online-fraud-insights.html)
- [Veritas Onboard Design Document](../../.kiro/specs/veritas-onboard/design.md)
- [Requirements Document](../../.kiro/specs/veritas-onboard/requirements.md)
