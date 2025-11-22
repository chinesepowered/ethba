import { useEffect, useState } from 'react';
import { createPublicClient, http, isAddress } from 'viem';
import { mainnet, baseSepolia } from 'viem/chains';

/**
 * L2 Primary Name Resolution with Base Sepolia
 *
 * Implements ENS L2 Primary Names on Base Sepolia testnet.
 * Per ENS L2 Primary Names specification (Aug 2025+):
 * - Resolution ALWAYS starts from Ethereum Mainnet (L1)
 * - Uses coinType parameter to specify L2 chain for reverse records
 * - Supports bi-directional verification (reverse + forward)
 *
 * Per ENS best practices:
 * 1. Perform reverse lookup (address -> name) on L1 with L2 coinType
 * 2. Verify with forward lookup (name -> address) on L1 with L2 coinType
 * 3. Only display if addresses match (prevents spoofing)
 *
 * Base Sepolia testnet chain ID: 84532
 * World ID provides sybil resistance, ENS names provide identity
 */
export function useENS(address: string | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setEnsName(null);
      return;
    }

    let cancelled = false;

    async function lookupAndVerify() {
      setLoading(true);
      try {
        // CRITICAL: ENS resolution ALWAYS starts from L1 mainnet
        const client = createPublicClient({
          chain: mainnet,
          transport: http(),
        });

        // Convert Base Sepolia chain ID to coinType for ENSIP-11
        // Formula: coinType = 0x80000000 | chainId
        // Base Sepolia chain ID: 84532
        const baseSepoliaCoinType = BigInt((0x80000000 | baseSepolia.id) >>> 0);

        // Step 1: Reverse lookup (address -> name)
        // Gets the primary name set on Base Sepolia reverse registrar
        const reverseName = await client.getEnsName({
          address: address as `0x${string}`,
          coinType: baseSepoliaCoinType, // CRITICAL: Specify Base Sepolia for L2 primary name
          universalResolverAddress: '0xc0497E381f536Be9ce14B0dD3817cBcAe57d2F62',
        });

        if (!reverseName || cancelled) {
          setEnsName(null);
          setLoading(false);
          return;
        }

        // Step 2: Forward lookup verification (name -> address)
        // CRITICAL: Prevents spoofing attacks
        // Verify the name resolves back to this address on Base Sepolia
        const resolvedAddress = await client.getEnsAddress({
          name: reverseName,
          coinType: baseSepoliaCoinType,
          universalResolverAddress: '0xc0497E381f536Be9ce14B0dD3817cBcAe57d2F62',
        });

        if (!cancelled) {
          // Step 3: Verify addresses match (case-insensitive)
          if (
            resolvedAddress &&
            resolvedAddress.toLowerCase() === address.toLowerCase()
          ) {
            setEnsName(reverseName);
          } else {
            // Verification failed - don't display name
            console.warn(
              `Base Sepolia name verification failed for ${address}: reverse=${reverseName}, forward=${resolvedAddress}`
            );
            setEnsName(null);
          }
        }
      } catch (error) {
        console.error('Base Sepolia ENS lookup failed:', error);
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
