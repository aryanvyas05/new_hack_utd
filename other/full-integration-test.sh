#!/bin/bash

# Complete Integration Test for Veritas Onboard
# Tests: API Gateway → Lambda → Step Functions → DynamoDB

set -e

echo "🚀 VERITAS ONBOARD - COMPLETE INTEGRATION TEST"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get API Gateway URL
echo "📡 Step 1: Getting API Gateway URL..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name veritas-onboard-dev-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
  echo -e "${YELLOW}⚠️  API Gateway not deployed. Testing backend only...${NC}"
  echo ""
  echo "To deploy API Gateway, run:"
  echo "  npx cdk deploy veritas-onboard-dev-api --require-approval never"
  echo ""
  BACKEND_ONLY=true
else
  echo -e "${GREEN}✅ API URL: $API_URL${NC}"
  BACKEND_ONLY=false
fi

echo ""

# Test 1: Backend Workflow (Direct Lambda)
echo "🧪 Test 1: Backend Workflow (Direct Lambda Invocation)"
echo "-------------------------------------------------------"

RESPONSE=$(aws lambda invoke \
  --function-name veritas-onboard-start-workflow \
  --payload file://test-payload.json \
  --cli-binary-format raw-in-base64-out \
  response-test.json 2>&1)

if [ $? -eq 0 ]; then
  REQUEST_ID=$(cat response-test.json | python3 -c "import sys, json; print(json.load(sys.stdin)['body'])" | python3 -c "import sys, json; print(json.load(sys.stdin)['requestId'])")
  echo -e "${GREEN}✅ Backend workflow started${NC}"
  echo "   Request ID: $REQUEST_ID"
else
  echo -e "${RED}❌ Backend workflow failed${NC}"
  exit 1
fi

echo ""
echo "⏳ Waiting 10 seconds for workflow to complete..."
sleep 10

# Check Step Functions execution
echo ""
echo "🔍 Checking Step Functions execution..."
EXECUTION_ARN="arn:aws:states:us-east-1:127214165197:execution:veritas-onboard-workflow:onboarding-$REQUEST_ID"
EXECUTION_STATUS=$(aws stepfunctions describe-execution \
  --execution-arn "$EXECUTION_ARN" \
  --query 'status' \
  --output text 2>/dev/null || echo "UNKNOWN")

if [ "$EXECUTION_STATUS" == "SUCCEEDED" ]; then
  echo -e "${GREEN}✅ Step Functions execution: SUCCEEDED${NC}"
else
  echo -e "${RED}❌ Step Functions execution: $EXECUTION_STATUS${NC}"
  aws stepfunctions describe-execution --execution-arn "$EXECUTION_ARN" --no-cli-pager
  exit 1
fi

