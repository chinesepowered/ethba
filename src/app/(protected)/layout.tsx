'use client';

import { Page } from '@/components/PageLayout';
import { TabProvider } from '@/providers/TabContext';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('Not authenticated, redirecting...');
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <Page className="bg-background">
        <div className="flex h-screen items-center justify-center">
          <div className="animate-pulse text-primary-300">Loading...</div>
        </div>
      </Page>
    );
  }

  if (status === 'authenticated') {
    return (
      <TabProvider>
        <Page className="flex flex-col h-screen bg-gradient-to-b from-blue-50 to-purple-50 text-foreground">
          <div className="flex-grow overflow-y-auto">
            {children}
          </div>
        </Page>
      </TabProvider>
    );
  }

  return null;
}
