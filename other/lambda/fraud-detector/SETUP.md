# Fraud Detector Setup Guide

This guide explains how to set up the Amazon Fraud Detector model for the Veritas Onboard system.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Fraud Detector event type and variables created (automatically via CDK)
- Access to AWS Fraud Detector console

## Overview

The Veritas Onboard system uses Amazon Fraud Detector's **Online Fraud Insights** model template for new account fraud detection. This model analyzes:
- Email address patterns
- IP address reputation
- Account name characteristics

## Setup Steps

### Option 1: Using AWS Console (Recommended for First-Time Setup)

1. **Navigate to Fraud Detector Console**
   - Go to: https://console.aws.amazon.com/frauddetector/
   - Select your region

2. **Verify Event Type and Variables**
   - Go to "Event types" in the left menu
   - Confirm `onboarding_request` event type exists
   - Verify variables: `email_address`, `ip_address`, `account_name`

3. **Create a Detector**
   - Click "Detectors" in the left menu
   - Click "Create detector"
   - Detector name: `veritas_onboard_detector`
   - Detector description: "Fraud detection for vendor onboarding requests"
   - Event type: Select `onboarding_request`
   - Click "Create detector"

4. **Add Model to Detector**
   - In the detector page, go to "Model" tab
   - Click "Add model"
   - Select "Online Fraud Insights" model template
   - Model name: `veritas_onboard_model`
   - Model version: `1.0`
   - Click "Create model"

5. **Configure Model Outcomes**
   - Go to "Outcomes" tab
   - Create three outcomes:
     - `high_risk` - For scores > 0.8
     - `medium_risk` - For scores 0.4-0.8
     - `low_risk` - For scores < 0.4

6. **Create Rules**
   - Go to "Rules" tab
   - Create rule: `high_risk_rule`
     ```
     $veritas_onboard_model_insightscore > 800
     ```
     Outcome: `high_risk`
   
   - Create rule: `medium_risk_rule`
     ```
     $veritas_onboard_model_insightscore > 400 and $veritas_onboard_model_insightscore <= 800
     ```
     Outcome: `medium_risk`
   
   - Create rule: `low_risk_rule`
     ```
     $veritas_onboard_model_insightscore <= 400
     ```
     Outcome: `low_risk`

7. **Activate Detector**
   - Review all configurations
   - Click "Activate detector"
   - Confirm activation

### Option 2: Using AWS CLI

Run the provided setup script:

```bash
cd lambda/fraud-detector
./setup-fraud-detector.sh
```

Or manually execute the commands:

