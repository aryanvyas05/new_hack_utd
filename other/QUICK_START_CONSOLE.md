# 🚀 Quick Start: Deploy via AWS Console (5 Steps)

## What You Need
- ✅ AWS Account
- ✅ The file: `veritas-onboard-deploy.zip` (already created - 225KB)
- ⏱️ Time: 20-30 minutes

## Step-by-Step

### 1️⃣ Open AWS CloudShell (2 minutes)

1. Go to: https://console.aws.amazon.com/
2. Sign in to your AWS account
3. Click the **CloudShell icon** (>_) in the top-right corner
4. Wait for CloudShell to load

### 2️⃣ Upload & Extract (3 minutes)

In CloudShell:

1. Click **"Actions" → "Upload file"**
2. Select `veritas-onboard-deploy.zip` from your computer
3. Wait for upload to complete

Then run:
```bash
unzip veritas-onboard-deploy.zip -d veritas-onboard
cd veritas-onboard
npm install
npm run build
```

### 3️⃣ Bootstrap CDK (2 minutes)

```bash
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
npx cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
```

### 4️⃣ Set Up Fraud Detector (3 minutes)

```bash
cd lambda/fraud-detector
chmod +x setup-fraud-detector.sh
./setup-fraud-detector.sh
cd ../..
```

### 5️⃣ Deploy Everything (15 minutes)

```bash
npx cdk deploy --all --require-approval never
```

**Wait for deployment to complete** (10-15 minutes)

## ✅ After Deployment

You'll see outputs like:
```
ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/prod
UserPoolId = us-east-1_ABC123
UserPoolClientId = 1234567890abcdef
```

**Save these values!**

## 🧪 Test It

### Create Test User:
```bash
USER_POOL_ID="us-east-1_ABC123"  # Replace with your value

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password TestPassword123! \
  --permanent
```

### Configure Frontend (On Your Computer):
```bash
cd frontend

cat > .env.local << EOF
NEXT_PUBLIC_API_ENDPOINT=https://abc123.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_USER_POOL_ID=us-east-1_ABC123
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1234567890abcdef
NEXT_PUBLIC_AWS_REGION=us-east-1
EOF

npm install
npm run dev
```

### Test:
1. Open: http://localhost:3000
2. Sign in: `testuser@example.com` / `TestPassword123!`
3. Submit an onboarding request
4. Check the status

## 💰 Cost Warning

This will cost approximately **$130-165/month** if you keep it running.

To avoid charges, destroy when done testing:
```bash
npx cdk destroy --all
```

## 📚 Need Help?

- **Detailed Guide**: See `AWS_CONSOLE_DEPLOYMENT.md`
- **Troubleshooting**: See `DEPLOYMENT_GUIDE.md`
- **Architecture**: See `.kiro/specs/veritas-onboard/design.md`

---

**That's it! You now have a fully functional AI-powered onboarding platform running in AWS.** 🎉
