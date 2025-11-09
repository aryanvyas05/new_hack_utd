#!/bin/bash

echo "🔧 COMPLETE AUTH FIX"
echo "===================="
echo ""

USER_POOL_ID="us-east-1_hIBE2rCam"

echo "Step 1: Checking current users..."
USERS=$(aws cognito-idp list-users --user-pool-id "$USER_POOL_ID" --query 'Users[*].Username' --output text)

if [ -z "$USERS" ]; then
  echo "No users found. Creating fresh user..."
else
  echo "Found users. Deleting them..."
  for USERNAME in $USERS; do
    echo "  Deleting: $USERNAME"
    aws cognito-idp admin-delete-user --user-pool-id "$USER_POOL_ID" --username "$USERNAME" 2>/dev/null || true
  done
fi

echo ""
echo "Step 2: Creating fresh demo user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username demo@hackathon.com \
  --user-attributes \
    Name=email,Value=demo@hackathon.com \
    Name=email_verified,Value=true \
  --message-action SUPPRESS

echo ""
echo "Step 3: Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username demo@hackathon.com \
  --password "HackDemo123!" \
  --permanent

echo ""
echo "Step 4: Verifying user status..."
STATUS=$(aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username demo@hackathon.com --query 'UserStatus' --output text)
echo "User status: $STATUS"

echo ""
echo "Step 5: Cleaning frontend cache..."
cd frontend
rm -rf .next
cd ..

echo ""
echo "✅ AUTH FIXED!"
echo ""
echo "═══════════════════════════════════"
echo "  LOGIN CREDENTIALS"
echo "═══════════════════════════════════"
echo "  Email: demo@hackathon.com"
echo "  Password: HackDemo123!"
echo "═══════════════════════════════════"
echo ""
echo "Now do this:"
echo "1. cd frontend"
echo "2. npm run dev"
echo "3. Open http://localhost:3000"
echo "4. Login with credentials above"
echo "5. Clear browser cache if needed (Ctrl+Shift+Delete)"
echo ""
echo "If it STILL doesn't work:"
echo "  Read: EMERGENCY_AUTH_FIX.md"
