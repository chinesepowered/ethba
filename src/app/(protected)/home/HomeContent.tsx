'use client';

import { useEffect, useState } from 'react';
import { useADSContract } from '@/hooks/useADSContract';
import { AdCard } from '@/components/AdCard';
import { Stats } from '@/components/Stats';
import { SwapCard } from '@/components/SwapCard';
import { Refresh, InfoCircle } from 'iconoir-react';
import { BACKEND_API_URL } from '@/config/contracts';

interface HomeContentProps {
  userAddress?: string;
}

export function HomeContent({ userAddress }: HomeContentProps) {
  const {
    currentCycle,
    currentAds,
    poolBalances,
    userBalance,
    loading,
    refreshData,
    hasUserClaimed: checkClaimed,
    isUserRegistered,
    getSwapEstimate,
    claimReward,
    swapADSForWLD,
  } = useADSContract();

  const [claimedStatus, setClaimedStatus] = useState<{ [key: number]: boolean }>({});
  const [claiming, setClaiming] = useState<{ [key: number]: boolean }>({});
  const [isRegistered, setIsRegistered] = useState(false);
  const [userSwapValue, setUserSwapValue] = useState<string>('0');

  // Load data on mount and when user address changes
  useEffect(() => {
    if (userAddress) {
      refreshData(userAddress);
      checkRegistration();
      updateSwapValue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  // Check claimed status for all ads
  useEffect(() => {
    if (!userAddress || !currentCycle || currentAds.length === 0) return;

    async function checkAllClaims() {
      const statuses: { [key: number]: boolean } = {};
      for (let i = 0; i < currentAds.length; i++) {
        if (currentAds[i].exists && !currentAds[i].removed) {
          statuses[i] = await checkClaimed(userAddress!, currentCycle!, i);
        }
      }
      setClaimedStatus(statuses);
    }

    checkAllClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, currentCycle, currentAds]);

  // Check if user is registered
  const checkRegistration = async () => {
    if (!userAddress) return;
    const registered = await isUserRegistered(userAddress);
    setIsRegistered(registered);
  };

  // Update swap value estimate
  const updateSwapValue = async () => {
    if (userBalance === 0n) {
      setUserSwapValue('0');
      return;
    }

    const value = await getSwapEstimate(userBalance.toString());
    setUserSwapValue(value);
  };

  // Handle claim
  const handleClaim = async (slotIndex: number) => {
    if (!userAddress || !currentCycle) return;

    setClaiming({ ...claiming, [slotIndex]: true });

    try {
      // Request signature from backend
      const response = await fetch(`${BACKEND_API_URL}/api/sign-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          cycle: currentCycle.toString(),
          slotIndex,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get signature from backend');
      }

      const { rewardAmount, nonce, timestamp, signature } = await response.json();

      // Execute claim on contract
      await claimReward(
        currentCycle,
        slotIndex,
        BigInt(rewardAmount),
        nonce,
        timestamp,
        signature
      );

      // Refresh data
      await refreshData(userAddress);
      setClaimedStatus({ ...claimedStatus, [slotIndex]: true });
    } catch (error: unknown) {
      console.error('Claim failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim reward';
      alert(errorMessage);
    } finally {
      setClaiming({ ...claiming, [slotIndex]: false });
    }
  };

  // Handle swap
  const handleSwap = async (amount: string) => {
    await swapADSForWLD(amount);
    if (userAddress) {
      await refreshData(userAddress);
      await updateSwapValue();
    }
  };

  if (!userAddress) {
    return (
      <div className="text-center text-gray-600">
        <p>Please sign in to view ads</p>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 max-w-md text-center">
        <InfoCircle className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Registration Required
        </h2>
        <p className="text-gray-700 mb-4">
          You need to register with World ID to claim rewards
        </p>
        <button className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors">
          Register with World ID
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Stats */}
      <Stats
        userBalance={userBalance}
        poolBalances={poolBalances}
        userSwapValue={userSwapValue}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Current Ads</h2>
          <p className="text-sm text-gray-600">
            Cycle {currentCycle?.toString() || '0'}
          </p>
        </div>
        <button
          onClick={() => userAddress && refreshData(userAddress)}
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
          {currentAds.map((ad, index) => (
            <AdCard
              key={index}
              ad={ad}
              slotIndex={index}
              canClaim={ad.exists && !ad.removed}
              hasClaimed={claimedStatus[index] || false}
              onClaim={() => handleClaim(index)}
              claiming={claiming[index] || false}
            />
          ))}
        </div>
      )}

      {/* Swap Section */}
      <div className="pt-8 border-t-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Swap Tokens</h2>
        <div className="flex justify-center">
          <SwapCard
            userBalance={userBalance.toString()}
            onSwap={handleSwap}
            getEstimate={getSwapEstimate}
          />
        </div>
      </div>
    </div>
  );
}
