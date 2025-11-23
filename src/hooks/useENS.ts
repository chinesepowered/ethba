import { useQuery } from '@tanstack/react-query';
import { type Address, type Hex, createPublicClient, http, isAddress, parseAbi, toCoinType } from 'viem';
import { mainnet, baseSepolia } from 'viem/chains';

/**
 * Optimistic L2 Primary Name Resolution with Base Sepolia
 *
 * Based on ENS official frontend template for instant L2 name resolution.
 * Per ENS L2 Primary Names specification:
 * - Queries L2 reverse registrar DIRECTLY on Base Sepolia for instant results
 * - No propagation delay (standard L1 queries have ~few hour delay)
 * - Uses L1 for forward verification only
 * - Supports bi-directional verification (reverse + forward)
 *
 * Resolution flow:
 * 1. Get L2 reverse registrar address from L1 namespace resolver
 * 2. Query reverse name directly from Base Sepolia L2 registrar
 * 3. Verify forward resolution on L1 with L2 coinType
 * 4. Only display if addresses match (prevents spoofing)
 *
 * Base Sepolia testnet chain ID: 84532
 * World ID provides sybil resistance, ENS names provide identity
 */
export function useENS(address: string | undefined) {
  const query = useQuery({
    queryKey: ['ens-name', baseSepolia.id, address],
    queryFn: async () => {
      if (!address || !isAddress(address)) {
        return null;
      }

      // Create L1 client for resolver lookups and forward verification
      const l1Client = createPublicClient({
        chain: mainnet,
        transport: http(),
      });

      // Create L2 client for direct reverse registrar queries
      const l2Client = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      try {
        // Step 1: Get the reverse namespace resolver for Base Sepolia on L1
        // Format: "14a34.reverse" (Base Sepolia coinType in hex)
        const coinType = toCoinType(baseSepolia.id);
        const reverseNamespace = `${coinType.toString(16)}.reverse`;

        const chainReverseResolver = await l1Client.getEnsResolver({
          name: reverseNamespace,
        });

        if (!chainReverseResolver) {
          console.warn(`No reverse resolver found for ${reverseNamespace}`);
          return null;
        }

        // Step 2: Get the L2 reverse registrar address from the resolver
        const l2ReverseRegistrar = await l1Client.readContract({
          address: chainReverseResolver,
          abi: parseAbi(['function l2Registrar() view returns (address)']),
          functionName: 'l2Registrar',
        }) as Address;

        // Step 3: Query reverse name DIRECTLY from L2 reverse registrar
        // This is the key optimization - no waiting for L1 propagation!
        const reverseName = await l2Client.readContract({
          address: l2ReverseRegistrar,
          abi: parseAbi(['function nameForAddr(address) view returns (string)']),
          functionName: 'nameForAddr',
          args: [address as Hex],
        });

        if (!reverseName) {
          return null;
        }

        // Step 4: Forward lookup verification on L1 (prevents spoofing)
        const forwardAddr = await l1Client.getEnsAddress({
          name: reverseName,
          coinType,
        });

        // Step 5: Verify addresses match (case-insensitive)
        if (forwardAddr?.toLowerCase() === address.toLowerCase()) {
          return reverseName;
        }

        console.warn(
          `Base Sepolia name verification failed for ${address}: reverse=${reverseName}, forward=${forwardAddr}`
        );
        return null;
      } catch (error) {
        console.error('Base Sepolia ENS lookup failed:', error);
        return null;
      }
    },
    enabled: !!address && isAddress(address),
  });

  return {
    ensName: query.data ?? null,
    loading: query.isLoading,
  };
}
