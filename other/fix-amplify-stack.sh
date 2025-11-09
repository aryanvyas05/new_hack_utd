#!/bin/bash

echo "🔧 Fixing Amplify Stack Deployment Issue"
echo "========================================="
echo ""

# The Amplify stack is stuck in UPDATE_ROLLBACK_COMPLETE
# We need to delete it and redeploy

echo "Step 1: Checking current stack status..."
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name veritas-onboard-dev-amplify \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

echo "Current status: $STACK_STATUS"
echo ""

if [ "$STACK_STATUS" == "UPDATE_ROLLBACK_COMPLETE" ]; then
  echo "⚠️  Stack is in failed state. We need to delete and recreate it."
  echo ""
  echo "Step 2: Deleting the failed stack..."
  
  aws cloudformation delete-stack --stack-name veritas-onboard-dev-amplify
  
  echo "Waiting for stack deletion to complete (this may take 2-3 minutes)..."
  aws cloudformation wait stack-delete-complete --stack-name veritas-onboard-dev-amplify
  
  if [ $? -eq 0 ]; then
    echo "✅ Stack deleted successfully"
  else
    echo "❌ Stack deletion failed or timed out"
    echo ""
    echo "Manual steps required:"
    echo "1. Go to AWS Console → CloudFormation"
    echo "2. Find veritas-onboard-dev-amplify stack"
    echo "3. Delete it manually"
    echo "4. Then run: npx cdk deploy veritas-onboard-dev-amplify --require-approval never"
    exit 1
  fi
fi

echo ""
echo "Step 3: Redeploying Amplify stack..."
npx cdk deploy veritas-onboard-dev-amplify --require-approval never

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Amplify stack deployed successfully!"
  echo ""
  echo "Step 4: Now deploying remaining stacks..."
  npx cdk deploy veritas-onboard-dev-api veritas-onboard-dev-monitoring --require-approval never
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 ALL STACKS DEPLOYED SUCCESSFULLY!"
    echo ""
    echo "Your Cognito User Pool is ready:"
    aws cloudformation describe-stacks \
      --stack-name veritas-onboard-dev-amplify \
      --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
      --output text
  fi
else
  echo ""
  echo "❌ Amplify stack deployment failed"
  echo ""
  echo "Check the error above and try again"
  exit 1
fi
