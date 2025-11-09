# Veritas Onboard Frontend

This is the frontend application for the Veritas Onboard platform, built with Next.js 14, TypeScript, and AWS Amplify.

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- AWS account with deployed backend infrastructure (CDK stacks)

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Copy the example environment file and fill in your AWS resource values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values from the CDK deployment outputs:

```env
NEXT_PUBLIC_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-user-pool-client-id
NEXT_PUBLIC_API_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=us-east-1
```

You can find these values in the CloudFormation outputs after deploying the CDK stacks.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building for Production

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Project Structure

```
frontend/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx           # Root layout with Amplify provider
│   ├── page.tsx             # Landing page with authentication
│   ├── onboard/             # Onboarding form page
│   └── status/[requestId]/  # Status check page
├── components/              # Reusable React components
│   ├── AmplifyProvider.tsx  # Amplify configuration wrapper
│   └── ProtectedRoute.tsx   # Authentication guard
├── lib/                     # Utility functions
│   ├── amplify-config.ts    # Amplify configuration
│   └── api.ts               # API client functions
├── types/                   # TypeScript type definitions
│   └── api.ts               # API request/response types
└── public/                  # Static assets

```

## Features

- **Authentication**: Cognito-based user authentication with sign-up, sign-in, and sign-out
- **Onboarding Form**: Dynamic form with validation for vendor information
- **Status Tracking**: Real-time status checking for onboarding requests
- **Risk Assessment Display**: Visual representation of fraud and sentiment analysis scores
- **Protected Routes**: Automatic redirection for unauthenticated users

## API Integration

The application integrates with the backend API Gateway endpoints:

- `POST /onboard` - Submit new onboarding request
- `GET /status/{requestId}` - Query onboarding status

All API calls are authenticated using JWT tokens from Cognito.

## Deployment

This application can be deployed using AWS Amplify Hosting (configured in the CDK Amplify stack) or any other hosting platform that supports Next.js.

### AWS Amplify Hosting

The CDK stack includes an Amplify hosting configuration. After deploying the CDK stacks, connect your Git repository to Amplify and it will automatically build and deploy the application.

### Manual Deployment

You can also deploy to other platforms like Vercel, Netlify, or AWS S3 + CloudFront:

1. Build the application: `npm run build`
2. Deploy the `.next` directory to your hosting platform
3. Ensure environment variables are configured in your hosting platform

## Troubleshooting

### Authentication Issues

- Verify that `NEXT_PUBLIC_USER_POOL_ID` and `NEXT_PUBLIC_USER_POOL_CLIENT_ID` are correct
- Check that the Cognito User Pool is properly configured
- Ensure email verification is enabled in Cognito

### API Connection Issues

- Verify that `NEXT_PUBLIC_API_ENDPOINT` is correct and includes the full URL
- Check that the API Gateway has CORS configured properly
- Ensure the Cognito authorizer is attached to the API endpoints

### Build Errors

- Clear the `.next` directory: `rm -rf .next`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check that all dependencies are installed correctly

## License

This project is part of the Veritas Onboard platform.
