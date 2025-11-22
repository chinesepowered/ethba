'use client';

import { Page } from '@/components/PageLayout';
import { AuthButton } from '@/components/AuthButton';
import { useSession } from 'next-auth/react';
import { Spinner } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      console.log('[page.tsx] Status authenticated, redirecting to /home...');
      router.push('/home');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <Page className="bg-gradient-to-br from-blue-50 to-purple-50">
        <Page.Main className="flex items-center justify-center">
          <Spinner />
        </Page.Main>
      </Page>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Page className="bg-gradient-to-br from-blue-50 to-purple-50">
        <Page.Main className="flex flex-col items-center justify-start px-4 py-8 overflow-y-auto">
          <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-lg max-w-md w-full my-auto">
            <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ADS Platform
            </h1>
            <p className="text-sm text-gray-600 mb-6 text-center">
              Decentralized Advertising with World ID
            </p>

            <AuthButton />

            <div className="w-full mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold mb-2 text-gray-800">
                How it Works
              </h3>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Bid WLD to display your ads</li>
                <li>• Click on ads to earn rewards</li>
                <li>• Verified with World ID</li>
                <li>• Fair and transparent</li>
              </ul>
            </div>
          </div>
        </Page.Main>
      </Page>
    );
  }

  return (
    <Page className="bg-gradient-to-br from-blue-50 to-purple-50">
      <Page.Main className="flex items-center justify-center">
        <Spinner />
      </Page.Main>
    </Page>
  );
}
