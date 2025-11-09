#!/bin/bash

set -e

echo "🔧 Fixing Auth & API Stack Deployment"
echo "======================================"
echo ""

echo "The issue: Amplify stack is stuck because API stack depends on it."
echo "Solution: Delete API → Delete Amplify → Redeploy Amplify → Redeploy API"
echo ""

read -p "This will temporarily delete your API Gateway. Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Step 1: Deleting API stack..."
aws cloudformation delete-stack --stack-name veritas-onboard-dev-api

echo "Waiting for API stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name veritas-onboard-dev-api 2>/dev/null || true

echo "✅ API stack deleted"
echo ""

echo "Step 2: Deleting Amplify stack..."
aws cloudformation delete-stack --stack-name veritas-onboard-dev-amplify

echo "Waiting for Amplify stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name veritas-onboard-dev-amplify 2>/dev/null || true

echo "✅ Amplify stack deleted"
echo ""

echo "Step 3: Redeploying Amplify stack (Cognito)..."
npx cdk deploy veritas-onboard-dev-amplify --require-approval never

if [ $? -ne 0 ]; then
  echo "❌ Amplify deployment failed"
  exit 1
fi

echo "✅ Amplify stack deployed"
echo ""

echo "Step 4: Redeploying API stack..."
npx cdk deploy veritas-onboard-dev-api --require-approval never

if [ $? -ne 0 ]; then
  echo "❌ API deployment failed"
  exit 1
fi

echo "✅ API stack deployed"
echo ""

echo "Step 5: Deploying monitoring stack..."
npx cdk deploy veritas-onboard-dev-monitoring --require-approval never

echo ""
echo "🎉 ALL STACKS DEPLOYED SUCCESSFULLY!"
echo ""
echo "📋 Your Configuration:"
echo "====================="
echo ""

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name veritas-onboard-dev-amplify \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name veritas-onboard-dev-amplify \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

API_URL=$(aws cloudformation describe-stacks \
  --stack-name veritas-onboard-dev-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

echo "Cognito User Pool ID: $USER_POOL_ID"
echo "Cognito Client ID: $USER_POOL_CLIENT_ID"
echo "API Gateway URL: $API_URL"
echo ""

echo "Update your frontend/.env.local with these values!"
echo ""
echo "NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"
echo "NEXT_PUBLIC_API_ENDPOINT=$API_URL"
echo "NEXT_PUBLIC_AWS_REGION=us-east-1"
