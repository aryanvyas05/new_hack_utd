#!/bin/bash

echo "🚀 Deploying Advanced KYC Features"
echo "===================================="
echo ""

# Deploy Network Analysis Lambda
echo "1. Deploying Network Analysis Lambda..."
cd lambda/network-analysis
zip -r network-analysis.zip lambda_function.py
aws lambda create-function \
  --function-name veritas-onboard-network-analysis \
  --runtime python3.12 \
  --role arn:aws:iam::127214165197:role/veritas-onboard-dev-workf-FraudDetectorFunctionServ-6wFjNvzJJ9mO \
  --handler lambda_function.lambda_handler \
  --timeout 60 \
  --memory-size 512 \
  --zip-file fileb://network-analysis.zip \
  --description "Network analysis for fraud ring detection" \
  --no-cli-pager 2>/dev/null || \
aws lambda update-function-code \
  --function-name veritas-onboard-network-analysis \
  --zip-file fileb://network-analysis.zip \
  --no-cli-pager
cd ../..
echo "✅ Network Analysis deployed"
echo ""

# Deploy Entity Resolution Lambda
echo "2. Deploying Entity Resolution Lambda..."
cd lambda/entity-resolution
zip -r entity-resolution.zip lambda_function.py
aws lambda create-function \
  --function-name veritas-onboard-entity-resolution \
  --runtime python3.12 \
  --role arn:aws:iam::127214165197:role/veritas-onboard-dev-workf-FraudDetectorFunctionServ-6wFjNvzJJ9mO \
  --handler lambda_function.lambda_handler \
  --timeout 60 \
  --memory-size 512 \
  --zip-file fileb://entity-resolution.zip \
  --description "Entity resolution and sanctions screening" \
  --no-cli-pager 2>/dev/null || \
aws lambda update-function-code \
  --function-name veritas-onboard-entity-resolution \
  --zip-file fileb://entity-resolution.zip \
  --no-cli-pager
cd ../..
echo "✅ Entity Resolution deployed"
echo ""

# Deploy Behavioral Analysis Lambda
echo "3. Deploying Behavioral Analysis Lambda..."
cd lambda/behavioral-analysis
zip -r behavioral-analysis.zip lambda_function.py
aws lambda create-function \
  --function-name veritas-onboard-behavioral-analysis \
  --runtime python3.12 \
  --role arn:aws:iam::127214165197:role/veritas-onboard-dev-workf-FraudDetectorFunctionServ-6wFjNvzJJ9mO \
  --handler lambda_function.lambda_handler \
  --timeout 60 \
  --memory-size 512 \
  --zip-file fileb://behavioral-analysis.zip \
  --description "Behavioral anomaly detection" \
  --no-cli-pager 2>/dev/null || \
aws lambda update-function-code \
  --function-name veritas-onboard-behavioral-analysis \
  --zip-file fileb://behavioral-analysis.zip \
  --no-cli-pager
cd ../..
echo "✅ Behavioral Analysis deployed"
echo ""

# Deploy Advanced Risk Orchestrator
echo "4. Deploying Advanced Risk Orchestrator..."
cd lambda/advanced-risk-orchestrator
zip -r orchestrator.zip lambda_function.py
aws lambda create-function \
  --function-name veritas-onboard-advanced-orchestrator \
  --runtime python3.12 \
  --role arn:aws:iam::127214165197:role/veritas-onboard-dev-workf-FraudDetectorFunctionServ-6wFjNvzJJ9mO \
  --handler lambda_function.lambda_handler \
  --timeout 120 \
  --memory-size 1024 \
  --zip-file fileb://orchestrator.zip \
  --description "Orchestrates all advanced risk analyses" \
  --no-cli-pager 2>/dev/null || \
aws lambda update-function-code \
  --function-name veritas-onboard-advanced-orchestrator \
  --zip-file fileb://orchestrator.zip \
  --no-cli-pager
cd ../..
echo "✅ Advanced Orchestrator deployed"
echo ""

echo "===================================="
echo "✅ All Advanced Features Deployed!"
echo ""
echo "New Capabilities:"
echo "  🕸️  Network Analysis - Fraud ring detection"
echo "  🔍 Entity Resolution - Sanctions screening"
echo "  🤖 Behavioral Analysis - Anomaly detection"
echo "  🎯 Advanced Orchestrator - Combines all analyses"
echo ""
echo "These Lambdas are now ready to be integrated into your Step Functions workflow!"
