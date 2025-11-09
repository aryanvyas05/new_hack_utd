# Lambda Functions

This directory contains all Lambda function code for the Veritas Onboard platform.

## Structure

- `start-workflow/` - Initiates Step Functions workflow
- `redact-pii/` - PII detection and masking
- `fraud-detector/` - Amazon Fraud Detector integration
- `comprehend/` - Amazon Comprehend sentiment analysis
- `combine-scores/` - Risk score combination logic
- `save-dynamo/` - DynamoDB persistence
- `notify-admin/` - SNS notification for manual review
- `query-status/` - Status query for QuickSight

## Development

Each Lambda function directory will contain:
- `lambda_function.py` - Main handler code
- `requirements.txt` - Python dependencies (if any)
- `README.md` - Function-specific documentation

Lambda functions will be implemented in subsequent tasks.
