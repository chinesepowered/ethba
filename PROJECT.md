# ADS Platform - Technical Documentation

**AI Reference Document**: Complete technical architecture and implementation details for the ADS (Advertising Distribution System) platform.

## System Overview

A decentralized advertising platform built on World Chain that enables users to earn tokens by viewing ads while providing advertisers with sybil-resistant, verified audiences through World ID integration.

### Core Components

1. **Smart Contracts** (Solidity)
   - `ADS.sol` - Production contract with daily cycles and orb verification
   - `ADSDemo.sol` - Testing contract with 1-minute cycles and device verification

2. **Frontend** (Next.js 15 + React 19 + TypeScript)
   - World Mini App running inside World App
   - Mobile-first responsive design
   - Real-time contract interaction via ethers.js

3. **Backend** (Node.js + Express)
   - Dynamic reward calculation based on geo-IP and device
   - Cryptographic signature generation
   - Optional TEE deployment on Oasis ROFL

## Smart Contract Architecture

### Contract Variants

#### Production Contract: `contracts/ADS.sol`
```solidity
contract ADS is ERC20, Ownable, ReentrancyGuard, IWorldID {
    uint256 internal immutable groupId = 1; // Orb verification
    uint256 public constant CYCLE_DURATION = 1 days;
    uint256 public constant AD_SLOTS_PER_CYCLE = 5;
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%
}
```

**Key Characteristics:**
- Daily cycles (24 hours)
- Requires orb-level World ID verification
- Production-ready for real deployment
- No seeding functions

#### Demo Contract: `contracts/ADSDemo.sol`
```solidity
contract ADSDemo is ERC20, Ownable, ReentrancyGuard, IWorldID {
    uint256 internal immutable groupId = 0; // Device verification
    uint256 public constant CYCLE_DURATION = 1 minutes;

    constructor(...) {
        // ... initialization
        _mint(msg.sender, 5 * 10**18); // Seed deployer with 5 ADS
    }

    // Demo-only seeding functions
    function seedRegistration(address user) external onlyOwner
    function seedAdSlot(uint256 cycle, uint256 slotIndex, ...) external onlyOwner
    function seedADSBalance(address user, uint256 amount) external onlyOwner
    function seedRewardPool(uint256 amount) external onlyOwner
    function forceAdvanceCycle() external onlyOwner
}
```

**Key Characteristics:**
- 1-minute cycles for rapid testing
- Device-level World ID verification
- Deployer pre-seeded with 5 ADS tokens
- Seeding functions for instant ecosystem setup

### Contract State Variables

```solidity
// Token contracts
IERC20 public immutable WLD;  // World Token for bidding
// ADS token is inherited from ERC20

// Cycle management
uint256 public lastFinalizedCycle;
mapping(uint256 => mapping(uint256 => AdSlot)) public adSlots;

// User tracking
mapping(address => bool) public registered;
mapping(address => mapping(uint256 => mapping(uint256 => bool))) public hasClaimed;
mapping(address => bool) public bannedAdvertisers;

// Signature verification
mapping(address => bool) public authorizedSigners;
mapping(bytes32 => bool) public usedSignatures;

// Financial pools
uint256 public rewardPool;      // Available WLD for swaps
uint256 public lockedFunds;     // WLD locked in current cycle
uint256 public accumulatedFees; // Platform fees (pull payment)
```

### Core Data Structures

```solidity
struct AdSlot {
    address advertiser;
    string name;
    string description;
    string imageUrl;
    uint256 bidAmount;      // WLD paid for this slot
    bool finalized;
    bool removed;           // If advertiser removed ad
}
```

### Key Functions

#### User Registration
```solidity
function register(
    address signal,
    uint256 root,
    uint256 nullifierHash,
    uint256[8] calldata proof
) external nonReentrant {
    if (registered[msg.sender]) revert AlreadyRegistered();

    worldId.verifyProof(
        root,
        groupId,
        abi.encodePacked(signal).hashToField(),
        nullifierHash,
        abi.encodePacked(address(this)).hashToField(),
        proof
    );

    registered[msg.sender] = true;
    emit UserRegistered(msg.sender);
}
```