# Check DynamoDB
echo ""
echo "🗄️  Checking DynamoDB..."
DYNAMO_ITEM=$(aws dynamodb get-item \
  --table-name OnboardingRequests \
  --key "{\"requestId\":{\"S\":\"$REQUEST_ID\"}}" \
  --query 'Item.status.S' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DYNAMO_ITEM" != "NOT_FOUND" ]; then
  echo -e "${GREEN}✅ DynamoDB record found: Status = $DYNAMO_ITEM${NC}"
else
  echo -e "${RED}❌ DynamoDB record not found${NC}"
  exit 1
fi

# Test 2: API Gateway (if deployed)
if [ "$BACKEND_ONLY" = false ]; then
  echo ""
  echo "🧪 Test 2: API Gateway Integration"
  echo "-----------------------------------"
  
  # Submit via API
  echo "📤 Submitting request via API Gateway..."
  API_RESPONSE=$(curl -s -X POST "$API_URL/onboard" \
    -H "Content-Type: application/json" \
    -d '{
      "vendorName": "API Test Corp",
      "contactEmail": "apitest@example.com",
      "businessDescription": "Testing API Gateway integration",
      "taxId": "99-8877665"
    }')
  
  API_REQUEST_ID=$(echo "$API_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('requestId', 'ERROR'))" 2>/dev/null || echo "ERROR")
  
  if [ "$API_REQUEST_ID" != "ERROR" ]; then
    echo -e "${GREEN}✅ API submission successful${NC}"
    echo "   Request ID: $API_REQUEST_ID"
    
    echo ""
    echo "⏳ Waiting 10 seconds for processing..."
    sleep 10
    
    # Query status via API
    echo ""
    echo "🔍 Querying status via API Gateway..."
    STATUS_RESPONSE=$(curl -s "$API_URL/status/$API_REQUEST_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'ERROR'))" 2>/dev/null || echo "ERROR")
    
    if [ "$STATUS" != "ERROR" ]; then
      echo -e "${GREEN}✅ API status query successful: $STATUS${NC}"
    else
      echo -e "${RED}❌ API status query failed${NC}"
      echo "$STATUS_RESPONSE"
    fi
  else
    echo -e "${RED}❌ API submission failed${NC}"
    echo "$API_RESPONSE"
  fi
fi

# Test 3: Check Lambda Logs for Errors
echo ""
echo "🧪 Test 3: Checking Lambda Logs for Errors"
echo "-------------------------------------------"

LAMBDAS=(
  "veritas-onboard-start-workflow"
  "veritas-onboard-redact-pii"
  "veritas-onboard-fraud-detector"
  "veritas-onboard-comprehend"
  "veritas-onboard-combine-scores"
  "veritas-onboard-save-dynamo"
)

ERROR_COUNT=0
for LAMBDA in "${LAMBDAS[@]}"; do
  ERRORS=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/$LAMBDA" \
    --start-time $(($(date +%s) - 600))000 \
    --filter-pattern "ERROR" \
    --query 'events[*].message' \
    --output text 2>/dev/null | wc -l)
  
  if [ "$ERRORS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $LAMBDA: $ERRORS errors found${NC}"
    ERROR_COUNT=$((ERROR_COUNT + 1))
  else
    echo -e "${GREEN}✅ $LAMBDA: No errors${NC}"
  fi
done

# Test 4: Check CloudWatch Metrics
echo ""
echo "🧪 Test 4: Checking CloudWatch Metrics"
echo "---------------------------------------"

INVOCATIONS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=veritas-onboard-start-workflow \
  --start-time $(date -u -v-10M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 600 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text 2>/dev/null || echo "0")

echo "📊 Lambda Invocations (last 10 min): $INVOCATIONS"

# Summary
echo ""
echo "=============================================="
echo "📋 TEST SUMMARY"
echo "=============================================="
echo ""

if [ "$EXECUTION_STATUS" == "SUCCEEDED" ] && [ "$DYNAMO_ITEM" != "NOT_FOUND" ]; then
  echo -e "${GREEN}✅ Backend Workflow: PASSED${NC}"
else
  echo -e "${RED}❌ Backend Workflow: FAILED${NC}"
fi

if [ "$BACKEND_ONLY" = false ]; then
  if [ "$API_REQUEST_ID" != "ERROR" ] && [ "$STATUS" != "ERROR" ]; then
    echo -e "${GREEN}✅ API Gateway Integration: PASSED${NC}"
  else
    echo -e "${RED}❌ API Gateway Integration: FAILED${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  API Gateway Integration: SKIPPED (not deployed)${NC}"
fi

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ Lambda Error Check: PASSED${NC}"
else
  echo -e "${YELLOW}⚠️  Lambda Error Check: $ERROR_COUNT functions with errors${NC}"
fi

echo ""
echo "=============================================="
echo ""

if [ "$EXECUTION_STATUS" == "SUCCEEDED" ] && [ "$DYNAMO_ITEM" != "NOT_FOUND" ]; then
  echo -e "${GREEN}🎉 INTEGRATION TEST PASSED!${NC}"
  echo ""
  echo "Your application is ready for demo! 🚀"
  echo ""
  echo "Next steps:"
  echo "1. Start frontend: cd frontend && npm run dev"
  echo "2. Open browser: http://localhost:3000"
  echo "3. Test the UI end-to-end"
  exit 0
else
  echo -e "${RED}❌ INTEGRATION TEST FAILED${NC}"
  echo ""
  echo "Check the errors above and fix before demo."
  exit 1
fi
