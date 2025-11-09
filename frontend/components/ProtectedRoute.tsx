'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from 'aws-amplify/auth';
import { View, Loader } from '@aws-amplify/ui-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      await getCurrentUser();
      setIsAuthenticated(true);
    } catch (error) {
      console.log('User not authenticated, redirecting to login');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Loader size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
