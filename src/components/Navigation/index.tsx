'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { MouseButtonRight, Gift, Wallet } from 'iconoir-react';
import { useTabs } from '@/providers/TabContext';
import type { Tab } from '@/providers/TabContext';

/**
 * Bottom navigation for ADS platform
 * Navigate between viewing ads, claiming rewards, and advertising
 */
export const Navigation = () => {
  const { activeTab, setActiveTab } = useTabs();

  const handleTabChange = (newTab: string) => {
    if (newTab === 'ads' || newTab === 'claim' || newTab === 'advertise') {
      setActiveTab(newTab as Tab);
    } else {
      console.warn('Invalid tab value received:', newTab);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="h-16 min-h-16 max-h-16 shadow-[0_-2px_5px_-1px_rgba(0,0,0,0.1)] border-t border-gray-200 w-full bg-white"
    >
      <TabItem
        value="ads"
        icon={<MouseButtonRight className="w-5 h-5" />}
        label="Browse Ads"
        className="rounded-md flex-1"
      />
      <TabItem
        value="claim"
        icon={<Gift className="w-5 h-5" />}
        label="Claim"
        className="rounded-md flex-1"
      />
      <TabItem
        value="advertise"
        icon={<Wallet className="w-5 h-5" />}
        label="Advertise"
        className="rounded-md flex-1"
      />
    </Tabs>
  );
};