#### Advertiser Bidding
```solidity
function placeAdBid(
    uint256 cycle,
    uint256 slotIndex,
    string calldata name,
    string calldata description,
    string calldata imageUrl,
    uint256 bidAmount
) external nonReentrant {
    if (bannedAdvertisers[msg.sender]) revert AdvertiserIsBanned();
    if (cycle != _getCurrentCycle()) revert InvalidCycle();

    AdSlot storage slot = adSlots[cycle][slotIndex];

    // Refund previous bidder if outbid
    if (slot.advertiser != address(0)) {
        bool refundSuccess = WLD.transfer(slot.advertiser, slot.bidAmount);
        if (!refundSuccess) revert TransferFailed();
    }

    // Accept new bid
    bool success = WLD.transferFrom(msg.sender, address(this), bidAmount);
    if (!success) revert TransferFailed();

    slot.advertiser = msg.sender;
    slot.name = name;
    slot.description = description;
    slot.imageUrl = imageUrl;
    slot.bidAmount = bidAmount;

    emit AdBidPlaced(msg.sender, cycle, slotIndex, bidAmount);
}
```

#### Dynamic Reward Claims (Critical Feature)
```solidity
function claimReward(
    uint256 cycle,
    uint256 slotIndex,
    uint256 rewardAmount,  // ← Backend-controlled
    uint256 nonce,
    uint256 timestamp,
    bytes calldata signature
) external nonReentrant {
    if (!registered[msg.sender]) revert NotRegistered();
    if (cycle >= _getCurrentCycle()) revert InvalidCycle();
    if (hasClaimed[msg.sender][cycle][slotIndex]) revert AlreadyClaimed();

    AdSlot storage slot = adSlots[cycle][slotIndex];
    if (!slot.finalized) revert NotFinalized();
    if (slot.removed) revert AdWasRemoved();

    // Verify backend signature (prevents amount manipulation)
    bytes32 messageHash = keccak256(abi.encodePacked(
        msg.sender,
        cycle,
        slotIndex,
        rewardAmount,  // Locked in signature
        nonce,
        timestamp
    ));

    bytes32 ethSignedHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        messageHash
    ));

    if (usedSignatures[ethSignedHash]) revert SignatureAlreadyUsed();

    address signer = ecrecover(ethSignedHash, signature);
    if (!authorizedSigners[signer]) revert NotAuthorized();

    usedSignatures[ethSignedHash] = true;
    hasClaimed[msg.sender][cycle][slotIndex] = true;

    // Mint dynamic reward amount
    _mint(msg.sender, rewardAmount);

    emit RewardClaimed(msg.sender, cycle, slotIndex, rewardAmount);
}
```

**Security Model:**
- User cannot modify `rewardAmount` without breaking signature
- Backend private key required to forge signatures
- Nonce prevents replay attacks
- Signature hash marked as used prevents reuse

#### Token Swapping (Proportional)
```solidity
function swapADSForWLD(uint256 adsAmount) external nonReentrant {
    if (adsAmount == 0) revert InvalidAmount();
    if (balanceOf(msg.sender) < adsAmount) revert InsufficientBalance();

    uint256 totalADS = totalSupply();
    if (totalADS == 0) revert InvalidAmount();

    // Proportional swap: (userADS / totalADS) × rewardPool
    uint256 wldAmount = (adsAmount * rewardPool) / totalADS;
    if (wldAmount == 0) revert InsufficientPool();
    if (wldAmount > rewardPool) revert InsufficientPool();

    // Burn ADS, transfer WLD
    _burn(msg.sender, adsAmount);
    rewardPool -= wldAmount;

    bool success = WLD.transfer(msg.sender, wldAmount);
    if (!success) revert TransferFailed();

    emit ADSSwapped(msg.sender, adsAmount, wldAmount);
}
```

