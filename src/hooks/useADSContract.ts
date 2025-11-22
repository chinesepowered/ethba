import { useEffect, useState } from 'react';
import { Contract, BrowserProvider, formatUnits, parseUnits } from 'ethers';
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
  actionUrl: string;
  bidAmount: bigint;
  exists: boolean;
  removed: boolean;
}

export interface PoolBalances {
  availablePool: bigint;
  locked: bigint;
  fees: bigint;
}

export function useADSContract() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [currentCycle, setCurrentCycle] = useState<bigint | null>(null);
  const [currentAds, setCurrentAds] = useState<AdSlot[]>([]);
  const [poolBalances, setPoolBalances] = useState<PoolBalances | null>(null);
  const [userBalance, setUserBalance] = useState<bigint>(0n);
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

      if (userAddress) {
        const balance = await contract.balanceOf(userAddress);
        setUserBalance(balance);
      }
    } catch (error) {
      console.error('Failed to fetch contract data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has claimed an ad
  const hasUserClaimed = async (
    userAddress: string,
    cycle: bigint,
    slotIndex: number
  ): Promise<boolean> => {
    if (!contract) return false;
    try {
      return await contract.hasUserClaimed(userAddress, cycle, slotIndex);
    } catch (error) {
      console.error('Failed to check claim status:', error);
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

  // Get swap output estimate
  const getSwapEstimate = async (adsAmount: string): Promise<string> => {
    if (!contract) return '0';
    try {
      const amount = parseUnits(adsAmount, 18);
      const wldAmount = await contract.calculateSwapOutput(amount);
      return formatUnits(wldAmount, 18);
    } catch (error) {
      console.error('Failed to calculate swap:', error);
      return '0';
    }
  };

  // Claim reward
  const claimReward = async (
    cycle: bigint,
    slotIndex: number,
    rewardAmount: bigint,
    nonce: number,
    timestamp: number,
    signature: string
  ) => {
    if (!contract) throw new Error('Contract not initialized');

    const tx = await contract.claimReward(
      cycle,
      slotIndex,
      rewardAmount,
      nonce,
      timestamp,
      signature
    );

    return await tx.wait();
  };

  // Swap ADS for WLD
  const swapADSForWLD = async (adsAmount: string) => {
    if (!contract) throw new Error('Contract not initialized');

    const amount = parseUnits(adsAmount, 18);
    const tx = await contract.swapADSForWLD(amount);

    return await tx.wait();
  };

  return {
    contract,
    currentCycle,
    currentAds,
    poolBalances,
    userBalance,
    loading,
    refreshData,
    hasUserClaimed,
    isUserRegistered,
    getSwapEstimate,
    claimReward,
    swapADSForWLD,
  };
}
