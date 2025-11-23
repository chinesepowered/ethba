'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useADSContract } from '@/hooks/useADSContract';
import { Refresh, Globe, MapPin } from 'iconoir-react';
import { formatEther } from 'viem';

interface AdViewProps {
  userAddress: string;
}

// Slot definitions (matches backend and contract)
const SLOTS = [
  { id: 0, name: 'Global', icon: <Globe className="w-4 h-4" />, eligible: true },
  { id: 1, name: 'US Only', icon: <MapPin className="w-4 h-4" />, eligible: false },
  { id: 2, name: 'Argentina Only', icon: <MapPin className="w-4 h-4" />, eligible: true },
];

// For hackathon: only show Global (0) and Argentina (2) slots to users
const ELIGIBLE_SLOTS = [0, 2];

export function AdView({ userAddress }: AdViewProps) {
  const { currentCycle, loading, refreshData, recordClick, getAdsForCycle } = useADSContract();
  const [clicking, setClicking] = useState<{ [key: number]: boolean }>({});
  const [clickableAds, setClickableAds] = useState<any[]>([]);

  // Calculate clickable cycle (previous cycle, not current)
  // Contract validation: cycle must be < currentCycle
  const clickableCycle = currentCycle !== null && currentCycle > 0n ? currentCycle - 1n : null;

  // Fetch ads from the clickable cycle (not currentCycle)
  useEffect(() => {
    const loadClickableAds = async () => {
      if (clickableCycle !== null) {
        const ads = await getAdsForCycle(clickableCycle);
        setClickableAds(ads);
      } else {
        setClickableAds([]);
      }
    };

    loadClickableAds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickableCycle]); // Only re-run when clickableCycle changes

  const handleClick = async (slotIndex: number) => {
    console.log(`[AdView] 🖱️ Click button pressed for slot ${slotIndex}`);
    console.log(`[AdView] 📊 State - clickableCycle: ${clickableCycle}, currentCycle: ${currentCycle}, userAddress: ${userAddress}`);

    if (!clickableCycle) {
      console.log('[AdView] ❌ No clickable cycle available');
      return;
    }

    console.log(`[AdView] 📡 Requesting authorization for cycle ${clickableCycle.toString()}, slot ${slotIndex}`);
    setClicking({ ...clicking, [slotIndex]: true });

    try {
      // Request click authorization from backend
      // IMPORTANT: Use clickableCycle (previous cycle), not currentCycle
      const requestBody = {
        userAddress,
        cycle: clickableCycle.toString(),
        slotIndex,
      };
      console.log('[AdView] 📤 Sending request to /api/authorize-click:', requestBody);

      const response = await fetch('/api/authorize-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[AdView] 📨 Authorization response status:', response.status, response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.error('[AdView] ❌ Authorization failed:', error);
        throw new Error(error.error || 'Not eligible for this ad');
      }

      const authData = await response.json();
      console.log('[AdView] ✅ Authorization data received:', { nonce: authData.nonce, timestamp: authData.timestamp, signatureLength: authData.signature?.length });

      const { nonce, timestamp, signature } = authData;

      // Record click on contract (use clickableCycle, not currentCycle)
      console.log('[AdView] 🔗 Calling recordClick with:', { cycle: clickableCycle.toString(), slotIndex, nonce, timestamp });
      const txResult = await recordClick(clickableCycle, slotIndex, nonce, timestamp, signature);
      console.log('[AdView] ✅ recordClick succeeded:', txResult);

      // Refresh data
      console.log('[AdView] 🔄 Refreshing data...');
      await refreshData();
      console.log('[AdView] ✅ Click recorded successfully!');
      alert('Click recorded! You can claim your reward after the cycle ends.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record click';
      console.error('[AdView] ❌ handleClick error:', error);
      console.error('[AdView] ❌ Error message:', errorMessage);
      console.error('[AdView] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      alert(errorMessage);
    } finally {
      console.log('[AdView] 🏁 Resetting clicking state for slot', slotIndex);
      setClicking({ ...clicking, [slotIndex]: false });
    }
  };

  // Registration is now handled at the app level - this view only shows when registered

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Browse Ads</h2>
          <p className="text-sm text-gray-600">
            {clickableCycle !== null
              ? `Viewing Cycle ${clickableCycle.toString()} • Click to earn rewards`
              : `Current Cycle ${currentCycle?.toString() || '0'} • Waiting for ads`
            }
          </p>
        </div>
        <button
          onClick={() => refreshData()}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <Refresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Cycle 0 Notice */}
      {currentCycle === 0n && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
          <h3 className="font-bold text-blue-900 mb-2">🎯 First Cycle Setup</h3>
          <p className="text-sm text-blue-800">
            We're in Cycle 0! Advertisers are placing their first bids.
            After the cycle progresses to Cycle 1, you'll be able to click and earn from these ads.
          </p>
          <p className="text-xs text-blue-700 mt-2">
            Tip: Click the "Next Cycle" button above to progress when ready!
          </p>
        </div>
      )}

      {/* Ads Grid */}
      {loading && clickableAds.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading ads...</p>
        </div>
      ) : clickableCycle === null ? (
        <div className="text-center py-12 text-gray-600 bg-gray-50 rounded-xl">
          <p className="font-semibold mb-2">No Clickable Ads Yet</p>
          <p className="text-sm">Ads will become clickable after the cycle progresses.</p>
        </div>
      ) : clickableAds.length === 0 ? (
        <div className="text-center py-12 text-gray-600 bg-gray-50 rounded-xl">
          <p>No ads available for this cycle</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clickableAds
            .map((ad, index) => {
              console.log(`[AdView] Slot ${index}:`, {
                hasAd: ad && ad.advertiser && ad.advertiser !== '0x0000000000000000000000000000000000000000',
                advertiser: ad?.advertiser,
                name: ad?.name,
                bidAmount: ad?.bidAmount?.toString(),
                eligible: ELIGIBLE_SLOTS.includes(index)
              });
              return { ad, index };
            })
            .filter(({ index }) => ELIGIBLE_SLOTS.includes(index)) // Only show eligible slots
            .map(({ ad, index }) => {
              const hasAd = ad && ad.advertiser && ad.advertiser !== '0x0000000000000000000000000000000000000000';
              const slot = SLOTS[index];

              if (!hasAd || !ad) {
                return (
                  <div
                    key={index}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400"
                  >
                    <p className="text-sm">{slot.name} - No ad yet</p>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className="border-2 border-blue-200 bg-white hover:border-blue-400 cursor-pointer rounded-xl p-6 transition-all"
                  onClick={() => !clicking[index] && handleClick(index)}
                >
                  {/* Slot Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {slot.icon}
                      {slot.name}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatEther(ad.bidAmount || 0n)} WLD
                    </span>
                  </div>

                  {/* Ad Image */}
                  {ad.imageUrl && (
                    <Image
                      src={ad.imageUrl}
                      alt={ad.name || 'Ad'}
                      width={400}
                      height={128}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}

                  {/* Ad Content */}
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{ad.name || 'Unnamed Ad'}</h3>
                  <p className="text-sm text-gray-600 mb-3">{ad.description || ''}</p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{ad.totalClicks?.toString() || '0'} clicks</span>
                    <span>
                      Est. {(ad.totalClicks || 0n) > 0
                        ? formatEther(((ad.bidAmount || 0n) * 95n) / 100n / ((ad.totalClicks || 0n) + 1n))
                        : formatEther(((ad.bidAmount || 0n) * 95n) / 100n)
                      } WLD/click
                    </span>
                  </div>

                  {/* Action Button */}
                  {clicking[index] ? (
                    <div className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-center text-sm font-semibold">
                      Recording Click...
                    </div>
                  ) : (
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-center text-sm font-semibold hover:bg-blue-700 transition-colors">
                      Click to Earn
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
