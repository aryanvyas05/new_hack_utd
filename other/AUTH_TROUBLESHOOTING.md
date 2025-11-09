# 🔐 Auth Troubleshooting Guide

## Error: "Unable to get user session following successful sign-in"

This error happens when Cognito authentication succeeds but the session can't be established. Here's how to fix it:

### Quick Fix (Try These First)

1. **Clear Browser Data**
   - Open DevTools (F12)
   - Go to Application tab
   - Clear all storage (cookies, local storage, session storage)
   - Refresh page

2. **Restart Frontend**
   ```bash
   # Stop the dev server (Ctrl+C)
   cd frontend
   rm -rf .next
   npm run dev
   ```

3. **Try Incognito Mode**
   - Open a new incognito/private window
   - Go to http://localhost:3000
   - Try logging in

### Fix the User (Run This Script)

```bash
./fix-cognito-user.sh
```

This will:
- Confirm the user
- Verify their email
- Set a permanent password

### Manual User Fix

If the script doesn't work, do this manually:

```bash
# Get user pool ID
USER_POOL_ID="us-east-1_hIBE2rCam"

# List users
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# Get the username from the output, then:
USERNAME="<username-from-above>"

# Confirm user
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME \
  --password "DemoPass123!" \
  --permanent

# Verify email
aws cognito-idp admin-update-user-attributes \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME \
  --user-attributes Name=email_verified,Value=true
```

### Create a Fresh User

If nothing works, create a completely new user:

```bash
# Delete old user
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_hIBE2rCam \
  --username <old-username>

# Create new user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_hIBE2rCam \
  --username demo@example.com \
  --user-attributes Name=email,Value=demo@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS

# Set password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_hIBE2rCam \
  --username demo@example.com \
  --password "DemoPass123!" \
  --permanent
```

Then login with:
- Email: demo@example.com
- Password: DemoPass123!

### Check Environment Variables

Make sure your `.env.local` has the correct values:

```bash
cat frontend/.env.local
```

Should show:
```
NEXT_PUBLIC_USER_POOL_ID=us-east-1_hIBE2rCam
NEXT_PUBLIC_USER_POOL_CLIENT_ID=64im5nmb95i62n7i93hs940nsf
NEXT_PUBLIC_API_ENDPOINT=https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### Verify Cognito Configuration

```bash
# Check user pool exists
aws cognito-idp describe-user-pool --user-pool-id us-east-1_hIBE2rCam

# Check client exists
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_hIBE2rCam \
  --client-id 64im5nmb95i62n7i93hs940nsf
```

### Alternative: Bypass Auth for Demo

If you're in a hurry for the demo, you can temporarily bypass auth:

1. Edit `frontend/app/page.tsx`
2. Comment out the `<Authenticator>` wrapper
3. Just show the welcome page directly

Example:
```typescript
export default function Home() {
  const router = useRouter();

  return (
    <View padding="2rem">
      <Heading level={1}>Veritas Onboard</Heading>
      <Button onClick={() => router.push('/onboard')}>
        Start Onboarding
      </Button>
    </View>
  );
}
```

### Still Not Working?

Check browser console for errors:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red errors
4. Share the error message

Common errors and fixes:
- **"User pool client does not exist"** → Wrong CLIENT_ID in .env.local
- **"User pool does not exist"** → Wrong USER_POOL_ID in .env.local
- **"Network error"** → Check internet connection
- **"Invalid session"** → Clear browser storage and try again

### Test Login Credentials

Current user:
- Email: `abinashbastola72@gmail.com`
- Password: `DemoPass123!`

If this doesn't work, create a new user with the commands above.

## 🎯 Quick Test

After fixing, test with:

1. Go to http://localhost:3000
2. Enter email and password
3. Should see welcome page
4. Click "Start Onboarding Process"
5. Should go to /onboard page

If you get past step 3, auth is working! 🎉
