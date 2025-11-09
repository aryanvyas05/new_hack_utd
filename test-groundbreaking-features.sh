#!/bin/bash

echo "🧪 Testing Groundbreaking Features"
echo "===================================="
echo ""

# Test payload
PAYLOAD='{
  "requestId": "test-123",
  "vendorName": "Microsoft Corporation",
  "contactEmail": "partnerships@microsoft.com",
  "businessDescription": "Established enterprise software and cloud computing company providing Windows, Office, Azure, and other business solutions to enterprises worldwide.",
  "taxId": "12-3456789",
  "sourceIp": "192.168.1.100",
  "submittedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

echo "Test Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

# Test 1: Network Analysis
echo "1. Testing Network Analysis..."
echo "------------------------------"
aws lambda invoke \
  --function-name veritas-onboard-network-analysis \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  network-result.json \
  --no-cli-pager > /dev/null 2>&1

if [ -f network-result.json ]; then
  echo "✅ Network Analysis Result:"
  cat network-result.json | jq '{networkRiskScore, networkRiskFactors}'
else
  echo "❌ Network Analysis Failed"
fi
echo ""

# Test 2: Entity Resolution
echo "2. Testing Entity Resolution..."
echo "------------------------------"
aws lambda invoke \
  --function-name veritas-onboard-entity-resolution \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  entity-result.json \
  --no-cli-pager > /dev/null 2>&1

if [ -f entity-result.json ]; then
  echo "✅ Entity Resolution Result:"
  cat entity-result.json | jq '{entityRiskScore, complianceStatus, extractedEntities}'
else
  echo "❌ Entity Resolution Failed"
fi
echo ""

# Test 3: Behavioral Analysis
echo "3. Testing Behavioral Analysis..."
echo "------------------------------"
aws lambda invoke \
  --function-name veritas-onboard-behavioral-analysis \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  behavioral-result.json \
  --no-cli-pager > /dev/null 2>&1

if [ -f behavioral-result.json ]; then
  echo "✅ Behavioral Analysis Result:"
  cat behavioral-result.json | jq '{behavioralRiskScore, detectedAnomalies}'
else
  echo "❌ Behavioral Analysis Failed"
fi
echo ""

# Test 4: Advanced Orchestrator (combines all 3)
echo "4. Testing Advanced Orchestrator..."
echo "------------------------------"
aws lambda invoke \
  --function-name veritas-onboard-advanced-orchestrator \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  orchestrator-result.json \
  --no-cli-pager > /dev/null 2>&1

if [ -f orchestrator-result.json ]; then
  echo "✅ Comprehensive Analysis Result:"
  cat orchestrator-result.json | jq '{comprehensiveRiskScore, recommendation, networkRiskScore, entityRiskScore, behavioralRiskScore}'
else
  echo "❌ Orchestrator Failed"
fi
echo ""

echo "===================================="
echo "✅ Testing Complete!"
echo ""
echo "Results saved to:"
echo "  - network-result.json"
echo "  - entity-result.json"
echo "  - behavioral-result.json"
echo "  - orchestrator-result.json"
