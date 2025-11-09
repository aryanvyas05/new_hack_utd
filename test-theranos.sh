#!/bin/bash

echo "🧪 Testing with Theranos-like fraudulent company..."

# Submit a high-risk vendor with fraud indicators
REQUEST_ID=$(curl -s -X POST \
  https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Theranos Health Solutions Inc",
    "contactEmail": "admin@theranos-fake.xyz",
    "businessDescription": "Revolutionary blood testing company founded in 2003. We were sued in 2023 for fraud. Case No. 2023-CV-8765. SEC charges filed for securities fraud. Company filed for bankruptcy in 2024. Federal investigation ongoing. Settlement of $500 million with investors. Criminal charges pending against executives. Ponzi scheme allegations from multiple sources. Money laundering investigation by FBI. Federal court case in progress. Multiple regulatory violations cited by FDA. Consumer complaints filed with FTC and BBB. Patent infringement lawsuit from competitors. Discrimination lawsuit from former employees. Company operates from sanctioned jurisdiction. Negative news coverage about deceptive practices.",
    "taxId": "11-1111111",
    "sourceIp": "192.168.1.100"
  }' | jq -r '.requestId')

echo "✅ Submitted Theranos test: $REQUEST_ID"
echo ""
echo "⏳ Waiting 15 seconds for processing..."
sleep 15

echo ""
echo "📊 Fetching results..."
curl -s "https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/status/$REQUEST_ID" | jq '.'

echo ""
echo "🌐 View in browser:"
echo "http://localhost:3000/status/$REQUEST_ID"
