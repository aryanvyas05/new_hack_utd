#!/bin/bash

# Test Enhanced Veritas Onboard System
# Tests real validation logic and clean UI

API_URL="https://$(aws apigateway get-rest-apis --query "items[?name=='Veritas Onboard API'].id" --output text --no-cli-pager).execute-api.us-east-1.amazonaws.com/prod"

echo "🧪 Testing Enhanced Veritas Onboard System"
echo "=========================================="
echo ""

# Test 1: Legitimate Company (should be LOW risk, auto-approved)
echo "Test 1: Legitimate Company (Google)"
echo "-----------------------------------"
RESPONSE1=$(curl -s -X POST "$API_URL/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Google LLC",
    "contactEmail": "partnerships@google.com",
    "businessDescription": "Established technology company providing search, cloud computing, and enterprise software solutions. Certified and trusted global leader in technology services.",
    "taxId": "12-3456789"
  }')

REQUEST_ID1=$(echo $RESPONSE1 | jq -r '.requestId')
echo "Request ID: $REQUEST_ID1"
echo "Response: $RESPONSE1" | jq '.'
echo ""
sleep 3

# Check status
echo "Checking status..."
STATUS1=$(curl -s "$API_URL/status/$REQUEST_ID1")
echo "$STATUS1" | jq '{status, fraudScore: .riskScores.fraudScore, combinedRisk: .riskScores.combinedRiskScore}'
echo ""
echo ""

# Test 2: Suspicious Company (should be HIGH risk, manual review)
echo "Test 2: Suspicious Company"
echo "-----------------------------------"
RESPONSE2=$(curl -s -X POST "$API_URL/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "QuickCash Ventures",
    "contactEmail": "admin@tempmail.com",
    "businessDescription": "Urgent investment opportunity! Guaranteed returns! Limited time offer! Act now before this expires!",
    "taxId": "98-7654321"
  }')

REQUEST_ID2=$(echo $RESPONSE2 | jq -r '.requestId')
echo "Request ID: $REQUEST_ID2"
echo "Response: $RESPONSE2" | jq '.'
echo ""
sleep 3

# Check status
echo "Checking status..."
STATUS2=$(curl -s "$API_URL/status/$REQUEST_ID2")
echo "$STATUS2" | jq '{status, fraudScore: .riskScores.fraudScore, combinedRisk: .riskScores.combinedRiskScore}'
echo ""
echo ""

# Test 3: Non-existent Company (should be VERY HIGH risk)
echo "Test 3: Non-existent Company"
echo "-----------------------------------"
RESPONSE3=$(curl -s -X POST "$API_URL/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "FakeCompany XYZ",
    "contactEmail": "test@nonexistentdomain12345.com",
    "businessDescription": "Test company with no web presence",
    "taxId": "11-1111111"
  }')

REQUEST_ID3=$(echo $RESPONSE3 | jq -r '.requestId')
echo "Request ID: $REQUEST_ID3"
echo "Response: $RESPONSE3" | jq '.'
echo ""
sleep 3

# Check status
echo "Checking status..."
STATUS3=$(curl -s "$API_URL/status/$REQUEST_ID3")
echo "$STATUS3" | jq '{status, fraudScore: .riskScores.fraudScore, combinedRisk: .riskScores.combinedRiskScore}'
echo ""
echo ""

echo "=========================================="
echo "✅ Testing Complete!"
echo ""
echo "Summary:"
echo "--------"
echo "Test 1 (Google): Should be APPROVED with low risk (~10-15%)"
echo "Test 2 (Suspicious): Should be MANUAL_REVIEW with high risk (~80-90%)"
echo "Test 3 (Non-existent): Should be MANUAL_REVIEW with very high risk (~95%+)"
echo ""
echo "View results in browser:"
echo "Status 1: http://localhost:3000/status/$REQUEST_ID1"
echo "Status 2: http://localhost:3000/status/$REQUEST_ID2"
echo "Status 3: http://localhost:3000/status/$REQUEST_ID3"
