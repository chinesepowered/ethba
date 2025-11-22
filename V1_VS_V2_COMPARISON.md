# ADS Platform: v1 vs v2 Architecture Comparison

## Quick Summary

| Aspect | v1 (Token-Based) | v2 (Proportional Tranche) |
|--------|------------------|---------------------------|
| **Core Mechanic** | Mint ADS tokens → Swap for WLD | Record clicks → Claim proportional WLD |
| **Reward Calculation** | Backend determines amount | Contract divides bid equally |
| **Payment** | Indirect (via token swap) | Direct WLD distribution |
| **Advertiser Cost** | Variable (depends on swaps) | Fixed (bid amount) |
| **User Steps** | Click → Claim → Swap | Click → Claim |
| **Complexity** | High (token + swap mechanics) | Low (simple division) |
| **Targeting** | Via reward differentiation | Via slot types |
| **Code Size** | ~800 lines | ~600 lines |

## Detailed Comparison

### User Flow

**v1: Token-Based**
```
1. See ad for Cycle 5, Slot 2
2. Click "Claim Reward"
3. Frontend calls /api/sign-claim
4. Backend checks: Argentina IP + Android
5. Backend calculates: 1 ADS token
6. Backend signs: (user, cycle, slot, 1 ADS, nonce, timestamp)
7. User calls claimReward() with signature
8. Contract verifies signature
9. Contract mints 1 ADS to user
10. User balance: 1 ADS token

Later:
11. User navigates to swap page
12. Checks balance: 1 ADS
13. Contract calculates: (1 ADS / total ADS supply) × reward pool = X WLD
14. User calls swapADSForWLD(1 ADS)
15. Contract burns 1 ADS
16. Contract transfers X WLD to user
```

**v2: Proportional Tranche**
```
1. See ad for Cycle 5, Slot 2 (AR_ONLY, 10 WLD bid)
2. Click "Record Click"
3. Frontend calls /api/authorize-click
4. Backend checks: Argentina IP
5. Backend signs: (user, cycle, slot, nonce, timestamp)
6. User calls recordClick() with signature
7. Contract verifies signature
8. Contract records: hasClicked[5][2][user] = true
9. Contract increments: slot.totalClicks++
10. User sees: "Click recorded!"

Next day (after cycle finalized):
11. User sees: "You can claim your reward!"
12. User clicks "Claim Reward"
13. Contract calculates: (10 WLD - 0.5 fee) / 100 clicks = 0.095 WLD
14. Contract transfers 0.095 WLD to user
15. Done!
```

### Smart Contract Comparison

#### State Variables

**v1**
```solidity
// ERC20 token
string public name = "ADS Token";
uint256 public totalSupply;
mapping(address => uint256) public balanceOf;

// Swap mechanics
uint256 public rewardPool;      // WLD available for swaps
uint256 public lockedFunds;     // WLD locked in current cycle

// Signatures include reward amount
mapping(bytes32 => bool) public usedSignatures;
```

**v2**
```solidity
// No token - removed ERC20 entirely

// Click tracking
mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasClicked;
mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasClaimed;

// Slot tracking
struct AdSlot {
    // ...existing fields...
    uint256 totalClicks;     // NEW
    uint256 claimedAmount;   // NEW
    uint256 finalizedAt;     // NEW (for deadline)
}

// Targeting
enum SlotType {
    GLOBAL, US_ONLY, AR_ONLY, EU_ONLY, ASIA_ONLY,
    MOBILE_ONLY, DESKTOP_ONLY, IOS_ONLY, ANDROID_ONLY, CUSTOM
}
```

#### Key Functions

**v1: Claim with Minting**
```solidity
function claimReward(
    uint256 cycle,
    uint256 slotIndex,
    uint256 rewardAmount,  // ← Backend-determined
    uint256 nonce,
    uint256 timestamp,
    bytes calldata signature
) external {
    // Verify signature includes rewardAmount
    bytes32 hash = keccak256(abi.encodePacked(
        msg.sender, cycle, slotIndex,
        rewardAmount,  // ← Part of signature
        nonce, timestamp
    ));

    // Verify signature
    require(verifySig(hash, signature));

    // Mint tokens
    _mint(msg.sender, rewardAmount);
}

function swapADSForWLD(uint256 adsAmount) external {
    uint256 wldAmount = (adsAmount * rewardPool) / totalSupply();
    _burn(msg.sender, adsAmount);
    rewardPool -= wldAmount;
    WLD.transfer(msg.sender, wldAmount);
}
```

