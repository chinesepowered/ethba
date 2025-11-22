export const ADS_DEMO_ABI = [
  // View Functions
  'function getCurrentCycle() external view returns (uint256)',
  'function getCurrentAds() external view returns (tuple(address advertiser, string name, string description, string actionUrl, uint256 bidAmount, bool exists, bool removed)[])',
  'function getAdSlot(uint256 cycle, uint256 slotIndex) external view returns (address advertiser, string name, string description, string actionUrl, uint256 bidAmount, bool exists, bool removed)',
  'function getClaimableAds(address user) external view returns (bool[])',
  'function hasUserClaimed(address user, uint256 cycle, uint256 slotIndex) external view returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function getPoolBalances() external view returns (uint256 availablePool, uint256 locked, uint256 fees)',
  'function getUserSwapInfo(address user) external view returns (uint256 adsBalance, uint256 wldValue)',
  'function calculateSwapOutput(uint256 adsAmount) external view returns (uint256)',
  'function isRegistered(address user) external view returns (bool)',
  'function getHighestBid(uint256 cycle, uint256 slotIndex) external view returns (address advertiser, uint256 amount, uint256 timestamp, string name, string description, string actionUrl)',

  // State-changing Functions
  'function register(address signal, uint256 root, uint256 nullifierHash, uint256[8] calldata proof) external',
  'function claimReward(uint256 cycle, uint256 slotIndex, uint256 rewardAmount, uint256 nonce, uint256 timestamp, bytes calldata signature) external',
  'function swapADSForWLD(uint256 adsAmount) external',
  'function placeBid(uint256 cycle, uint256 slotIndex, uint256 amount, string calldata name, string calldata description, string calldata actionUrl) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',

  // Events
  'event AdClicked(address indexed user, uint256 indexed cycle, uint256 indexed slotIndex, uint256 reward)',
  'event TokensSwapped(address indexed user, uint256 adsAmount, uint256 wldAmount)',
  'event BidPlaced(address indexed advertiser, uint256 indexed cycle, uint256 indexed slotIndex, uint256 amount)',
  'event UserRegistered(address indexed user, uint256 nullifierHash)',
] as const;

export const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;