#### Cycle Finalization (Automatic)
```solidity
function finalizeCycle(uint256 cycle) external {
    if (cycle >= _getCurrentCycle()) revert InvalidCycle();
    if (cycle != lastFinalizedCycle + 1) revert InvalidCycle();

    for (uint256 i = 0; i < AD_SLOTS_PER_CYCLE; i++) {
        _finalizeAdSlot(cycle, i);
    }

    lastFinalizedCycle = cycle;
    emit CycleFinalized(cycle);
}

function _finalizeAdSlot(uint256 cycle, uint256 slotIndex) internal {
    AdSlot storage slot = adSlots[cycle][slotIndex];

    if (slot.advertiser == address(0)) {
        slot.finalized = true;
        return;
    }

    if (slot.removed) {
        slot.finalized = true;
        return;
    }

    // Calculate fees and move to reward pool
    uint256 bidAmount = slot.bidAmount;
    uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;
    uint256 poolAmount = bidAmount - feeAmount;

    // CRITICAL: Pull payment pattern prevents contract bricking
    accumulatedFees += feeAmount;  // Don't transfer immediately
    rewardPool += poolAmount;
    lockedFunds -= bidAmount;

    slot.finalized = true;
    emit AdSlotFinalized(cycle, slotIndex);
}

function withdrawFees() external onlyOwner nonReentrant {
    uint256 amount = accumulatedFees;
    if (amount == 0) revert("No fees");

    accumulatedFees = 0;

    bool success = WLD.transfer(owner(), amount);
    if (!success) revert TransferFailed();

    emit FeesWithdrawn(owner(), amount);
}
```

**Why Pull Payment?** If fee transfer fails during finalization (e.g., owner is a contract that rejects), the entire cycle transition would revert, bricking the contract. Accumulating fees and withdrawing separately prevents this.

## Frontend Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: React 19 with World ID Mini Apps UI Kit
- **Web3**: Ethers.js 6
- **State**: React hooks (useState, useEffect)
- **Styling**: Tailwind CSS

### Directory Structure

```
src/
├── app/
│   ├── (protected)/
│   │   └── home/
│   │       ├── page.tsx          # Server component (auth check)
│   │       └── HomeContent.tsx   # Client component (contract logic)
│   ├── api/
│   │   ├── sign-claim/
│   │   │   └── route.ts          # Backend signature API
│   │   └── verify-proof/
│   │       └── route.ts          # World ID verification
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AdCard/
│   │   └── index.tsx             # Individual ad display
│   ├── Stats/
│   │   └── index.tsx             # Pool balances & user stats
│   ├── SwapCard/
│   │   └── index.tsx             # Token swap interface
│   ├── Verify/
│   │   └── index.tsx             # World ID registration
│   └── Navigation/
│       └── index.tsx             # Bottom nav
├── hooks/
│   ├── useADSContract.ts         # Contract interaction hook
│   └── useENS.ts                 # ENS reverse resolution
└── config/
    ├── contracts.ts              # Addresses & chain config
    └── abi.ts                    # Contract ABIs
```

### Core Hook: `useADSContract.ts`

