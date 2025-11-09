# Frontend Setup Guide

## Quick Start

Follow these steps to set up and run the frontend application:

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

After deploying the CDK backend stacks, you'll receive CloudFormation outputs with the necessary values. Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your values:

```env
NEXT_PUBLIC_USER_POOL_ID=<from AmplifyStack output>
NEXT_PUBLIC_USER_POOL_CLIENT_ID=<from AmplifyStack output>
NEXT_PUBLIC_API_ENDPOINT=<from ApiStack output>
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Getting CloudFormation Outputs

After deploying the CDK stacks, retrieve the outputs:

```bash
# From the project root
cd ..
aws cloudformation describe-stacks --stack-name VeritasOnboardAmplifyStack --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name VeritasOnboardApiStack --query 'Stacks[0].Outputs'
```

Look for outputs like:
- `UserPoolId`
- `UserPoolClientId`
- `ApiEndpoint`

## First Time User Flow

1. Open http://localhost:3000
2. Click "Create Account" 
3. Enter email and password (must meet requirements: 8+ chars, uppercase, lowercase, number, symbol)
4. Verify email with the code sent to your inbox
5. Sign in with your credentials
6. Click "Start Onboarding Process"
7. Fill out the onboarding form
8. Submit and view the status page

## Troubleshooting

### "Cannot find module" errors
Run `npm install` to install all dependencies.

### Authentication not working
- Verify environment variables are set correctly
- Check that the Cognito User Pool is deployed
- Ensure you've verified your email address

### API calls failing
- Verify the API Gateway endpoint is correct
- Check that the API Gateway is deployed and accessible
- Ensure CORS is configured on the API Gateway
- Verify you're signed in (JWT token is required)

## Next Steps

After the frontend is running locally, you can:
1. Test the complete onboarding flow
2. Deploy to AWS Amplify Hosting (configured in CDK)
3. Configure a custom domain
4. Set up CI/CD for automatic deployments
