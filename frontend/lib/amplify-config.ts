import { ResourcesConfig } from 'aws-amplify';

// Amplify configuration from environment variables
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
  API: {
    REST: {
      VeritasOnboardAPI: {
        endpoint: process.env.NEXT_PUBLIC_API_ENDPOINT!,
        region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
      },
    },
  },
};

export default amplifyConfig;
