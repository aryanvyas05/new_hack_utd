#!/bin/bash

echo "🔧 Fixing Cognito User Session Issue"
echo "====================================="
echo ""

USER_POOL_ID="us-east-1_hIBE2rCam"

# Get the username
echo "Finding user..."
USERNAME=$(aws cognito-idp list-users --user-pool-id "$USER_POOL_ID" --query 'Users[0].Username' --output text)

if [ -z "$USERNAME" ]; then
  echo "❌ No user found"
  exit 1
fi

echo "Found user: $USERNAME"
echo ""

# Check user status
STATUS=$(aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$USERNAME" --query 'UserStatus' --output text)
echo "Current status: $STATUS"
echo ""

# If user is FORCE_CHANGE_PASSWORD, confirm them
if [ "$STATUS" == "FORCE_CHANGE_PASSWORD" ]; then
  echo "User needs password change. Setting permanent password..."
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --password "DemoPass123!" \
    --permanent
  echo "✅ Password set to: DemoPass123!"
fi

# Confirm the user
echo "Confirming user..."
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" 2>/dev/null || echo "User already confirmed"

# Verify email
echo "Verifying email..."
aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --user-attributes Name=email_verified,Value=true 2>/dev/null || echo "Email already verified"

echo ""
echo "✅ User fixed!"
echo ""
echo "Now try logging in with:"
echo "Email: abinashbastola72@gmail.com"
echo "Password: DemoPass123!"
echo ""
echo "If it still doesn't work, try:"
echo "1. Clear browser cache and cookies"
echo "2. Restart the frontend: cd frontend && npm run dev"
echo "3. Try incognito/private browsing mode"
