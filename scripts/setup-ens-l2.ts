/**
 * Setup ENS L2 Primary Name on Base Sepolia
 * 
 * This script helps you set up your ENS name to work on Base Sepolia testnet.
 * 
 * Prerequisites:
 * 1. You own an ENS name on Sepolia testnet (register at sepolia.app.ens.domains)
 * 2. You have ETH on Ethereum Sepolia (for L1 transaction)
 * 3. You have ETH on Base Sepolia (for L2 transaction)
 * 
 * Usage:
 * 1. Set PRIVATE_KEY in .env.local
 * 2. Run: npx tsx scripts/setup-ens-l2.ts yourname.eth
 */

import { createWalletClient, createPublicClient, http, namehash, normalize } from 'viem';
import { sepolia, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Contract addresses
const SEPOLIA_PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
const BASE_SEPOLIA_REVERSE_REGISTRAR = '0x00000BeEF055f7934784D6d81b6BC86665630dbA';

// Base Sepolia coin type (ENSIP-11)
const BASE_SEPOLIA_COIN_TYPE = (0x80000000 | 84532) >>> 0;

async function setupENSL2(ensName: string) {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('Please set DEPLOYER_PRIVATE_KEY or SIGNER_PRIVATE_KEY in .env.local');
  }

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);
  console.log(`\n📍 Setting up ENS name: ${ensName}`);
  console.log(`📍 For wallet: ${account.address}\n`);

  // Step 1: Set Base Sepolia address on L1 resolver
  console.log('Step 1/2: Setting Base Sepolia address on Ethereum Sepolia resolver...');
  
  const sepoliaClient = createWalletClient({
    chain: sepolia,
    transport: http(),
    account,
  });

  const sepoliaPublicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  try {
    const normalizedName = normalize(ensName);
    const node = namehash(normalizedName);

    const hash = await sepoliaClient.writeContract({
      address: SEPOLIA_PUBLIC_RESOLVER,
      abi: [{
        name: 'setAddr',
        type: 'function',
        inputs: [
          { name: 'node', type: 'bytes32' },
          { name: 'coinType', type: 'uint256' },
          { name: 'a', type: 'bytes' }
        ],
      }],
      functionName: 'setAddr',
      args: [
        node,
        BigInt(BASE_SEPOLIA_COIN_TYPE),
        account.address,
      ],
    });

    console.log(`✅ Transaction sent: ${hash}`);
    console.log(`   Waiting for confirmation...`);
    
    await sepoliaPublicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed! ${ensName} now resolves to ${account.address} on Base Sepolia\n`);
  } catch (error: any) {
    console.error(`❌ Failed to set address on L1:`, error.message);
    throw error;
  }

  // Step 2: Set reverse record on Base Sepolia
  console.log('Step 2/2: Setting reverse record on Base Sepolia...');
  
  const baseSepoliaClient = createWalletClient({
    chain: baseSepolia,
    transport: http(),
    account,
  });

  const baseSepoliaPublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  try {
    const hash = await baseSepoliaClient.writeContract({
      address: BASE_SEPOLIA_REVERSE_REGISTRAR,
      abi: [{
        name: 'setName',
        type: 'function',
        inputs: [{ name: 'name', type: 'string' }],
        outputs: [{ name: '', type: 'bytes32' }],
      }],
      functionName: 'setName',
      args: [ensName],
    });

    console.log(`✅ Transaction sent: ${hash}`);
    console.log(`   Waiting for confirmation...`);
    
    await baseSepoliaPublicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed! ${account.address} now shows as ${ensName} on Base Sepolia\n`);
  } catch (error: any) {
    console.error(`❌ Failed to set reverse record on L2:`, error.message);
    throw error;
  }

  console.log('🎉 Success! Your ENS L2 primary name is now set up!');
  console.log(`\n⏰ Note: There may be a propagation delay of up to 6 hours for the official implementation.`);
  console.log(`   Your app should now resolve ${account.address} → ${ensName}\n`);
}

// Run the script
const ensName = process.argv[2];

if (!ensName) {
  console.error('Usage: npx tsx scripts/setup-ens-l2.ts yourname.eth');
  process.exit(1);
}

setupENSL2(ensName).catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
