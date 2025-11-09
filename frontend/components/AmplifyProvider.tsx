'use client';

import { Amplify } from 'aws-amplify';
import amplifyConfig from '@/lib/amplify-config';
import '@aws-amplify/ui-react/styles.css';

// Configure Amplify
Amplify.configure(amplifyConfig, { ssr: true });

export default function AmplifyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