```typescript
export function useADSContract() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [currentCycle, setCurrentCycle] = useState<bigint | null>(null);
  const [currentAds, setCurrentAds] = useState<AdSlot[]>([]);
  const [poolBalances, setPoolBalances] = useState<PoolBalances | null>(null);
  const [userBalance, setUserBalance] = useState<bigint>(0n);

  // Initialize contract
  useEffect(() => {
    async function init() {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const adsContract = new ethers.Contract(
        CONTRACTS.ADS_DEMO,
        ADS_DEMO_ABI,
        signer
      );
      setContract(adsContract);
    }
    init();
  }, []);

  // Refresh data from contract
  const refreshData = async (userAddress?: string) => {
    if (!contract) return;

    const [cycle, ads, balances] = await Promise.all([
      contract.getCurrentCycle(),
      contract.getCurrentAds(),
      contract.getPoolBalances(),
    ]);

    setCurrentCycle(cycle);
    setCurrentAds(ads);
    setPoolBalances(balances);

    if (userAddress) {
      const balance = await contract.balanceOf(userAddress);
      setUserBalance(balance);
    }
  };

  // Claim reward with backend signature
  const claimReward = async (
    cycle: bigint,
    slotIndex: number,
    rewardAmount: bigint,
    nonce: number,
    timestamp: number,
    signature: string
  ) => {
    if (!contract) throw new Error('Contract not initialized');

    const tx = await contract.claimReward(
      cycle,
      slotIndex,
      rewardAmount,
      nonce,
      timestamp,
      signature
    );

    return await tx.wait();
  };

  // Swap ADS for WLD
  const swapADSForWLD = async (adsAmount: string) => {
    if (!contract) throw new Error('Contract not initialized');

    const amount = ethers.parseUnits(adsAmount, 18);
    const tx = await contract.swapADSForWLD(amount);

    return await tx.wait();
  };

  // Get swap estimate
  const getSwapEstimate = async (adsAmount: string) => {
    if (!contract) return '0';

    const amount = ethers.parseUnits(adsAmount, 18);
    const estimate = await contract.calculateSwapOutput(amount);

    return ethers.formatUnits(estimate, 18);
  };

  return {
    contract,
    currentCycle,
    currentAds,
    poolBalances,
    userBalance,
    refreshData,
    claimReward,
    swapADSForWLD,
    getSwapEstimate,
  };
}
```

### Cross-Chain Name Resolution: `useENS.ts`

Implements Arbitrum Name Service integration to demonstrate cross-chain trust and identity portability.

**Key Innovation**: While the app runs on World Chain, it resolves names from Arbitrum One. This showcases how:
- Identity from one chain (Arbitrum) carries over to another (World Chain)
- World ID provides sybil resistance, Arbitrum names provide identity
- Cross-chain reputation and trust are interoperable

```typescript
export function useENS(address: string | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !ethers.isAddress(address)) {
      setEnsName(null);
      return;
    }

    async function lookupAndVerify() {
      setLoading(true);

      try {
        // Use Arbitrum One for cross-chain name resolution
        const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');

        // Step 1: Reverse lookup (address → name)
        // Checks if address has set reverse record on Arbitrum
        const reverseName = await provider.lookupAddress(address);

        if (!reverseName) {
          setEnsName(null);
          setLoading(false);
          return;
        }

        // Step 2: Forward verification (name → address)
        // CRITICAL: Prevents spoofing attacks
        const resolvedAddress = await provider.resolveName(reverseName);

        // Step 3: Verify addresses match
        if (resolvedAddress?.toLowerCase() === address.toLowerCase()) {
          setEnsName(reverseName);  // Safe to display
        } else {
          setEnsName(null);  // Verification failed - spoofing attempt
        }
      } catch (error) {
        console.error('Arbitrum name lookup error:', error);
        setEnsName(null);
      } finally {
        setLoading(false);
      }
    }

    lookupAndVerify();
  }, [address]);

  return { ensName, loading };
}
```

**Why Arbitrum Names:**
- Demonstrates cross-chain identity and trust
- World ID prevents sybils, Arbitrum names provide established identity
- Shows interoperability between L2 ecosystems
- Users don't need separate names on every chain

**Why Verification Matters:**
- Without forward verification, malicious actors can set fake reverse records
- Forward verification ensures the name actually resolves back to the address
- Only displays name if both directions match

