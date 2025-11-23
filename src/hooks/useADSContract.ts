import { useState, useEffect } from 'react';
import { type Address } from 'viem';
import { MiniKit } from '@worldcoin/minikit-js';
import { CONTRACTS } from '@/config/contracts';
import { ADS_DEMO_ABI } from '@/config/abi';
import { useADSClient } from './useADSClient';

export interface AdSlot {
  advertiser: string;
  name: string;
  description: string;
  imageUrl: string;
  bidAmount: bigint;
  totalClicks: bigint;
  claimedAmount: bigint;
  finalizedAt: bigint;
  exists: boolean;
  removed: boolean;
}

export interface PoolBalances {
  availablePool: bigint;
  locked: bigint;
  fees: bigint;
}

export interface ClaimableRewards {
  cycles: bigint[];
  slots: bigint[];
  amounts: bigint[];
}

export function useADSContract() {
  const client = useADSClient(); // Use stable client from hook
  const [currentCycle, setCurrentCycle] = useState<bigint | null>(null);
  const [currentAds, setCurrentAds] = useState<AdSlot[]>([]);
  const [poolBalances, setPoolBalances] = useState<PoolBalances | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch current cycle and ads
  const refreshData = async () => {
    setLoading(true);
    try {
      const [cycle, ads, locked, fees] = await Promise.all([
        client.readContract({
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'getCurrentCycle',
        }),
        client.readContract({
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'getCurrentAds',
        }),
        client.readContract({
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'lockedFunds',
        }),
        client.readContract({
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'accumulatedFees',
        }),
      ]);

      setCurrentCycle(cycle as bigint);
      setCurrentAds(ads as AdSlot[]);
      setPoolBalances({
        availablePool: 0n, // Contract doesn't expose this directly
        locked: locked as bigint,
        fees: fees as bigint,
      });
    } catch (error) {
      console.error('Failed to fetch contract data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch data on mount
  useEffect(() => {
    refreshData();
  }, []);

  // Get ads from a specific cycle
  const getAdsForCycle = async (cycle: bigint): Promise<AdSlot[]> => {
    try {
      const slots = [];
      // Fetch all 3 slots for the cycle
      for (let i = 0; i < 3; i++) {
        try {
          const slot = await client.readContract({
            address: CONTRACTS.ADS_DEMO,
            abi: ADS_DEMO_ABI,
            functionName: 'adSlots',
            args: [cycle, BigInt(i)],
          }) as AdSlot;

          // Ensure slot has all required properties with defaults
          slots.push({
            advertiser: slot?.advertiser || '0x0000000000000000000000000000000000000000',
            name: slot?.name || '',
            description: slot?.description || '',
            imageUrl: slot?.imageUrl || '',
            bidAmount: slot?.bidAmount ?? 0n,
            totalClicks: slot?.totalClicks ?? 0n,
            claimedAmount: slot?.claimedAmount ?? 0n,
            finalizedAt: slot?.finalizedAt ?? 0n,
            exists: slot?.exists ?? false,
            removed: slot?.removed ?? false,
          });
        } catch (slotError) {
          console.error(`Failed to fetch slot ${i} for cycle ${cycle}:`, slotError);
          // Push empty slot on error
          slots.push({
            advertiser: '0x0000000000000000000000000000000000000000',
            name: '',
            description: '',
            imageUrl: '',
            bidAmount: 0n,
            totalClicks: 0n,
            claimedAmount: 0n,
            finalizedAt: 0n,
            exists: false,
            removed: false,
          });
        }
      }
      return slots;
    } catch (error) {
      console.error(`Failed to fetch ads for cycle ${cycle}:`, error);
      return [];
    }
  };

  // Check if user has clicked an ad
  const hasUserClicked = async (
    userAddress: string,
    cycle: bigint,
    slotIndex: number
  ): Promise<boolean> => {
    try {
      const result = await client.readContract({
        address: CONTRACTS.ADS_DEMO,
        abi: ADS_DEMO_ABI,
        functionName: 'hasClicked',
        args: [cycle, BigInt(slotIndex), userAddress as Address],
      });
      return result as boolean;
    } catch (error) {
      console.error('Failed to check click status:', error);
      return false;
    }
  };

  // Check if user is registered
  const isUserRegistered = async (userAddress: string): Promise<boolean> => {
    try {
      const result = await client.readContract({
        address: CONTRACTS.ADS_DEMO,
        abi: ADS_DEMO_ABI,
        functionName: 'registered',
        args: [userAddress as Address],
      });
      return result as boolean;
    } catch (error) {
      console.error('Failed to check registration:', error);
      return false;
    }
  };

  // Get user's claimable rewards
  const getUserClaimableRewards = async (userAddress: string): Promise<ClaimableRewards> => {
    try {
      const result = await client.readContract({
        address: CONTRACTS.ADS_DEMO,
        abi: ADS_DEMO_ABI,
        functionName: 'getUserClaimableRewards',
        args: [userAddress as Address],
      });
      const [cycles, slots, amounts] = result as [bigint[], bigint[], bigint[]];
      return { cycles, slots, amounts };
    } catch (error) {
      console.error('Failed to get claimable rewards:', error);
      return { cycles: [], slots: [], amounts: [] };
    }
  };

  // Record a click on an ad using MiniKit
  const recordClick = async (
    cycle: bigint,
    slotIndex: number,
    nonce: number,
    timestamp: number,
    signature: string
  ) => {
    const result = await MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'recordClick',
          args: [cycle, BigInt(slotIndex), BigInt(nonce), BigInt(timestamp), signature as `0x${string}`],
        },
      ],
    });

    if (result.finalPayload.status === 'success') {
      return result.finalPayload;
    } else {
      throw new Error(result.finalPayload.error_code || 'Transaction failed');
    }
  };

  // Claim reward using MiniKit
  const claimReward = async (
    cycle: bigint,
    slotIndex: bigint
  ) => {
    const result = await MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'claimReward',
          args: [cycle, slotIndex],
        },
      ],
    });

    if (result.finalPayload.status === 'success') {
      return result.finalPayload;
    } else {
      throw new Error(result.finalPayload.error_code || 'Transaction failed');
    }
  };

  // Place ad bid using Permit2 and MiniKit
  const placeAdBid = async (
    cycle: bigint,
    slotIndex: bigint,
    name: string,
    description: string,
    imageUrl: string,
    bidAmount: bigint
  ) => {
    // Create Permit2 permit structure (World Mini Apps format - all strings)
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
    const nonce = Date.now();

    // Use MiniKit's sendTransaction with Permit2 placeholder
    // MiniKit will automatically replace PERMIT2_SIGNATURE_PLACEHOLDER_0 with the actual signature
    const result = await MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'placeAdBid',
          args: [
            cycle,
            slotIndex,
            name,
            description,
            imageUrl,
            bidAmount,
            {
              permitted: {
                token: CONTRACTS.WLD_TOKEN,
                amount: bidAmount,
              },
              nonce: BigInt(nonce),
              deadline: BigInt(deadline),
            },
            'PERMIT2_SIGNATURE_PLACEHOLDER_0', // MiniKit replaces this
          ],
        },
      ],
      permit2: [
        {
          permitted: {
            token: CONTRACTS.WLD_TOKEN,
            amount: bidAmount.toString(),
          },
          spender: CONTRACTS.ADS_DEMO,
          nonce: nonce.toString(),
          deadline: deadline.toString(),
        },
      ],
    });

    if (result.finalPayload.status === 'success') {
      return result.finalPayload;
    } else {
      throw new Error(result.finalPayload.error_code || 'Transaction failed');
    }
  };

  // Progress to next cycle (anyone can call)
  const progressCycle = async () => {
    const result = await MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'progressCycle',
          args: [],
        },
      ],
    });

    if (result.finalPayload.status === 'success') {
      await refreshData(); // Refresh data after cycle progression
      return result.finalPayload;
    } else {
      throw new Error(result.finalPayload.error_code || 'Transaction failed');
    }
  };

  return {
    client,
    currentCycle,
    currentAds,
    poolBalances,
    loading,
    refreshData,
    getAdsForCycle,
    hasUserClicked,
    isUserRegistered,
    getUserClaimableRewards,
    recordClick,
    claimReward,
    placeAdBid,
    progressCycle,
  };
}
