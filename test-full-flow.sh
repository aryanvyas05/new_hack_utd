#!/bin/bash

echo "🧪 Testing Full Theranos Flow with All Heuristics..."
echo ""

API_URL=$(grep NEXT_PUBLIC_API_URL frontend/.env.local | cut -d'=' -f2)

echo "📤 1. Submitting Theranos request..."
RESPONSE=$(curl -s -X POST "${API_URL}/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Theranos Inc",
    "contactEmail": "contact@theranos.com",
    "businessDescription": "Theranos was a health technology company founded in 2003 that claimed to revolutionize blood testing. The company faced fraud charges from the SEC in 2018. CEO Elizabeth Holmes was convicted of fraud in federal court in 2022. The company filed for bankruptcy and shut down operations after investigations revealed the technology did not work as claimed.",
    "taxId": "12-3456789",
    "sourceIp": "192.168.1.1"
  }')

REQUEST_ID=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('requestId', 'ERROR'))" 2>/dev/null)

if [ "$REQUEST_ID" = "ERROR" ] || [ -z "$REQUEST_ID" ]; then
  echo "❌ Failed to submit request"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ Request ID: $REQUEST_ID"
echo ""

echo "⏳ 2. Waiting for analysis (15 seconds)..."
sleep 15

echo ""
echo "📊 3. Fetching results..."
STATUS=$(curl -s "${API_URL}/status/${REQUEST_ID}")

echo ""
echo "==================================="
echo "📈 RISK SCORES:"
echo "==================================="
echo $STATUS | python3 -c "
import sys, json
data = json.load(sys.stdin)
scores = data.get('riskScores', {})
print(f\"Combined Risk: {scores.get('combinedRiskScore', 0)*100:.1f}%\")
print(f\"Fraud Risk: {scores.get('fraudScore', 0)*100:.1f}%\")
print(f\"Network Risk: {scores.get('networkRiskScore', 0)*100:.1f}%\")
print(f\"Entity Risk: {scores.get('entityRiskScore', 0)*100:.1f}%\")
print(f\"Behavioral Risk: {scores.get('behavioralRiskScore', 0)*100:.1f}%\")
print(f\"Payment Risk: {scores.get('paymentRiskScore', 0)*100:.1f}%\")
print(f\"Legal Risk: {scores.get('legalRiskScore', 0)*100:.1f}%\")
" 2>/dev/null

echo ""
echo "==================================="
echo "⚖️  LEGAL ANALYSIS:"
echo "==================================="
echo $STATUS | python3 -c "
import sys, json
data = json.load(sys.stdin)
legal = data.get('fraudDetails', {}).get('legalAnalysis', {})
issues = data.get('fraudDetails', {}).get('legalIssues', [])
print(f\"Legal Status: {data.get('fraudDetails', {}).get('legalStatus', 'N/A')}\")
print(f\"Legal Issues Found: {len(issues)}\")
for issue in issues[:3]:
    print(f\"  - {issue.get('category')}: {issue.get('keyword')} (Severity: {issue.get('severity', 0)*100:.0f}%)\")
" 2>/dev/null

echo ""
echo "==================================="
echo "💳 PAYMENT ANALYSIS:"
echo "==================================="
echo $STATUS | python3 -c "
import sys, json
data = json.load(sys.stdin)
insights = data.get('fraudDetails', {}).get('paymentInsights', [])
print(f\"Reliability: {data.get('fraudDetails', {}).get('reliabilityRating', 'N/A')}\")
print(f\"Payment Insights: {len(insights)}\")
for insight in insights[:3]:
    print(f\"  - {insight.get('type')}: {insight.get('message')}\")
" 2>/dev/null

echo ""
echo "🌐 View full results with pie charts at:"
echo "http://localhost:3000/status/${REQUEST_ID}"
echo ""
echo "✅ Test complete!"