**Network:**
- Uses Arbitrum One RPC for name resolution
- ENS names on Arbitrum work across all EVM chains
- Same address can have different names on different chains (this uses Arbitrum's)

### Component: `AdCard/index.tsx`

```typescript
interface AdCardProps {
  ad: AdSlot;
  slotIndex: number;
  canClaim: boolean;
  hasClaimed: boolean;
  onClaim: () => Promise<void>;
  claiming: boolean;
}

export function AdCard({ ad, slotIndex, canClaim, hasClaimed, onClaim, claiming }: AdCardProps) {
  const { ensName, loading: ensLoading } = useENS(ad.advertiser);

  const shortAddress = `${ad.advertiser.slice(0, 6)}...${ad.advertiser.slice(-4)}`;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-xl font-bold mb-2">{ad.name}</h3>

      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-gray-500" />
        {ensLoading ? (
          <span className="text-sm text-gray-500">Loading...</span>
        ) : ensName ? (
          <span className="text-sm">
            {ensName} <span className="text-gray-400">({shortAddress})</span>
          </span>
        ) : (
          <span className="text-sm text-gray-500">{shortAddress}</span>
        )}
      </div>

      <p className="text-gray-600 mb-4">{ad.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Bid: {ethers.formatUnits(ad.bidAmount, 18)} WLD
        </span>

        {canClaim && !hasClaimed && (
          <button
            onClick={onClaim}
            disabled={claiming}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {hasClaimed && (
          <span className="text-green-500 text-sm">✓ Claimed</span>
        )}
      </div>
    </div>
  );
}
```

### Main Page: `HomeContent.tsx`

```typescript
export function HomeContent({ userAddress }: { userAddress?: string }) {
  const {
    currentCycle,
    currentAds,
    userBalance,
    poolBalances,
    refreshData,
    claimReward,
    swapADSForWLD,
    getSwapEstimate,
  } = useADSContract();

  const [claiming, setClaiming] = useState<number | null>(null);

  useEffect(() => {
    if (userAddress) {
      refreshData(userAddress);
      const interval = setInterval(() => refreshData(userAddress), 30000);
      return () => clearInterval(interval);
    }
  }, [userAddress]);

  const handleClaim = async (slotIndex: number) => {
    if (!userAddress || !currentCycle) return;

    setClaiming(slotIndex);

    try {
      // Request signature from backend
      const response = await fetch(`${BACKEND_API_URL}/api/sign-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          cycle: currentCycle.toString(),
          slotIndex,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get signature');
      }

      const { rewardAmount, nonce, timestamp, signature } = await response.json();

      // Submit claim to contract
      await claimReward(
        currentCycle,
        slotIndex,
        BigInt(rewardAmount),
        nonce,
        timestamp,
        signature
      );

      // Refresh data
      await refreshData(userAddress);
    } catch (error) {
      console.error('Claim error:', error);
      alert('Failed to claim reward. Please try again.');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <Stats
        userBalance={userBalance}
        poolBalances={poolBalances}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentAds.map((ad, index) => (
          <AdCard
            key={index}
            ad={ad}
            slotIndex={index}
            canClaim={ad.finalized && !ad.removed}
            hasClaimed={false} // TODO: Check from contract
            onClaim={() => handleClaim(index)}
            claiming={claiming === index}
          />
        ))}
      </div>

      <SwapCard
        userBalance={userBalance.toString()}
        onSwap={swapADSForWLD}
        getEstimate={getSwapEstimate}
      />
    </div>
  );
}
```

## Backend API

### Endpoint: `POST /api/sign-claim`

Located: `src/app/api/sign-claim/route.ts`

```typescript
function calculateReward(request: NextRequest): bigint {
  let reward = ethers.parseUnits('1', 18); // Base: 1 ADS

  // Geo-IP detection (Cloudflare or Vercel headers)
  const country = request.headers.get('cf-ipcountry') ||
                  request.headers.get('x-vercel-ip-country') ||
                  'UNKNOWN';

  // Device detection (User-Agent parsing)
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);

  // Non-Argentina: 2 ADS
  if (country !== 'AR') {
    reward = ethers.parseUnits('2', 18);
  }

  // iOS bonus: +1 ADS
  if (isIOS) {
    reward += ethers.parseUnits('1', 18);
  }

  return reward;
}

