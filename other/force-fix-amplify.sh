#!/bin/bash

echo "🔧 Force Fixing Amplify Stack"
echo "=============================="
echo ""

echo "The stack is stuck in UPDATE_ROLLBACK_COMPLETE state."
echo "We'll delete the CloudFormation stack but KEEP the Cognito resources."
echo ""

# Get the Cognito User Pool ID before we do anything
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`veritas-onboard-dev-amplify-user-pool`].Id' --output text)

echo "Current Cognito User Pool ID: $USER_POOL_ID"
echo ""

# Try to delete with retention
echo "Attempting to delete stack while retaining resources..."
aws cloudformation delete-stack \
  --stack-name veritas-onboard-dev-amplify \
  --retain-resources OnboardingUserPool3945B2E6 OnboardingUserPoolClient9DAD8780

echo "Waiting for deletion..."
sleep 10

# Check if deleted
STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name veritas-onboard-dev-amplify 2>&1 | grep -c "does not exist" || echo "0")

if [ "$STACK_EXISTS" -gt 0 ]; then
  echo "✅ Stack deleted successfully"
  echo ""
  echo "Now redeploying..."
  npx cdk deploy veritas-onboard-dev-amplify --require-approval never
else
  echo "⚠️  Stack still exists. Trying manual AWS CLI approach..."
  echo ""
  echo "Run these commands manually:"
  echo ""
  echo "1. Delete the stack from AWS Console:"
  echo "   https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks"
  echo ""
  echo "2. Or use AWS CLI to force delete:"
  echo "   aws cloudformation delete-stack --stack-name veritas-onboard-dev-amplify"
  echo ""
  echo "3. Then redeploy:"
  echo "   npx cdk deploy veritas-onboard-dev-amplify --require-approval never"
fi
