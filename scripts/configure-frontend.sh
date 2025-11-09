#!/bin/bash

# Script to configure frontend environment variables from CDK outputs
# Usage: ./scripts/configure-frontend.sh [environment]

set -e

ENVIRONMENT=${1:-dev}
STACK_PREFIX="veritas-onboard-${ENVIRONMENT}"
REGION=${AWS_REGION:-us-east-1}

echo "Configuring frontend for environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Function to get CloudFormation output value
get_output() {
    local stack_name=$1
    local output_key=$2
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Get values from CloudFormation stacks
echo "Fetching CloudFormation outputs..."

USER_POOL_ID=$(get_output "${STACK_PREFIX}-amplify" "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output "${STACK_PREFIX}-amplify" "UserPoolClientId")
API_ENDPOINT=$(get_output "${STACK_PREFIX}-api" "ApiEndpoint")

# Validate that we got all required values
if [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ] || [ -z "$API_ENDPOINT" ]; then
    echo "Error: Could not retrieve all required CloudFormation outputs"
    echo "USER_POOL_ID: ${USER_POOL_ID:-NOT FOUND}"
    echo "USER_POOL_CLIENT_ID: ${USER_POOL_CLIENT_ID:-NOT FOUND}"
    echo "API_ENDPOINT: ${API_ENDPOINT:-NOT FOUND}"
    echo ""
    echo "Make sure the stacks are deployed successfully:"
    echo "  cdk deploy --all"
    exit 1
fi

# Create .env.local file
ENV_FILE="frontend/.env.local"

echo "Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# AWS Cognito Configuration
# Auto-generated from CloudFormation outputs on $(date)
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID

# API Gateway Configuration
NEXT_PUBLIC_API_ENDPOINT=$API_ENDPOINT
NEXT_PUBLIC_AWS_REGION=$REGION
EOF

echo ""
echo "✅ Frontend configuration complete!"
echo ""
echo "Configuration written to: $ENV_FILE"
echo ""
echo "Values:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  API Endpoint: $API_ENDPOINT"
echo "  AWS Region: $REGION"
echo ""
echo "You can now run the frontend:"
echo "  cd frontend"
echo "  npm install"
echo "  npm run dev"
