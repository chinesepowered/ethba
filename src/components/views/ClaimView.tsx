'use client';

import { useEffect, useState } from 'react';
import { useADSContract } from '@/hooks/useADSContract';
import { Refresh, Gift, Timer, CheckCircle } from 'iconoir-react';
import { formatEther } from 'viem';

interface ClaimViewProps {
  userAddress: string;
}

interface ClaimableReward {
  cycle: bigint;
  slot: bigint;
  amount: bigint;
  deadline?: number;
}

export function ClaimView({ userAddress }: ClaimViewProps) {
  const { getUserClaimableRewards, claimReward, loading, refreshData } = useADSContract();
  const [claims, setClaims] = useState<ClaimableReward[]>([]);
  const [claiming, setClaiming] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  const loadClaims = async () => {
    try {
      const { cycles, slots, amounts } = await getUserClaimableRewards(userAddress);

      const claimableRewards: ClaimableReward[] = cycles.map((cycle, index) => ({
        cycle,
        slot: slots[index],
        amount: amounts[index],
      }));

      setClaims(claimableRewards);
    } catch (error) {
      console.error('Failed to load claims:', error);
    }
  };

  const handleClaim = async (cycle: bigint, slot: bigint) => {
    const key = `${cycle}-${slot}`;
    setClaiming({ ...claiming, [key]: true });

    try {
      await claimReward(cycle, slot);
      await loadClaims();
      await refreshData();
      alert('Reward claimed successfully!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim reward';
      alert(errorMessage);
    } finally {
      setClaiming({ ...claiming, [key]: false });
    }
  };

  const handleClaimAll = async () => {
    for (const claim of claims) {
      try {
        await claimReward(claim.cycle, claim.slot);
      } catch (error) {
        console.error(`Failed to claim cycle ${claim.cycle} slot ${claim.slot}:`, error);
      }
    }
    await loadClaims();
    await refreshData();
    alert('All rewards claimed!');
  };

  const totalClaimable = claims.reduce((sum, claim) => sum + claim.amount, 0n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Claim Rewards</h2>
          <p className="text-sm text-gray-600">
            {claims.length} reward{claims.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={loadClaims}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <Refresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Total Summary */}
      {claims.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Claimable</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatEther(totalClaimable)} WLD
              </p>
            </div>
            <button
              onClick={handleClaimAll}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Claim All
            </button>
          </div>
        </div>
      )}

      {/* Claims List */}
      {claims.length === 0 ? (
        <div className="text-center py-12 text-gray-600 bg-gray-50 rounded-xl">
          <Gift className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="font-semibold mb-2">No rewards to claim yet</p>
          <p className="text-sm">Click on ads to earn rewards!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim, index) => {
            const key = `${claim.cycle}-${claim.slot}`;
            const isClaiming = claiming[key];

            return (
              <div
                key={index}
                className="border-2 border-gray-200 rounded-xl p-6 bg-white hover:border-green-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        Cycle {claim.cycle.toString()}
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                        Slot {claim.slot.toString()}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatEther(claim.amount)} WLD
                      </p>
                    </div>
                    {claim.deadline && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                        <Timer className="w-4 h-4" />
                        <span>Claim deadline: {new Date(claim.deadline * 1000).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleClaim(claim.cycle, claim.slot)}
                    disabled={isClaiming}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isClaiming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Claiming...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Claim
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2">How Claims Work</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• After a cycle ends and is finalized, you can claim your proportional share</li>
          <li>• Your reward = (Bid Amount - 5% Fee) / Total Clicks for that slot</li>
          <li>• You have 14 days to claim after finalization</li>
          <li>• Unclaimed rewards after 14 days go to the platform</li>
        </ul>
      </div>
    </div>
  );
}
