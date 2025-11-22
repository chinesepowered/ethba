'use client';

import { useState } from 'react';
import { AdvertiserView } from '@/components/views/AdvertiserView';
import { AdView } from '@/components/views/AdView';
import { ClaimView } from '@/components/views/ClaimView';
import { Wallet, MouseButtonRight, Gift } from 'iconoir-react';

interface HomeContentProps {
  userAddress?: string;
}

type ViewTab = 'ads' | 'advertise' | 'claim';

export function HomeContent({ userAddress }: HomeContentProps) {
  const [activeView, setActiveView] = useState<ViewTab>('ads');

  if (!userAddress) {
    return (
      <div className="text-center text-gray-600 p-8">
        <p>Please sign in to access the platform</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* View Navigation */}
      <div className="flex gap-2 p-2 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveView('ads')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
            activeView === 'ads'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MouseButtonRight className="w-5 h-5" />
          Browse Ads
        </button>
        <button
          onClick={() => setActiveView('claim')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
            activeView === 'claim'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Gift className="w-5 h-5" />
          Claim Rewards
        </button>
        <button
          onClick={() => setActiveView('advertise')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
            activeView === 'advertise'
              ? 'bg-white text-purple-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Wallet className="w-5 h-5" />
          Advertise
        </button>
      </div>

      {/* Active View Content */}
      <div className="min-h-[600px]">
        {activeView === 'ads' && <AdView userAddress={userAddress} />}
        {activeView === 'claim' && <ClaimView userAddress={userAddress} />}
        {activeView === 'advertise' && <AdvertiserView userAddress={userAddress} />}
      </div>
    </div>
  );
}
