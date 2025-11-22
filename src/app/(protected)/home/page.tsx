'use client';

import { useState, useEffect } from 'react';
import { Page } from '@/components/PageLayout';
import { RegistrationView } from '@/components/views/RegistrationView';
import { AdView } from '@/components/views/AdView';
import { ClaimView } from '@/components/views/ClaimView';
import { AdvertiserView } from '@/components/views/AdvertiserView';
import { Navigation } from '@/components/Navigation';
import { Marble, TopBar, Spinner } from '@worldcoin/mini-apps-ui-kit-react';
import { useSession } from 'next-auth/react';
import { useTabs } from '@/providers/TabContext';
import { useADSClient } from '@/hooks/useADSClient';
import { CONTRACTS } from '@/config/contracts';
import { ADS_DEMO_ABI } from '@/config/abi';
import type { Address } from 'viem';

export default function HomePage() {
  const { data: session } = useSession();
  const { activeTab, dataVersion } = useTabs();
  const client = useADSClient();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Get wallet address from session following proven pattern
  const walletAddress = session?.user?.id as Address | undefined;

  // Check registration status
  useEffect(() => {
    const checkRegistration = async () => {
      if (!walletAddress) {
        setIsChecking(false);
        return;
      }

      try {
        // Check cache first
        const cached = localStorage.getItem(`ads_registered_${walletAddress}`);
        if (cached === 'true') {
          setIsRegistered(true);
          setIsChecking(false);
          return;
        }

        // Check contract
        const registered = await client.readContract({
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'registered',
          args: [walletAddress],
        }) as boolean;

        setIsRegistered(registered);
        if (registered) {
          localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
        }
      } catch (error) {
        console.error('Failed to check registration:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkRegistration();
  }, [walletAddress, dataVersion, client]);

  // Show loading while checking
  if (isChecking) {
    return (
      <>
        <Page.Header className="sticky top-0 p-0 border-b border-gray-200 shadow-sm bg-white">
          <div className="w-full px-4 max-w-2xl mx-auto">
            <TopBar title="ADS Platform" className="py-3" />
          </div>
        </Page.Header>
        <Page.Main className="flex flex-col items-center justify-center h-64">
          <Spinner className="w-8 h-8" />
          <span className="ml-2 text-sm text-gray-600 mt-2">Loading...</span>
        </Page.Main>
      </>
    );
  }

  // Show registration view if not registered
  if (!isRegistered) {
    return (
      <>
        <Page.Header className="sticky top-0 p-0 border-b border-gray-200 shadow-sm bg-white">
          <div className="w-full px-4 max-w-2xl mx-auto">
            <TopBar
              title="ADS Platform"
              endAdornment={
                session?.user && (
                  <div className="flex items-center gap-2">
                    <div className="border-2 border-blue-300 rounded-full p-0.5">
                      <Marble src={session.user.profilePictureUrl} className="w-8 h-8" />
                    </div>
                  </div>
                )
              }
              className="py-3"
            />
          </div>
        </Page.Header>
        <Page.Main className="flex flex-col items-center justify-start pt-8">
          <RegistrationView />
        </Page.Main>
      </>
    );
  }

  // Show main app content once registered
  return (
    <>
      <Page.Header className="sticky top-0 p-0 border-b border-gray-200 shadow-sm bg-white">
        <div className="w-full px-4 max-w-2xl mx-auto">
          <TopBar
            title="ADS Platform"
            endAdornment={
              session?.user && (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">
                    {session.user.username}
                  </p>
                  <div className="border-2 border-blue-300 rounded-full p-0.5">
                    <Marble src={session.user.profilePictureUrl} className="w-8 h-8" />
                  </div>
                </div>
              )
            }
            className="py-3"
          />
        </div>
      </Page.Header>

      <Page.Main className="flex flex-col items-center justify-start mb-16">
        <div className="w-full px-3 pt-2 max-w-2xl mx-auto">
          {activeTab === 'ads' && <AdView userAddress={walletAddress || ''} />}
          {activeTab === 'claim' && <ClaimView userAddress={walletAddress || ''} />}
          {activeTab === 'advertise' && <AdvertiserView userAddress={walletAddress || ''} />}
        </div>
      </Page.Main>

      <Page.Footer className="px-0 fixed bottom-0 w-full bg-white shadow-md border-t border-gray-200">
        <Navigation />
      </Page.Footer>
    </>
  );
}
