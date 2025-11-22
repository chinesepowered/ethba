import { useMemo } from 'react';
import { createPublicClient, http } from 'viem';
import { worldchain } from 'viem/chains';

/**
 * Custom hook to create a stable viem client for ADS Platform contract interactions
 *
 * Benefits:
 * - Prevents client recreation on every render
 * - Provides stable reference for useEffect dependencies
 * - Memoizes expensive client setup
 * - Easy to mock in tests
 */
export function useADSClient() {
  return useMemo(() => createPublicClient({
    chain: worldchain,
    transport: http('https://worldchain-mainnet.g.alchemy.com/public'),
  }), []);
}