**v2: Record & Claim**
```solidity
function recordClick(
    uint256 cycle,
    uint256 slotIndex,
    uint256 nonce,        // ← No rewardAmount!
    uint256 timestamp,
    bytes calldata signature
) external {
    // Verify signature (backend already verified targeting)
    bytes32 hash = keccak256(abi.encodePacked(
        msg.sender, cycle, slotIndex,
        // No rewardAmount in signature!
        nonce, timestamp
    ));

    // Record click
    hasClicked[cycle][slotIndex][msg.sender] = true;
    adSlots[cycle][slotIndex].totalClicks++;
}

function claimProportionalReward(
    uint256 cycle,
    uint256 slotIndex
) external {
    require(hasClicked[cycle][slotIndex][msg.sender], "No click");
    require(!hasClaimed[cycle][slotIndex][msg.sender], "Already claimed");

    AdSlot storage slot = adSlots[cycle][slotIndex];
    require(slot.finalized, "Not finalized");

    // Calculate proportional share
    uint256 bidAmount = slot.bidAmount;
    uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;
    uint256 availableAmount = bidAmount - feeAmount;
    uint256 userReward = availableAmount / slot.totalClicks;

    hasClaimed[cycle][slotIndex][msg.sender] = true;
    slot.claimedAmount += userReward;

    WLD.transfer(msg.sender, userReward);
}

// NEW: Collect expired claims after 14 days
function collectExpiredClaims(uint256 cycle, uint256 slotIndex) external {
    AdSlot storage slot = adSlots[cycle][slotIndex];
    require(block.timestamp > slot.finalizedAt + CLAIM_DEADLINE);

    uint256 unclaimed = availableAmount - slot.claimedAmount;
    WLD.transfer(owner(), unclaimed);
}
```

### Backend Comparison

#### API Endpoints

**v1**
```typescript
POST /api/sign-claim

Request:
{
  "userAddress": "0x...",
  "cycle": "5",
  "slotIndex": 2
}

Backend Logic:
1. Get geo-IP from headers
2. Get device from user-agent
3. Calculate reward:
   - AR + Android = 1 ADS
   - US + Android = 2 ADS
   - iOS = +1 ADS bonus
4. Sign message including rewardAmount

Response:
{
  "rewardAmount": "1000000000000000000",  // 1 ADS in wei
  "nonce": 1234567890,
  "timestamp": 1234567890,
  "signature": "0x..."
}
```

**v2**
```typescript
POST /api/authorize-click

Request:
{
  "userAddress": "0x...",
  "cycle": "5",
  "slotIndex": 2,
  "slotType": 2  // AR_ONLY
}

Backend Logic:
1. Get geo-IP from headers
2. Get device from user-agent
3. Verify user meets slot targeting:
   - If slotType is AR_ONLY, check country === 'AR'
   - If slotType is IOS_ONLY, check isIOS === true
   - etc.
4. If meets criteria, sign authorization
5. If doesn't meet, return 403 error

Response (Success):
{
  "authorized": true,
  "slotType": "AR_ONLY",
  "nonce": 1234567890,
  "timestamp": 1234567890,
  "signature": "0x..."
}

Response (Rejected):
{
  "error": "User does not meet targeting criteria",
  "slotType": "AR_ONLY"
}
```

### Targeting Implementation

**v1: Via Reward Differentiation**
```
Backend calculates different reward amounts based on user attributes:

Argentina users: Get 1 ADS token
US users: Get 2 ADS tokens
iOS users: Get +1 ADS bonus

Problem: Advertiser can't control who sees their ad.
          They just pay different amounts per user.
```

**v2: Via Slot Types**
```
Advertisers bid for specific slot types:

Slot 0 (GLOBAL): Anyone can click
Slot 1 (US_ONLY): Only US users can click
Slot 2 (AR_ONLY): Only AR users can click
Slot 3 (IOS_ONLY): Only iOS users can click

Backend verifies user meets criteria BEFORE authorizing click.
Users who don't meet criteria get rejected (403 error).

Benefit: Advertiser knows exactly who will see their ad.
```

### Economics Comparison

#### Advertiser Perspective

**v1**
```
Day 1: Bid 10 WLD for Slot 2

Outcome:
- 50 Argentina users claim (1 ADS each) = 50 ADS minted
- 30 US users claim (2 ADS each) = 60 ADS minted
- 20 iOS users claim (+1 bonus) = 20 extra ADS
- Total ADS minted: 130 ADS tokens

Later:
- Users swap 130 ADS for WLD
- Reward pool had 9.5 WLD (10 - 5% fee)
- Each ADS worth: 9.5 / totalSupply at time of swap
- Variable cost per user depending on when they swap
- Complex to predict total cost
```

**v2**
```
Day 1: Bid 10 WLD for Slot 2 (AR_ONLY)

Outcome:
- Only Argentina users can click
- 80 AR users record clicks
- No US users (rejected by backend)

Day 2 (after finalization):
- Available: 10 - 0.5 (fee) = 9.5 WLD
- Each AR user claims: 9.5 / 80 = 0.11875 WLD
- Total cost: Exactly 10 WLD
- Cost per user: Exactly 0.11875 WLD

Predictable! Advertiser knows:
- Exactly who can click (only AR users)
- Exactly what they'll pay (10 WLD total)
- Exactly cost per click (10 / actual clicks)
```

