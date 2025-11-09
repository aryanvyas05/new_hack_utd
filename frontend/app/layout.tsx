import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AmplifyProvider from '@/components/AmplifyProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Veritas Onboard',
  description: 'AI-powered vendor onboarding platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
