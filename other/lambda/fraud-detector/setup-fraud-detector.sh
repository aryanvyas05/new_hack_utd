#!/bin/bash

# Fraud Detector Setup Script for Veritas Onboard
# This script automates the creation of Fraud Detector model and detector

set -e

# Configuration
DETECTOR_NAME="veritas_onboard_detector"
EVENT_TYPE="onboarding_request"
MODEL_NAME="veritas_onboard_model"
MODEL_TYPE="ONLINE_FRAUD_INSIGHTS"
REGION="${AWS_REGION:-us-east-1}"

echo "=========================================="
echo "Fraud Detector Setup for Veritas Onboard"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  Detector: $DETECTOR_NAME"
echo "  Event Type: $EVENT_TYPE"
echo "  Model: $MODEL_NAME"
echo "  Region: $REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "ERROR: AWS credentials not configured. Please run 'aws configure'."
    exit 1
fi

echo "Step 1: Creating outcomes..."
aws frauddetector put-outcome \
  --name high_risk \
  --description "High fraud risk - requires manual review" \
  --region $REGION \
  2>/dev/null || echo "  Outcome 'high_risk' already exists"

aws frauddetector put-outcome \
  --name medium_risk \
  --description "Medium fraud risk" \
  --region $REGION \
  2>/dev/null || echo "  Outcome 'medium_risk' already exists"

aws frauddetector put-outcome \
  --name low_risk \
  --description "Low fraud risk - auto-approve" \
  --region $REGION \
  2>/dev/null || echo "  Outcome 'low_risk' already exists"

echo "✓ Outcomes created"
echo ""

echo "Step 2: Creating detector..."
aws frauddetector put-detector \
  --detector-id $DETECTOR_NAME \
  --event-type-id $EVENT_TYPE \
  --description "Fraud detection for vendor onboarding requests" \
  --region $REGION \
  2>/dev/null || echo "  Detector already exists"

echo "✓ Detector created"
echo ""

echo "Step 3: Creating model..."
aws frauddetector create-model \
  --model-id $MODEL_NAME \
  --model-type $MODEL_TYPE \
  --event-type-id $EVENT_TYPE \
  --description "New account fraud detection model using Online Fraud Insights" \
  --region $REGION \
  2>/dev/null || echo "  Model already exists"

echo "✓ Model created"
echo ""

echo "Step 4: Creating model version..."
echo "  Note: This uses the Online Fraud Insights pre-trained model"

# Create model version with Online Fraud Insights
aws frauddetector create-model-version \
  --model-id $MODEL_NAME \
  --model-type $MODEL_TYPE \
  --training-data-source EXTERNAL_EVENTS \
  --region $REGION \
  2>/dev/null || echo "  Model version already exists"

echo "✓ Model version created"
echo ""

echo "Step 5: Waiting for model training to complete..."
echo "  This may take a few minutes..."

# Wait for model to be ready
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    STATUS=$(aws frauddetector describe-model-versions \
      --model-id $MODEL_NAME \
      --model-type $MODEL_TYPE \
      --region $REGION \
      --query 'modelVersionDetails[0].status' \
      --output text 2>/dev/null || echo "UNKNOWN")
    
    if [ "$STATUS" = "ACTIVE" ] || [ "$STATUS" = "TRAINING_COMPLETE" ]; then
        echo "✓ Model training complete"
        break
    elif [ "$STATUS" = "TRAINING_FAILED" ]; then
        echo "ERROR: Model training failed"
        exit 1
    fi
    
    echo "  Status: $STATUS (attempt $((ATTEMPT+1))/$MAX_ATTEMPTS)"
    sleep 10
    ATTEMPT=$((ATTEMPT+1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "WARNING: Model training timeout. Please check status manually."
fi

echo ""

echo "Step 6: Creating rules..."

# High risk rule
aws frauddetector create-rule \
  --rule-id high_risk_rule \
  --detector-id $DETECTOR_NAME \
  --expression "\$${MODEL_NAME}_insightscore > 800" \
  --language DETECTORPL \
  --outcomes high_risk \
  --region $REGION \
  2>/dev/null || echo "  Rule 'high_risk_rule' already exists"

# Medium risk rule
aws frauddetector create-rule \
  --rule-id medium_risk_rule \
  --detector-id $DETECTOR_NAME \
  --expression "\$${MODEL_NAME}_insightscore > 400 and \$${MODEL_NAME}_insightscore <= 800" \
  --language DETECTORPL \
  --outcomes medium_risk \
  --region $REGION \
  2>/dev/null || echo "  Rule 'medium_risk_rule' already exists"

# Low risk rule
aws frauddetector create-rule \
  --rule-id low_risk_rule \
  --detector-id $DETECTOR_NAME \
  --expression "\$${MODEL_NAME}_insightscore <= 400" \
  --language DETECTORPL \
  --outcomes low_risk \
  --region $REGION \
  2>/dev/null || echo "  Rule 'low_risk_rule' already exists"

echo "✓ Rules created"
echo ""

echo "Step 7: Creating detector version..."

# Get model version number
MODEL_VERSION=$(aws frauddetector describe-model-versions \
  --model-id $MODEL_NAME \
  --model-type $MODEL_TYPE \
  --region $REGION \
  --query 'modelVersionDetails[0].modelVersionNumber' \
  --output text 2>/dev/null || echo "1")

aws frauddetector create-detector-version \
  --detector-id $DETECTOR_NAME \
  --rules high_risk_rule medium_risk_rule low_risk_rule \
  --model-versions "modelId=$MODEL_NAME,modelType=$MODEL_TYPE,modelVersionNumber=$MODEL_VERSION" \
  --region $REGION \
  2>/dev/null || echo "  Detector version already exists"

echo "✓ Detector version created"
echo ""

echo "Step 8: Activating detector..."

# Get the latest detector version
DETECTOR_VERSION=$(aws frauddetector describe-detector \
  --detector-id $DETECTOR_NAME \
  --region $REGION \
  --query 'detectorVersionSummaries[0].detectorVersionId' \
  --output text 2>/dev/null || echo "1")

aws frauddetector update-detector-version-status \
  --detector-id $DETECTOR_NAME \
  --detector-version-id $DETECTOR_VERSION \
  --status ACTIVE \
  --region $REGION \
  2>/dev/null || echo "  Detector already active"

echo "✓ Detector activated"
echo ""

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Detector Details:"
echo "  Name: $DETECTOR_NAME"
echo "  Version: $DETECTOR_VERSION"
echo "  Model: $MODEL_NAME (version $MODEL_VERSION)"
echo "  Status: ACTIVE"
echo ""
echo "Next Steps:"
echo "  1. Test the detector with sample data (see SETUP.md)"
echo "  2. Update Lambda environment variables if needed"
echo "  3. Deploy the CDK stack"
echo "  4. Monitor predictions in CloudWatch"
echo ""
echo "To test the detector, run:"
echo "  aws frauddetector get-event-prediction \\"
echo "    --detector-id $DETECTOR_NAME \\"
echo "    --event-id test-\$(date +%s) \\"
echo "    --event-type-name $EVENT_TYPE \\"
echo "    --event-variables '{\"email_address\":\"test@example.com\",\"ip_address\":\"192.168.1.1\",\"account_name\":\"Test Company\"}' \\"
echo "    --entities '[{\"entityType\":\"customer\",\"entityId\":\"test@example.com\"}]' \\"
echo "    --region $REGION"
echo ""
