export const CONTRACTS = {
  ADS_DEMO: process.env.NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS as `0x${string}`,
  WLD_TOKEN: process.env.NEXT_PUBLIC_WLD_TOKEN_ADDRESS as `0x${string}`,
} as const;

export const CHAIN_CONFIG = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 480),
  name: 'World Chain',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://worldchain-mainnet.g.alchemy.com/public',
} as const;

// ENS resolution uses Ethereum Mainnet (handled in useENS hook)
// Supports primary names on all L2s including World Chain

export const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3001';
