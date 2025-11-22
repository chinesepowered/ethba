import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

/**
 * ENS Reverse Resolution with Verification
 *
 * Per ENS best practices:
 * 1. Perform reverse lookup (address -> name)
 * 2. Verify with forward lookup (name -> address)
 * 3. Only display if addresses match (prevents spoofing)
 *
 * Uses Ethereum Mainnet (ENS primary network)
 * Supports L2 primary names via mainnet resolution
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
        // Use Ethereum Mainnet for ENS (supports all L2 lookups)
        const provider = new ethers.JsonRpcProvider(
          'https://eth.llamarpc.com' // Free public mainnet RPC
        );

        // Step 1: Reverse lookup (address -> name)
        const reverseName = await provider.lookupAddress(address);

        if (!reverseName || cancelled) {
          setEnsName(null);
          setLoading(false);
          return;
        }

        // Step 2: Forward lookup verification (name -> address)
        // CRITICAL: Prevents spoofing attacks
        const resolvedAddress = await provider.resolveName(reverseName);

        if (!cancelled) {
          // Step 3: Verify addresses match (case-insensitive)
          if (
            resolvedAddress &&
            resolvedAddress.toLowerCase() === address.toLowerCase()
          ) {
            setEnsName(reverseName);
          } else {
            // Verification failed - don't display ENS name
            console.warn(
              `ENS verification failed for ${address}: reverse=${reverseName}, forward=${resolvedAddress}`
            );
            setEnsName(null);
          }
        }
      } catch (error) {
        console.error('ENS lookup failed:', error);
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
