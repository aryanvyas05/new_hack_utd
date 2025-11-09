#!/bin/bash

# Test the Veritas Onboard workflow end-to-end

echo "🚀 Testing Veritas Onboard Workflow..."
echo ""

# Submit the onboarding request
echo "📤 Submitting onboarding request..."
RESPONSE=$(aws lambda invoke \
  --function-name veritas-onboard-start-workflow \
  --payload file://test-payload.json \
  --cli-binary-format raw-in-base64-out \
  response.json 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Failed to submit request"
  echo "$RESPONSE"
  exit 1
fi

# Extract request ID from response
REQUEST_ID=$(cat response.json | python3 -c "import sys, json; print(json.load(sys.stdin)['body'])" | python3 -c "import sys, json; print(json.load(sys.stdin)['requestId'])")
EXECUTION_ARN=$(cat response.json | python3 -c "import sys, json; print(json.load(sys.stdin)['body'])" | python3 -c "import sys, json; print(json.load(sys.stdin)['executionArn'])")

echo "✅ Request submitted successfully"
echo "   Request ID: $REQUEST_ID"
echo ""

# Wait for workflow to complete
echo "⏳ Waiting for workflow to complete (10 seconds)..."
sleep 10

# Check execution status
echo "🔍 Checking execution status..."
aws stepfunctions describe-execution \
  --execution-arn "$EXECUTION_ARN" \
  --no-cli-pager \
  --query '{status:status,startDate:startDate,stopDate:stopDate}' \
  --output table

# Query the final status from DynamoDB
echo ""
echo "📊 Querying final status from DynamoDB..."
aws lambda invoke \
  --function-name veritas-onboard-query-status \
  --payload "{\"pathParameters\":{\"requestId\":\"$REQUEST_ID\"}}" \
  --cli-binary-format raw-in-base64-out \
  status.json > /dev/null 2>&1

# Pretty print the result
cat status.json | python3 -c "
import sys, json
response = json.load(sys.stdin)
if response['statusCode'] == 200:
    data = json.loads(response['body'])
    print('✅ Request Status:')
    print(f\"   Request ID: {data['requestId']}\")
    print(f\"   Status: {data['status']}\")
    print(f\"   Vendor: {data['vendorName']}\")
    print(f\"   Email: {data['contactEmail']}\")
    print(f\"   Risk Scores:\")
    print(f\"     - Combined: {data['riskScores']['combinedRiskScore']}\")
    print(f\"     - Fraud: {data['riskScores']['fraudScore']}\")
    print(f\"     - Content: {data['riskScores']['contentRiskScore']}\")
    print(f\"   Audit Trail: {len(data['auditTrail'])} events\")
else:
    print('❌ Failed to query status')
    print(json.dumps(response, indent=2))
"

echo ""
echo "🎉 Test complete!"
