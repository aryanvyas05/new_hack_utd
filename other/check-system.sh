#!/bin/bash

echo "🔍 Checking Veritas Onboard System Status"
echo "=========================================="
echo ""

# Check API Gateway
echo "1. API Gateway"
echo "-------------"
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='Veritas Onboard API'].id" --output text --no-cli-pager 2>/dev/null)
if [ -n "$API_ID" ]; then
    echo "✅ API Gateway found: $API_ID"
    API_URL="https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
    echo "   URL: $API_URL"
else
    echo "❌ API Gateway not found"
fi
echo ""

# Check Lambda Functions
echo "2. Lambda Functions"
echo "------------------"
LAMBDAS=(
    "veritas-onboard-fraud-detector"
    "veritas-onboard-combine-scores"
    "veritas-onboard-comprehend"
    "veritas-onboard-redact-pii"
    "veritas-onboard-save-dynamo"
    "veritas-onboard-notify-admin"
    "veritas-onboard-query-status"
)

for lambda in "${LAMBDAS[@]}"; do
    STATUS=$(aws lambda get-function --function-name "$lambda" --query 'Configuration.State' --output text --no-cli-pager 2>/dev/null)
    if [ "$STATUS" = "Active" ]; then
        echo "✅ $lambda: Active"
    else
        echo "❌ $lambda: Not found or inactive"
    fi
done
echo ""

# Check DynamoDB Table
echo "3. DynamoDB Table"
echo "----------------"
TABLE_STATUS=$(aws dynamodb describe-table --table-name OnboardingRequests --query 'Table.TableStatus' --output text --no-cli-pager 2>/dev/null)
if [ "$TABLE_STATUS" = "ACTIVE" ]; then
    echo "✅ DynamoDB table: Active"
else
    echo "❌ DynamoDB table: Not found or inactive"
fi
echo ""

# Check Step Functions
echo "4. Step Functions"
echo "----------------"
STATE_MACHINE=$(aws stepfunctions list-state-machines --query "stateMachines[?contains(name, 'veritas-onboard')].name" --output text --no-cli-pager 2>/dev/null)
if [ -n "$STATE_MACHINE" ]; then
    echo "✅ State Machine found: $STATE_MACHINE"
else
    echo "❌ State Machine not found"
fi
echo ""

# Check Frontend
echo "5. Frontend"
echo "----------"
if [ -d "frontend" ]; then
    echo "✅ Frontend directory exists"
    if [ -f "frontend/package.json" ]; then
        echo "✅ package.json found"
    else
        echo "❌ package.json not found"
    fi
    if [ -d "frontend/node_modules" ]; then
        echo "✅ node_modules installed"
    else
        echo "⚠️  node_modules not found - run 'npm install'"
    fi
else
    echo "❌ Frontend directory not found"
fi
echo ""

# Test API Endpoint
echo "6. API Health Check"
echo "------------------"
if [ -n "$API_URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        echo "✅ API is responding (HTTP $HTTP_CODE)"
    else
        echo "⚠️  API returned HTTP $HTTP_CODE"
    fi
else
    echo "⚠️  Cannot test - API URL not found"
fi
echo ""

echo "=========================================="
echo "System Check Complete!"
echo ""
echo "To start the system:"
echo "  1. cd frontend && npm run dev"
echo "  2. Open http://localhost:3000"
echo ""
echo "To test the backend:"
echo "  ./test-enhanced-system.sh"
