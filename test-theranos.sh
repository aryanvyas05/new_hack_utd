#!/bin/bash

echo "🧪 Testing Theranos Analysis with New Heuristics..."
echo ""

# Submit onboarding request
echo "1. Submitting Theranos onboarding request..."
RESPONSE=$(curl -s -X POST "$(cat frontend/.env.local | grep NEXT_PUBLIC_API_URL | cut -d'=' -f2)/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Theranos",
    "contactEmail": "contact@theranos.com",
    "businessDescription": "Theranos was a health technology company founded in 2003 that claimed to revolutionize blood testing with proprietary technology. The company faced fraud charges from the SEC in 2018. CEO Elizabeth Holmes was convicted of fraud in federal court in 2022. The company filed for bankruptcy and shut down operations after investigations revealed the technology did not work as claimed. Multiple lawsuits were filed against the company.",
    "taxId": "12-3456789",
    "sourceIp": "192.168.1.1"
  }')

REQUEST_ID=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('requestId', 'ERROR'))")

if [ "$REQUEST_ID" = "ERROR" ]; then
  echo "❌ Failed to submit request"
  echo $RESPONSE
  exit 1
fi

echo "✅ Request submitted: $REQUEST_ID"
echo ""

# Wait for processing
echo "2. Waiting for analysis to complete (10 seconds)..."
sleep 10

# Get status
echo ""
echo "3. Fetching analysis results..."
STATUS=$(curl -s "$(cat frontend/.env.local | grep NEXT_PUBLIC_API_URL | cut -d'=' -f2)/status/$REQUEST_ID")

echo ""
echo "📊 RESULTS:"
echo "=========================================="
echo $STATUS | python3 -m json.tool | grep -A 2 "legalRiskScore\|paymentRiskScore\|legalStatus\|reliabilityRating\|legalIssues"

echo ""
echo "🌐 View full results at:"
echo "http://localhost:3000/status/$REQUEST_ID"
echo ""
echo "✅ Test complete!"
