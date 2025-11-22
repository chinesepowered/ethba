import ADS_ABI_JSON from './ads-abi.json';

export const ADS_ABI = ADS_ABI_JSON as const;

export const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

// Export for backwards compat
export const ADS_DEMO_ABI = ADS_ABI;