```bash
# Set variables
DETECTOR_NAME="veritas_onboard_detector"
EVENT_TYPE="onboarding_request"
MODEL_NAME="veritas_onboard_model"

# Create detector
aws frauddetector put-detector \
  --detector-id $DETECTOR_NAME \
  --event-type-id $EVENT_TYPE \
  --description "Fraud detection for vendor onboarding requests"

# Create outcomes
aws frauddetector put-outcome \
  --name high_risk \
  --description "High fraud risk - requires manual review"

aws frauddetector put-outcome \
  --name medium_risk \
  --description "Medium fraud risk"

aws frauddetector put-outcome \
  --name low_risk \
  --description "Low fraud risk - auto-approve"

# Create model (using Online Fraud Insights template)
aws frauddetector create-model \
  --model-id $MODEL_NAME \
  --model-type ONLINE_FRAUD_INSIGHTS \
  --event-type-id $EVENT_TYPE \
  --description "New account fraud detection model"

# Create model version
aws frauddetector create-model-version \
  --model-id $MODEL_NAME \
  --model-type ONLINE_FRAUD_INSIGHTS \
  --training-data-source EXTERNAL_EVENTS \
  --training-data-schema '{
    "modelVariables": ["email_address", "ip_address", "account_name"],
    "labelSchema": {
      "labelMapper": {
        "FRAUD": ["high_risk"],
        "LEGIT": ["low_risk"]
      }
    }
  }'

# Wait for model training to complete (this may take several minutes)
aws frauddetector describe-model-versions \
  --model-id $MODEL_NAME \
  --model-type ONLINE_FRAUD_INSIGHTS

# Create rules
aws frauddetector create-rule \
  --rule-id high_risk_rule \
  --detector-id $DETECTOR_NAME \
  --expression '$veritas_onboard_model_insightscore > 800' \
  --language DETECTORPL \
  --outcomes high_risk

aws frauddetector create-rule \
  --rule-id medium_risk_rule \
  --detector-id $DETECTOR_NAME \
  --expression '$veritas_onboard_model_insightscore > 400 and $veritas_onboard_model_insightscore <= 800' \
  --language DETECTORPL \
  --outcomes medium_risk

aws frauddetector create-rule \
  --rule-id low_risk_rule \
  --detector-id $DETECTOR_NAME \
  --expression '$veritas_onboard_model_insightscore <= 400' \
  --language DETECTORPL \
  --outcomes low_risk

# Create detector version
aws frauddetector create-detector-version \
  --detector-id $DETECTOR_NAME \
  --rules high_risk_rule medium_risk_rule low_risk_rule \
  --model-versions '{
    "modelId": "'$MODEL_NAME'",
    "modelType": "ONLINE_FRAUD_INSIGHTS",
    "modelVersionNumber": "1.0"
  }'

# Activate detector version
aws frauddetector update-detector-version-status \
  --detector-id $DETECTOR_NAME \
  --detector-version-id 1 \
  --status ACTIVE
```

## Model Configuration Details

### Variables
- **email_address** (EMAIL_ADDRESS): Contact email from onboarding request
- **ip_address** (IP_ADDRESS): Source IP address of the request
- **account_name** (FREE_FORM_TEXT): Vendor/company name

### Model Type
- **Online Fraud Insights**: Pre-trained model for new account fraud detection
- Analyzes patterns in email domains, IP reputation, and account characteristics
- Returns fraud score from 0-1000 (converted to 0.0-1.0 in Lambda)

### Outcomes
- **high_risk**: Score > 0.8 → Routes to manual review
- **medium_risk**: Score 0.4-0.8 → May require additional checks
- **low_risk**: Score < 0.4 → Auto-approve

## Testing the Model

After setup, test the model with sample data:

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

Expected response should include:
- `modelScores`: Array with fraud scores
- `ruleResults`: Matched rules and outcomes
- `outcomes`: Final risk assessment

## Troubleshooting

### Error: "Event type not found"
- Ensure CDK stack has been deployed
- Check that event type `onboarding_request` exists in Fraud Detector console

### Error: "Variable not found"
- Verify all three variables are created: `email_address`, `ip_address`, `account_name`
- Check variable data types match configuration

### Model returns default score (0.5)
- Check detector is activated
- Verify model version is deployed
- Review CloudWatch logs for detailed error messages

### Low accuracy / unexpected scores
- Online Fraud Insights model improves with usage
- Consider training a custom model with historical data
- Review and adjust rule thresholds based on your risk tolerance

## Monitoring

Monitor Fraud Detector performance:
- CloudWatch Metrics: `AWS/FraudDetector`
- Key metrics: `GetEventPredictionCount`, `GetEventPredictionLatency`
- Lambda logs: `/aws/lambda/veritas-onboard-fraud-detector`

## Cost Considerations

- Fraud Detector pricing: ~$2.50 per 1,000 predictions
- Online Fraud Insights model: No additional training costs
- Estimated cost for 1,000 requests/day: ~$75/month

## Next Steps

After completing setup:
1. Test the Lambda function with sample data (see subtask 13.3)
2. Integrate with Step Functions workflow
3. Monitor initial predictions and adjust rules as needed
4. Consider training custom model with production data after 30 days
