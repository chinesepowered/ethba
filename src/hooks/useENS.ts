import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

/**
 * Cross-Chain Name Resolution with Arbitrum One
 *
 * Demonstrates cross-chain trust by resolving names from Arbitrum
 * while the main app runs on World Chain. This shows how identity
 * and reputation from other chains can carry over.
 *
 * Per ENS best practices:
 * 1. Perform reverse lookup (address -> name)
 * 2. Verify with forward lookup (name -> address)
 * 3. Only display if addresses match (prevents spoofing)
 *
 * Uses Arbitrum One for name resolution
 * World ID provides sybil resistance, Arbitrum names provide identity
 */
export function useENS(address: string | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !ethers.isAddress(address)) {
      setEnsName(null);
      return;
    }

    let cancelled = false;

    async function lookupAndVerify() {
      setLoading(true);
      try {
        // Use Arbitrum One for cross-chain name resolution
        // Arbitrum One RPC (public endpoint)
        const provider = new ethers.JsonRpcProvider(
          'https://arb1.arbitrum.io/rpc'
        );

        // Step 1: Reverse lookup (address -> name)
        // This checks if the address has set a reverse record on Arbitrum
        const reverseName = await provider.lookupAddress(address!);

        if (!reverseName || cancelled) {
          setEnsName(null);
          setLoading(false);
          return;
        }

        // Step 2: Forward lookup verification (name -> address)
        // CRITICAL: Prevents spoofing attacks
        // Verify the name actually resolves back to this address
        const resolvedAddress = await provider.resolveName(reverseName);

        if (!cancelled) {
          // Step 3: Verify addresses match (case-insensitive)
          if (
            resolvedAddress &&
            resolvedAddress.toLowerCase() === address!.toLowerCase()
          ) {
            setEnsName(reverseName);
          } else {
            // Verification failed - don't display name
            console.warn(
              `Arbitrum name verification failed for ${address}: reverse=${reverseName}, forward=${resolvedAddress}`
            );
            setEnsName(null);
          }
        }
      } catch (error) {
        console.error('Arbitrum name lookup failed:', error);
        if (!cancelled) {
          setEnsName(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    lookupAndVerify();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { ensName, loading };
}
