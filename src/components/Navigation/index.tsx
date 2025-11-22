'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { Home, Coin, ArrowsLeftRightFromLine } from 'iconoir-react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Bottom navigation for ADS platform
 * Navigate between viewing ads, claiming rewards, and swapping tokens
 */
export const Navigation = () => {
  const pathname = usePathname();
  const router = useRouter();

  const handleValueChange = (newValue: string) => {
    if (newValue === 'home') {
      router.push('/home');
    }
    // Add more routes when created
  };

  return (
    <Tabs value={pathname.includes('/home') ? 'home' : 'home'} onValueChange={handleValueChange}>
      <TabItem value="home" icon={<Home />} label="Ads" />
      <TabItem value="rewards" icon={<Coin />} label="Rewards" />
      <TabItem value="swap" icon={<ArrowsLeftRightFromLine />} label="Swap" />
    </Tabs>
  );
};
