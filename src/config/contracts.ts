export const CONTRACTS = {
  ADS_DEMO: process.env.NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS as `0x${string}`,
  WLD_TOKEN: '0x2cFc85d8E48F8EAB294be644d9E25C3030863003' as `0x${string}`, // WLD on World Chain
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`, // Universal Permit2
} as const;

export const CHAIN_CONFIG = {
  id: 480, // World Chain
  name: 'World Chain',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://worldchain-mainnet.g.alchemy.com/public',
} as const;
