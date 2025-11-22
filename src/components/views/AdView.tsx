'use client';

import { useEffect, useState } from 'react';
import { useADSContract } from '@/hooks/useADSContract';
import { Refresh, InfoCircle, Globe, MapPin, Phone, Monitor, Apple, Robot } from 'iconoir-react';
import { formatEther } from 'viem';

interface AdViewProps {
  userAddress: string;
}

const SLOT_TYPE_ICONS: Record<number, JSX.Element> = {
  0: <Globe className="w-4 h-4" />,  // GLOBAL
  1: <MapPin className="w-4 h-4" />, // US_ONLY
  2: <MapPin className="w-4 h-4" />, // AR_ONLY
  3: <MapPin className="w-4 h-4" />, // EU_ONLY
  4: <MapPin className="w-4 h-4" />, // ASIA_ONLY
  5: <Phone className="w-4 h-4" />,  // MOBILE_ONLY
  6: <Monitor className="w-4 h-4" />, // DESKTOP_ONLY
  7: <Apple className="w-4 h-4" />,  // IOS_ONLY
  8: <Robot className="w-4 h-4" />,  // ANDROID_ONLY
  9: <InfoCircle className="w-4 h-4" />, // CUSTOM
};

const SLOT_TYPE_NAMES = [
  'Global', 'US Only', 'Argentina Only', 'EU Only', 'Asia Only',
  'Mobile Only', 'Desktop Only', 'iOS Only', 'Android Only', 'Custom'
];

export function AdView({ userAddress }: AdViewProps) {
  const { currentCycle, currentAds, loading, refreshData, recordClick, isUserRegistered } = useADSContract();
  const [clicking, setClicking] = useState<{ [key: number]: boolean }>({});
  const [isRegistered, setIsRegistered] = useState(false);
  const [userEligibility, setUserEligibility] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    refreshData(userAddress);
    checkRegistration();
    checkEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  const checkRegistration = async () => {
    const registered = await isUserRegistered(userAddress);
    setIsRegistered(registered);
  };

  const checkEligibility = async () => {
    // Check eligibility for each slot type
    // In a real app, this would query the backend
    const eligibility: { [key: number]: boolean } = {};
    for (let i = 0; i < 10; i++) {
      // For demo, assume user is eligible for GLOBAL, US_ONLY, and MOBILE_ONLY
      eligibility[i] = currentAds[i]?.slotType === 0 || currentAds[i]?.slotType === 1 || currentAds[i]?.slotType === 5;
    }
    setUserEligibility(eligibility);
  };

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
          slotType: currentAds[slotIndex].slotType,
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
      await refreshData(userAddress);
      alert('Click recorded! You can claim your reward after the cycle ends.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record click';
      alert(errorMessage);
    } finally {
      setClicking({ ...clicking, [slotIndex]: false });
    }
  };

  if (!isRegistered) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
        <InfoCircle className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Required</h2>
        <p className="text-gray-700 mb-4">
          You need to register with World ID to click ads and earn rewards
        </p>
        <button className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors">
          Register with World ID
        </button>
      </div>
    );
  }

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
          onClick={() => refreshData(userAddress)}
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
          {currentAds.map((ad, index) => {
            const isEligible = userEligibility[index];
            const hasAd = ad.advertiser !== '0x0000000000000000000000000000000000000000';

            if (!hasAd) {
              return (
                <div
                  key={index}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400"
                >
                  <p className="text-sm">Slot {index} - No ad yet</p>
                </div>
              );
            }

            return (
              <div
                key={index}
                className={`border-2 rounded-xl p-6 transition-all ${
                  isEligible
                    ? 'border-blue-200 bg-white hover:border-blue-400 cursor-pointer'
                    : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                }`}
                onClick={() => isEligible && !clicking[index] && handleClick(index)}
              >
                {/* Slot Type Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                    isEligible ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {SLOT_TYPE_ICONS[ad.slotType]}
                    {SLOT_TYPE_NAMES[ad.slotType]}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatEther(ad.bidAmount)} WLD
                  </span>
                </div>

                {/* Ad Image */}
                {ad.imageUrl && (
                  <img
                    src={ad.imageUrl}
                    alt={ad.name}
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
                      ? formatEther((ad.bidAmount * 95n) / 100n / BigInt(ad.totalClicks + 1))
                      : formatEther((ad.bidAmount * 95n) / 100n)
                    } WLD/click
                  </span>
                </div>

                {/* Action Button */}
                {!isEligible ? (
                  <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-center text-sm font-semibold">
                    Not Eligible
                  </div>
                ) : clicking[index] ? (
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
