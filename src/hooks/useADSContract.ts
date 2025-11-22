import { useEffect, useState } from 'react';
import { Contract, BrowserProvider } from 'ethers';
import { CONTRACTS } from '@/config/contracts';
import { ADS_DEMO_ABI } from '@/config/abi';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export interface AdSlot {
  advertiser: string;
  name: string;
  description: string;
  imageUrl: string;
  bidAmount: bigint;
  slotType: number;
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
  const [contract, setContract] = useState<Contract | null>(null);
  const [currentCycle, setCurrentCycle] = useState<bigint | null>(null);
  const [currentAds, setCurrentAds] = useState<AdSlot[]>([]);
  const [poolBalances, setPoolBalances] = useState<PoolBalances | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize contract
  useEffect(() => {
    async function init() {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const adsContract = new Contract(CONTRACTS.ADS_DEMO, ADS_DEMO_ABI, signer);
          setContract(adsContract);
        } catch (error) {
          console.error('Failed to initialize contract:', error);
        }
      }
    }

    init();
  }, []);

  // Fetch current cycle and ads
  const refreshData = async (userAddress?: string) => {
    if (!contract) return;

    setLoading(true);
    try {
      const [cycle, ads, balances] = await Promise.all([
        contract.getCurrentCycle(),
        contract.getCurrentAds(),
        contract.getPoolBalances(),
      ]);

      setCurrentCycle(cycle);
      setCurrentAds(ads);
      setPoolBalances(balances);
    } catch (error) {
      console.error('Failed to fetch contract data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has clicked an ad
  const hasUserClicked = async (
    userAddress: string,
    cycle: bigint,
    slotIndex: number
  ): Promise<boolean> => {
    if (!contract) return false;
    try {
      return await contract.hasUserClicked(userAddress, cycle, slotIndex);
    } catch (error) {
      console.error('Failed to check click status:', error);
      return false;
    }
  };

  // Check if user is registered
  const isUserRegistered = async (userAddress: string): Promise<boolean> => {
    if (!contract) return false;
    try {
      return await contract.isRegistered(userAddress);
    } catch (error) {
      console.error('Failed to check registration:', error);
      return false;
    }
  };

  // Get user's claimable rewards
  const getUserClaimableRewards = async (userAddress: string): Promise<ClaimableRewards> => {
    if (!contract) return { cycles: [], slots: [], amounts: [] };
    try {
      const result = await contract.getUserClaimableRewards(userAddress);
      return {
        cycles: result[0],
        slots: result[1],
        amounts: result[2],
      };
    } catch (error) {
      console.error('Failed to get claimable rewards:', error);
      return { cycles: [], slots: [], amounts: [] };
    }
  };

  // Record a click on an ad
  const recordClick = async (
    cycle: bigint,
    slotIndex: number,
    nonce: number,
    timestamp: number,
    signature: string
  ) => {
    if (!contract) throw new Error('Contract not initialized');

    const tx = await contract.recordClick(
      cycle,
      slotIndex,
      nonce,
      timestamp,
      signature
    );

    return await tx.wait();
  };

  // Claim reward (proportional share calculated by contract)
  const claimReward = async (
    cycle: bigint,
    slotIndex: bigint
  ) => {
    if (!contract) throw new Error('Contract not initialized');

    const tx = await contract.claimReward(cycle, slotIndex);

    return await tx.wait();
  };

  // Place ad bid using Permit2
  const placeAdBid = async (
    cycle: bigint,
    slotIndex: bigint,
    name: string,
    description: string,
    imageUrl: string,
    bidAmount: bigint,
    slotType: number
  ) => {
    if (!contract) throw new Error('Contract not initialized');

    // In World Mini Apps, we'll use MiniKit's sendTransaction command
    // For now, this is a placeholder that will be replaced with MiniKit integration
    // The frontend will need to:
    // 1. Create Permit2 permit object
    // 2. Get user signature via MiniKit
    // 3. Call contract.placeAdBid with permit and signature

    // Placeholder signature construction
    const permit = {
      permitted: {
        token: CONTRACTS.WLD_TOKEN,
        amount: bidAmount.toString(),
      },
      nonce: Date.now(),
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    // This will be replaced with actual MiniKit signature in production
    const signature = '0x' + '00'.repeat(65); // Placeholder

    const tx = await contract.placeAdBid(
      cycle,
      slotIndex,
      name,
      description,
      imageUrl,
      bidAmount,
      slotType,
      permit,
      signature
    );

    return await tx.wait();
  };

  return {
    contract,
    currentCycle,
    currentAds,
    poolBalances,
    loading,
    refreshData,
    hasUserClicked,
    isUserRegistered,
    getUserClaimableRewards,
    recordClick,
    claimReward,
    placeAdBid,
  };
}
