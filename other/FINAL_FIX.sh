#!/bin/bash

set -e

echo "🚨 FINAL FIX FOR AMPLIFY STACK"
echo "==============================="
echo ""
echo "Current situation:"
echo "- Amplify stack: STUCK (UPDATE_ROLLBACK_COMPLETE)"
echo "- API stack: WORKING (but depends on Amplify)"
echo "- Cognito: EXISTS and WORKING"
echo ""
echo "Fix: Delete API → Delete Amplify → Redeploy both"
echo ""

read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  exit 0
fi

echo ""
echo "Step 1/4: Deleting API stack..."
aws cloudformation delete-stack --stack-name veritas-onboard-dev-api
echo "Waiting for API deletion (30 seconds)..."
sleep 30

echo ""
echo "Step 2/4: Deleting Amplify stack..."
aws cloudformation delete-stack --stack-name veritas-onboard-dev-amplify
echo "Waiting for Amplify deletion (60 seconds)..."
sleep 60

echo ""
echo "Step 3/4: Redeploying Amplify (Cognito)..."
npx cdk deploy veritas-onboard-dev-amplify --require-approval never

if [ $? -ne 0 ]; then
  echo "❌ Failed to deploy Amplify"
  exit 1
fi

echo ""
echo "Step 4/4: Redeploying API..."
npx cdk deploy veritas-onboard-dev-api --require-approval never

if [ $? -ne 0 ]; then
  echo "❌ Failed to deploy API"
  exit 1
fi

echo ""
echo "🎉 SUCCESS! Everything is deployed!"
echo ""
echo "Your credentials:"
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-amplify --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-amplify --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
API_URL=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-api --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)

echo "NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_USER_POOL_CLIENT_ID=$CLIENT_ID"
echo "NEXT_PUBLIC_API_ENDPOINT=$API_URL"
echo "NEXT_PUBLIC_AWS_REGION=us-east-1"