#### User Perspective

**v1**
```
User in Argentina with Android:

Step 1: Click ad, claim 1 ADS token
Step 2: Navigate to swap page
Step 3: See current rate: 1 ADS = 0.05 WLD (depends on total supply)
Step 4: Swap 1 ADS for 0.05 WLD
Step 5: Total received: 0.05 WLD

Problem: Exchange rate varies based on total supply
         Don't know value until swap
```

**v2**
```
User in Argentina:

Step 1: Click AR_ONLY ad (10 WLD bid)
Step 2: Wait for cycle to end
Step 3: See: "You can claim 0.11875 WLD" (known immediately)
Step 4: Claim 0.11875 WLD
Step 5: Total received: 0.11875 WLD

Benefit: Know exact reward before claiming
         Direct WLD payment (no swap needed)
```

### Gas Costs

**v1**
```
claimReward():
- Signature verification: ~3k gas
- World ID checks: ~10k gas
- State updates: ~20k gas
- Token minting (SSTORE): ~20k gas
- Event emission: ~2k gas
Total: ~55k gas

swapADSForWLD():
- Balance checks: ~5k gas
- Token burning (SSTORE): ~5k gas
- Reward pool update: ~5k gas
- WLD transfer: ~30k gas
- Event emission: ~2k gas
Total: ~47k gas

Total per user: ~102k gas
At 30 gwei: ~0.003 ETH (~$10)
```

**v2**
```
recordClick():
- Signature verification: ~3k gas
- World ID checks: ~10k gas
- State updates: ~20k gas
- Click recording (SSTORE): ~20k gas
- Counter increment: ~5k gas
- Event emission: ~2k gas
Total: ~60k gas

claimProportionalReward():
- Balance checks: ~5k gas
- Calculation: ~2k gas
- State updates: ~10k gas
- WLD transfer: ~30k gas
- Event emission: ~2k gas
Total: ~49k gas

Total per user: ~109k gas
At 30 gwei: ~0.0033 ETH (~$11)

Note: Similar gas costs, but simpler logic
```

### Code Complexity

**v1**
```
Lines of code:
- ERC20 implementation: ~150 lines
- Swap mechanics: ~50 lines
- Reward pool management: ~30 lines
- Claim with minting: ~80 lines
Total: ~310 lines (just these features)

External dependencies:
- OpenZeppelin ERC20
- OpenZeppelin Ownable
- OpenZeppelin ReentrancyGuard

Complexity points:
- Token supply management
- Swap rate calculation
- Reward pool tracking
- Locked funds tracking
```

**v2**
```
Lines of code:
- Slot types: ~15 lines (enum)
- Click recording: ~40 lines
- Proportional claiming: ~60 lines
- Expired claim collection: ~30 lines
Total: ~145 lines (just these features)

External dependencies:
- OpenZeppelin Ownable
- OpenZeppelin ReentrancyGuard
(No ERC20!)

Complexity points:
- Simple division for rewards
- Click tracking
- Deadline enforcement
```

**Winner: v2 is ~50% less code for core features**

## When to Use Each Version

### Use v1 (Token-Based) When:

✅ You want a tradeable token (ADS can be listed on DEXes)
✅ You want users to accumulate tokens over time
✅ You want flexible reward multipliers
✅ You need complex token economics
✅ Users prefer holding tokens vs claiming WLD

### Use v2 (Proportional Tranche) When:

✅ You want simple, predictable economics ✅ You want direct WLD distribution
✅ You want built-in targeting (geo, device)
✅ You want minimal code complexity
✅ Advertisers want predictable costs
✅ Users prefer immediate WLD rewards

## Migration Strategy

### Option 1: Run Both in Parallel

Deploy both v1 and v2:
- Some advertisers prefer v1 (token ecosystem)
- Some advertisers prefer v2 (predictability)
- Users choose which to use

### Option 2: Gradual Migration

1. Deploy v2 contract
2. Stop accepting new ads in v1
3. Let v1 users claim existing rewards
4. Migrate liquidity to v2
5. Sunset v1 after 30 days

### Option 3: Complete Replacement

1. Deploy v2
2. Airdrop equivalent WLD to v1 ADS holders
3. Immediately switch all traffic to v2
4. Deprecate v1

## Recommendation

**For new deployments**: Use **v2 (Proportional Tranche)**

**Reasons**:
1. **Simpler** - Less code, fewer bugs, easier to audit
2. **Predictable** - Advertisers know exact costs
3. **Direct** - Users get WLD immediately
4. **Targeted** - Built-in geo/device filtering
5. **Fair** - Equal pay for equal work (within cohort)

**For existing v1 deployments**: Consider v2 for future versions, but v1 is perfectly functional if you prefer token mechanics.

---

Both architectures are valid. v1 offers token economics and DeFi integration, while v2 offers simplicity and predictability. Choose based on your goals!
