#!/bin/bash

echo "🔐 Deploying Authentication System..."

# Create DynamoDB table for users
echo "Creating users table..."
aws dynamodb create-table \
  --table-name veritas-users \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 2>/dev/null || echo "Table already exists"

# Get account ID and role
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/veritas-onboard-dev-workf-FraudDetectorFunctionS-6wFjNvzJJ9mO"

# Generate JWT secret (in production, use AWS Secrets Manager)
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JWT Secret: $JWT_SECRET"
echo "⚠️  SAVE THIS SECRET - You'll need it for all auth functions!"

# Package and deploy auth-handler Lambda
echo "Deploying auth-handler Lambda..."
cd lambda/auth-handler
pip install -r requirements.txt -t . --quiet
zip -r function.zip . -x "*.pyc" -x "__pycache__/*" > /dev/null
aws lambda create-function \
  --function-name veritas-onboard-auth-handler \
  --runtime python3.12 \
  --role $ROLE_ARN \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment "Variables={JWT_SECRET=$JWT_SECRET,USERS_TABLE=veritas-users}" \
  --region us-east-1 2>/dev/null || \
aws lambda update-function-code \
  --function-name veritas-onboard-auth-handler \
  --zip-file fileb://function.zip \
  --region us-east-1
aws lambda update-function-configuration \
  --function-name veritas-onboard-auth-handler \
  --environment "Variables={JWT_SECRET=$JWT_SECRET,USERS_TABLE=veritas-users}" \
  --region us-east-1 > /dev/null
rm function.zip
cd ../..

# Deploy JWT authorizer Lambda
echo "Deploying JWT authorizer Lambda..."
cd lambda/jwt-authorizer
zip -r function.zip lambda_function.py > /dev/null
aws lambda create-function \
  --function-name veritas-onboard-jwt-authorizer \
  --runtime python3.12 \
  --role $ROLE_ARN \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment "Variables={JWT_SECRET=$JWT_SECRET}" \
  --region us-east-1 2>/dev/null || \
aws lambda update-function-code \
  --function-name veritas-onboard-jwt-authorizer \
  --zip-file fileb://function.zip \
  --region us-east-1
aws lambda update-function-configuration \
  --function-name veritas-onboard-jwt-authorizer \
  --environment "Variables={JWT_SECRET=$JWT_SECRET}" \
  --region us-east-1 > /dev/null
rm function.zip
cd ../..

echo ""
echo "✅ Authentication system deployed!"
echo ""
echo "📝 Next steps:"
echo "1. Save the JWT_SECRET above to your .env file"
echo "2. Configure API Gateway to use the JWT authorizer"
echo "3. Add auth routes to your API Gateway"
echo "4. Test registration and login flows"
echo ""
echo "🔑 JWT Secret: $JWT_SECRET"
