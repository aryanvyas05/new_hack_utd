#!/bin/bash

set -e

echo "☢️  NUCLEAR OPTION - COMPLETE RESET"
echo "===================================="
echo ""
echo "This will:"
echo "1. Force delete API and Amplify stacks"
echo "2. Delete Cognito resources manually"
echo "3. Rebuild everything from scratch"
echo ""
read -p "Type 'NUKE' to continue: " CONFIRM

if [ "$CONFIRM" != "NUKE" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🔥 Step 1: Force deleting API stack..."
aws cloudformation delete-stack --stack-name veritas-onboard-dev-api 2>/dev/null || true
sleep 10

echo ""
echo "🔥 Step 2: Force deleting Amplify stack..."
aws cloudformation delete-stack --stack-name veritas-onboard-dev-amplify 2>/dev/null || true
sleep 10

echo ""
echo "🔥 Step 3: Manually deleting Cognito User Pool..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`veritas-onboard-dev-amplify-user-pool`].Id' --output text 2>/dev/null || echo "")

if [ ! -z "$USER_POOL_ID" ]; then
  echo "Found User Pool: $USER_POOL_ID"
  
  # Delete all clients first
  echo "Deleting User Pool Clients..."
  CLIENTS=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --query 'UserPoolClients[*].ClientId' --output text 2>/dev/null || echo "")
  for CLIENT in $CLIENTS; do
    echo "  Deleting client: $CLIENT"
    aws cognito-idp delete-user-pool-client --user-pool-id "$USER_POOL_ID" --client-id "$CLIENT" 2>/dev/null || true
  done
  
  # Delete the pool
  echo "Deleting User Pool..."
  aws cognito-idp delete-user-pool --user-pool-id "$USER_POOL_ID" 2>/dev/null || true
  echo "✅ Cognito deleted"
else
  echo "No Cognito User Pool found"
fi

echo ""
echo "⏳ Waiting 60 seconds for AWS to clean up..."
sleep 60

echo ""
echo "🔥 Step 4: Checking if stacks are gone..."
API_EXISTS=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-api 2>&1 | grep -c "does not exist" || echo "0")
AMPLIFY_EXISTS=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-amplify 2>&1 | grep -c "does not exist" || echo "0")

if [ "$API_EXISTS" -eq 0 ]; then
  echo "⚠️  API stack still exists, waiting another 60 seconds..."
  sleep 60
fi

if [ "$AMPLIFY_EXISTS" -eq 0 ]; then
  echo "⚠️  Amplify stack still exists, waiting another 60 seconds..."
  sleep 60
fi

echo ""
echo "✅ Old resources cleaned up!"
echo ""
echo "🚀 Step 5: Deploying fresh Amplify stack..."
npx cdk deploy veritas-onboard-dev-amplify --require-approval never

if [ $? -ne 0 ]; then
  echo "❌ Amplify deployment failed"
  echo ""
  echo "Manual fix required:"
  echo "1. Go to AWS Console → CloudFormation"
  echo "2. Delete veritas-onboard-dev-amplify stack manually"
  echo "3. Go to AWS Console → Cognito"
  echo "4. Delete any remaining user pools"
  echo "5. Run: npx cdk deploy veritas-onboard-dev-amplify --require-approval never"
  exit 1
fi

echo ""
echo "✅ Amplify deployed!"
echo ""
echo "🚀 Step 6: Deploying API stack..."
npx cdk deploy veritas-onboard-dev-api --require-approval never

if [ $? -ne 0 ]; then
  echo "❌ API deployment failed"
  exit 1
fi

echo ""
echo "✅ API deployed!"
echo ""
echo "🚀 Step 7: Deploying monitoring stack..."
npx cdk deploy veritas-onboard-dev-monitoring --require-approval never

echo ""
echo "🎉 SUCCESS! Everything is rebuilt!"
echo ""
echo "📋 Your new configuration:"
echo "=========================="

USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-amplify --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-amplify --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
API_URL=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-api --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)

echo ""
echo "NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_USER_POOL_CLIENT_ID=$CLIENT_ID"
echo "NEXT_PUBLIC_API_ENDPOINT=$API_URL"
echo "NEXT_PUBLIC_AWS_REGION=us-east-1"
echo ""

# Update frontend/.env.local
cat > frontend/.env.local << EOF
# AWS Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$CLIENT_ID

# API Gateway Configuration
NEXT_PUBLIC_API_ENDPOINT=$API_URL
NEXT_PUBLIC_AWS_REGION=us-east-1
EOF

echo "✅ Updated frontend/.env.local"
echo ""
echo "🎯 Next steps:"
echo "1. Test the backend: ./test-workflow.sh"
echo "2. Start frontend: cd frontend && npm run dev"
echo "3. Create a test user in Cognito (AWS Console)"
echo "4. Test the full app!"
