import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { ENS_CONFIG } from '@/config/contracts';

export function useENS(address: string | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !ethers.isAddress(address)) {
      setEnsName(null);
      return;
    }

    let cancelled = false;

    async function lookup() {
      setLoading(true);
      try {
        // Use Sepolia testnet for ENS lookups
        const provider = new ethers.JsonRpcProvider(ENS_CONFIG.rpcUrl);
        const name = await provider.lookupAddress(address);

        if (!cancelled) {
          setEnsName(name);
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

    lookup();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { ensName, loading };
}
