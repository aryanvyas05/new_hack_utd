#!/bin/bash

echo "🧪 Testing direct API submission..."

curl -X POST "https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Theranos Inc",
    "contactEmail": "test@theranos.com",
    "businessDescription": "Theranos was a health technology company founded in 2003 that claimed to revolutionize blood testing. The company faced fraud charges from the SEC in 2018. CEO Elizabeth Holmes was convicted of fraud in federal court in 2022. The company filed for bankruptcy and shut down operations after investigations revealed the technology did not work as claimed.",
    "taxId": "12-3456789",
    "sourceIp": "1.2.3.4"
  }' | python3 -m json.tool

echo ""
echo "✅ Check the logs now!"
