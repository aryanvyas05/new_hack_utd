#!/bin/bash

echo "🔍 DEBUGGING FULL FLOW - Finding where data is lost..."
echo ""

# Submit request
echo "1️⃣ Submitting request..."
RESPONSE=$(curl -s -X POST "https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Theranos Inc",
    "contactEmail": "test@theranos.com",
    "businessDescription": "Theranos faced fraud charges from SEC. Elizabeth Holmes was convicted of fraud. Filed for bankruptcy.",
    "taxId": "12-3456789"
  }')

REQUEST_ID=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('requestId', 'ERROR'))" 2>/dev/null)
echo "✅ Request ID: $REQUEST_ID"
echo ""

echo "2️⃣ Waiting 20 seconds for workflow..."
sleep 20

echo ""
echo "3️⃣ Checking fraud-detector output..."
aws logs tail /aws/lambda/veritas-onboard-fraud-detector --since 30s --format short | grep -E "Legal risk from orchestrator|Payment risk from orchestrator" | tail -2

echo ""
echo "4️⃣ Checking combine-scores output..."
aws logs tail /aws/lambda/veritas-onboard-combine-scores --since 30s --format short | grep -E "Risk score calculation" | tail -1

echo ""
echo "5️⃣ Checking save-dynamo..."
aws logs tail /aws/lambda/veritas-onboard-save-dynamo --since 30s --format short | grep -E "Saving onboarding|Successfully saved" | tail -2

echo ""
echo "6️⃣ Checking DynamoDB data..."
aws dynamodb get-item --table-name OnboardingRequests --key "{\"requestId\":{\"S\":\"$REQUEST_ID\"}}" --query 'Item.riskScores.M' | python3 -c "import json, sys; d=json.load(sys.stdin); print('Legal:', d.get('legalRiskScore',{}).get('N','MISSING')); print('Payment:', d.get('paymentRiskScore',{}).get('N','MISSING')); print('Fraud:', d.get('fraudScore',{}).get('N','MISSING'))"

echo ""
echo "✅ Debug complete!"
