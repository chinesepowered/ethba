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
  { id: 1, name: 'US Only', icon: <MapPin className="w-4 h-4" />, eligible: false }, // Not shown to users (hardcoded)
  { id: 2, name: 'Argentina Only', icon: <MapPin className="w-4 h-4" />, eligible: true },
];

// For hackathon: only show Global (0) and Argentina (2) slots to users
const ELIGIBLE_SLOTS = [0, 2];

export function AdView({ userAddress }: AdViewProps) {
  const { currentCycle, currentAds, loading, refreshData, recordClick } = useADSContract();
  const [clicking, setClicking] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  const handleClick = async (slotIndex: number) => {
    if (!currentCycle) return;

    setClicking({ ...clicking, [slotIndex]: true });

    try {
      // Request click authorization from backend
      const response = await fetch('/api/authorize-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          cycle: currentCycle.toString(),
          slotIndex,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Not eligible for this ad');
      }

      const { nonce, timestamp, signature } = await response.json();

      // Record click on contract
      await recordClick(currentCycle, slotIndex, nonce, timestamp, signature);

      // Refresh data
      await refreshData();
      alert('Click recorded! You can claim your reward after the cycle ends.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record click';
      alert(errorMessage);
    } finally {
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
            Cycle {currentCycle?.toString() || '0'} • Click eligible ads to earn
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

      {/* Ads Grid */}
      {loading && currentAds.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading ads...</p>
        </div>
      ) : currentAds.length === 0 ? (
        <div className="text-center py-12 text-gray-600 bg-gray-50 rounded-xl">
          <p>No ads available for this cycle</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentAds
            .map((ad, index) => ({ ad, index }))
            .filter(({ index }) => ELIGIBLE_SLOTS.includes(index)) // Only show eligible slots
            .map(({ ad, index }) => {
              const hasAd = ad.advertiser !== '0x0000000000000000000000000000000000000000';
              const slot = SLOTS[index];

              if (!hasAd) {
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
                      {formatEther(ad.bidAmount)} WLD
                    </span>
                  </div>

                  {/* Ad Image */}
                  {ad.imageUrl && (
                    <Image
                      src={ad.imageUrl}
                      alt={ad.name}
                      width={400}
                      height={128}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}

                  {/* Ad Content */}
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{ad.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{ad.description}</p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{ad.totalClicks} clicks</span>
                    <span>
                      Est. {ad.totalClicks > 0
                        ? formatEther((ad.bidAmount * 95n) / 100n / (ad.totalClicks + 1n))
                        : formatEther((ad.bidAmount * 95n) / 100n)
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