export async function POST(request: NextRequest) {
  try {
    const { userAddress, cycle, slotIndex } = await request.json();

    // Validate inputs
    if (!userAddress || cycle === undefined || slotIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing parameters' },
        { status: 400 }
      );
    }

    if (!ethers.isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid address' },
        { status: 400 }
      );
    }

    // Calculate reward based on request context
    const rewardAmount = calculateReward(request);

    // Generate nonce and timestamp
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Create message hash (must match contract)
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, rewardAmount.toString(), nonce, timestamp]
    );

    // Sign message
    const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY!;
    const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Return signed claim
    return NextResponse.json({
      rewardAmount: rewardAmount.toString(),
      nonce,
      timestamp,
      signature,
    });
  } catch (error) {
    console.error('Sign claim error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Reward Examples:**
- 🇦🇷 Argentina + Android = **1 ADS**
- 🇺🇸 USA + Android = **2 ADS**
- 🇦🇷 Argentina + iOS = **2 ADS** (1 base + 1 iOS bonus)
- 🇺🇸 USA + iOS = **3 ADS** (2 base + 1 iOS bonus)

## Security Architecture

### 1. Signature-Based Reward Authorization

**Problem:** Users could claim arbitrary reward amounts without backend approval.

**Solution:** Backend signs a message hash that includes the reward amount. Users cannot modify the amount without invalidating the signature.

```solidity
// Contract verifies backend signature
bytes32 messageHash = keccak256(abi.encodePacked(
    msg.sender,        // User cannot impersonate
    cycle,             // Cycle context
    slotIndex,         // Ad slot
    rewardAmount,      // ← LOCKED in signature
    nonce,             // Prevents replay
    timestamp          // Time validity
));

bytes32 ethSignedHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",
    messageHash
));

address signer = ecrecover(ethSignedHash, signature);
require(authorizedSigners[signer], "Not authorized");
```

**Attack Prevention:**
- ❌ **Forge signature**: Requires backend's private key
- ❌ **Modify reward amount**: Breaks signature verification
- ❌ **Replay signature**: Marked as used via `usedSignatures` mapping
- ❌ **Claim without clicking**: Backend controls who gets signatures

### 2. ENS Spoofing Prevention

**Problem:** Malicious actors can set fake reverse records.

**Solution:** 3-step verification process:
1. Reverse lookup: `address` → `name.eth`
2. Forward verification: `name.eth` → `address`
3. Match check: Only display if addresses match

```typescript
// Step 1: Reverse lookup
const reverseName = await provider.lookupAddress(address);

// Step 2: Forward verification (CRITICAL)
const resolvedAddress = await provider.resolveName(reverseName);

// Step 3: Verify match
if (resolvedAddress?.toLowerCase() === address.toLowerCase()) {
  setEnsName(reverseName);  // Safe to display
} else {
  setEnsName(null);  // Spoofing attempt detected
}
```

### 3. Pull Payment Pattern

**Problem:** If fee transfer fails during cycle finalization, the entire transition reverts, bricking the contract.

**Solution:** Accumulate fees instead of immediate transfer. Owner withdraws separately.

```solidity
function _finalizeAdSlot(uint256 cycle, uint256 slotIndex) internal {
    // ... calculations

    accumulatedFees += feeAmount;  // Don't transfer immediately
    rewardPool += poolAmount;

    // ... finalize
}

function withdrawFees() external onlyOwner nonReentrant {
    uint256 amount = accumulatedFees;
    require(amount > 0, "No fees");

    accumulatedFees = 0;

    bool success = WLD.transfer(owner(), amount);
    require(success, "Transfer failed");
}
```

### 4. World ID Sybil Resistance

**Production (Orb):**
```solidity
uint256 internal immutable groupId = 1;  // Orb-verified
```
- One claim per unique human
- Requires in-person orb verification
- Highest level of sybil resistance

**Demo (Device):**
```solidity
uint256 internal immutable groupId = 0;  // Device-level
```
- One claim per device
- Lower barrier for testing
- Good for demos and development

## Environment Configuration

### `.env.local` Structure

```bash
# Authentication
AUTH_SECRET="..."  # Generated by npx auth
HMAC_SECRET_KEY="..."  # openssl rand -base64 32

# World ID
NEXT_PUBLIC_APP_ID="app_staging_xxx"
NEXT_PUBLIC_WLD_ACTION="verify-human"
AUTH_URL="https://your-domain.com"  # or ngrok for testing

# Contracts (deploy first)
NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_WLD_TOKEN_ADDRESS="0x..."

# Backend API
NEXT_PUBLIC_BACKEND_API_URL="http://localhost:3001"  # or ROFL endpoint

# Chain (World Chain Mainnet)
NEXT_PUBLIC_CHAIN_ID="480"
NEXT_PUBLIC_RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"

# Backend Signer
SIGNER_PRIVATE_KEY="0x..."  # Keep secret!
```

## TEE Deployment (Oasis ROFL)

For maximum trust and decentralization, the backend can be deployed to a Trusted Execution Environment using Oasis ROFL.

### Benefits

1. **Trustless Signatures**: Users can verify signatures come from legitimate TEE
2. **Secure Key Storage**: Private key encrypted and isolated in TEE
3. **Verifiable Computation**: Reward calculations provably executed correctly
4. **Decentralized**: No single point of failure
5. **Auditable**: Code is on-chain and inspectable

### Architecture

```
World Mini App → Oasis ROFL TEE Container → World Chain Contract
                      ↓
              Encrypted Private Key
              Geo-IP + Device Detection
              Signature Generation
```

### Key Components

**Docker Container:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**ROFL Configuration (`rofl.yaml`):**
```yaml
name: ads-signing-backend
version: 1.0.0
image: username/ads-backend:latest

resources:
  memory: 512Mi
  cpu: 1
  storage: 1Gi

network:
  ports:
    - containerPort: 3001
      protocol: TCP

healthCheck:
  path: /health
  port: 3001

env:
  - name: SIGNER_PRIVATE_KEY
    valueFrom:
      secretKeyRef:
        name: SIGNER_PRIVATE_KEY
```

## Repository Structure

```
ethba/
├── contracts/
│   ├── ADS.sol                    # Production contract
│   └── ADSDemo.sol                # Demo contract
│
├── src/
│   ├── app/
│   │   ├── (protected)/home/      # Main app page
│   │   ├── api/
│   │   │   ├── sign-claim/        # Backend signing
│   │   │   └── verify-proof/      # World ID verification
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── AdCard/                # Ad display with ENS
│   │   ├── Stats/                 # Pool balances
│   │   ├── SwapCard/              # Token swapping
│   │   ├── Verify/                # World ID registration
│   │   └── Navigation/            # Bottom nav
│   ├── hooks/
│   │   ├── useADSContract.ts      # Contract interaction
│   │   └── useENS.ts              # ENS resolution
│   └── config/
│       ├── contracts.ts           # Addresses & chain config
│       └── abi.ts                 # Contract ABIs
│
├── PROJECT.md                     # This file (technical docs)
├── README.md                      # Marketing pitch
├── DEPLOY.md                      # Deployment guide
├── .env.local                     # Environment config
├── package.json
└── tsconfig.json
```

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.20, OpenZeppelin |
| **Frontend** | Next.js 15, React 19, TypeScript |
| **UI Kit** | World ID Mini Apps UI Kit |
| **Web3** | Ethers.js 6 |
| **Blockchain** | World Chain (Mainnet) |
| **Identity** | World ID (Device/Orb verification) |
| **Naming** | ENS (Ethereum Mainnet) |
| **Backend** | Node.js, Express |
| **TEE (Optional)** | Oasis ROFL |

## Key Innovations

1. **Dynamic Rewards via Cryptographic Signatures**
   - Backend controls reward amounts
   - Users cannot manipulate without breaking signature
   - Enables geo-IP and device-based differentiation

2. **Proper ENS Reverse Resolution**
   - 3-step verification prevents spoofing
   - Ethereum Mainnet with L2 support
   - Security-first implementation

3. **Pull Payment Pattern**
   - Prevents contract bricking
   - Safe fee collection
   - Robust cycle management

4. **Demo Seeding Functions**
   - Instant ecosystem setup
   - Perfect for demonstrations
   - No waiting for real activity

5. **TEE-Ready Architecture**
   - Optional Oasis ROFL deployment
   - Verifiable computation
   - Trustless backend execution
