# ADS Platform v2 - Proportional Tranche Architecture

## 🎯 Core Concept

**Old System**: Mint dynamic ADS tokens → swap for WLD
**New System**: Record clicks → claim proportional share of advertiser bid

## Key Innovation

Instead of minting tokens based on location/device, users record clicks and later claim a **proportional share** of the advertiser's bid:

```
10 WLD bid ÷ 100 clickers = 0.1 WLD per person
```

## Architecture Comparison

### Old Flow (v1)
```
1. Advertiser bids 10 WLD
2. User clicks ad
3. Backend calculates reward (1-3 ADS based on location/device)
4. Backend signs reward amount
5. User calls claimReward() → mints ADS tokens
6. User swaps ADS for WLD from reward pool
```

**Problems**:
- Complex token economics
- Swap mechanics needed
- Reward pool management
- Dynamic token supply

### New Flow (v2)
```
1. Advertiser bids 10 WLD for "US_ONLY" slot
2. User clicks ad
3. Backend verifies user is in US
4. Backend signs click authorization (no amount)
5. User calls recordClick() → just records, no payment
6. Cycle ends, slot finalized
7. User calls claimProportionalReward() → gets (bidAmount ÷ totalClicks)
```

**Benefits**:
- ✅ No token minting
- ✅ Direct WLD distribution
- ✅ Simpler economics
- ✅ Fair proportional rewards
- ✅ Advertisers know exact cost
- ✅ Targeting built into slots

## Slot Types & Targeting

### Available Slot Types

| Slot Type | Criteria | Example Use Case |
|-----------|----------|------------------|
| `GLOBAL` | Anyone | Brand awareness campaigns |
| `US_ONLY` | US IP addresses | US-specific products |
| `AR_ONLY` | Argentina IP addresses | Local businesses |
| `EU_ONLY` | EU IP addresses | GDPR-compliant services |
| `ASIA_ONLY` | Asia IP addresses | Regional expansion |
| `MOBILE_ONLY` | Mobile devices | Mobile app promotion |
| `DESKTOP_ONLY` | Desktop devices | Desktop software |
| `IOS_ONLY` | iOS devices | iOS app launch |
| `ANDROID_ONLY` | Android devices | Android app launch |
| `CUSTOM` | Custom logic | Advanced targeting |

### Targeting Verification

Backend verifies criteria **before** signing click authorization:

```typescript
// Backend checks geo-IP
const country = req.headers['cf-ipcountry'] || 'UNKNOWN';

// For US_ONLY slot
if (slotType === SlotType.US_ONLY && country !== 'US') {
  return res.status(403).json({
    error: 'User does not meet targeting criteria'
  });
}

// For iOS_ONLY slot
const userAgent = req.headers['user-agent'] || '';
const isIOS = /iPhone|iPad|iPod/.test(userAgent);

if (slotType === SlotType.IOS_ONLY && !isIOS) {
  return res.status(403).json({
    error: 'User does not meet targeting criteria'
  });
}
```

## Smart Contract Design

### Data Structures

```solidity
enum SlotType {
    GLOBAL,
    US_ONLY,
    AR_ONLY,
    EU_ONLY,
    ASIA_ONLY,
    MOBILE_ONLY,
    DESKTOP_ONLY,
    IOS_ONLY,
    ANDROID_ONLY,
    CUSTOM
}

struct AdSlot {
    address advertiser;
    string name;
    string description;
    string imageUrl;
    uint256 bidAmount;      // WLD paid
    SlotType slotType;      // Targeting criteria
    bool finalized;         // Cycle ended
    bool removed;           // Ad removed
    uint256 totalClicks;    // Unique clicks
    uint256 claimedAmount;  // WLD already claimed
    uint256 finalizedAt;    // Timestamp (for deadline)
}
```

### State Tracking

```solidity
// Cycle => Slot => User => Clicked
mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasClicked;

// Cycle => Slot => User => Claimed
mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasClaimed;
```

### Key Functions

#### 1. Record Click (During Cycle)

```solidity
function recordClick(
    uint256 cycle,
    uint256 slotIndex,
    uint256 nonce,
    uint256 timestamp,
    bytes calldata signature
) external nonReentrant {
    // Verify backend signature (targeting already verified)
    // Record click: hasClicked[cycle][slotIndex][msg.sender] = true
    // Increment: slot.totalClicks++
}
```

**Requirements**:
- User is registered (World ID)
- Cycle is past (not current)
- Slot is not finalized yet
- User hasn't clicked before
- Backend signature is valid

#### 2. Claim Proportional Reward (After Cycle)

```solidity
function claimProportionalReward(
    uint256 cycle,
    uint256 slotIndex
) external nonReentrant {
    // Calculate: userReward = (bidAmount - fees) / totalClicks
    // Transfer: WLD.transfer(msg.sender, userReward)
}
```

**Requirements**:
- Slot is finalized
- User has clicked
- User hasn't claimed
- Within 14-day deadline

**Formula**:
```
bidAmount = 10 WLD
platformFee = 10 WLD × 5% = 0.5 WLD
availableAmount = 10 - 0.5 = 9.5 WLD
totalClicks = 100
userReward = 9.5 / 100 = 0.095 WLD
```

#### 3. Collect Expired Claims (After Deadline)

```solidity
function collectExpiredClaims(
    uint256 cycle,
    uint256 slotIndex
) external nonReentrant {
    // After 14 days, unclaimed WLD goes to owner
    // Anyone can trigger this function
}
```

**Requirements**:
- Slot is finalized
- 14 days have passed
- Unclaimed amount > 0

## Example Scenarios

### Scenario 1: US-Only Campaign

```
Advertiser: Bids 100 WLD for US_ONLY slot
Targeting: US IP addresses only

Day 1:
- 200 people try to click
- Backend verifies: 150 are in US, 50 are not
- Only 150 get click authorization
- 150 users call recordClick()
- slot.totalClicks = 150

Day 2 (cycle finalized):
- availableAmount = 100 WLD - 5 WLD (fee) = 95 WLD
- Each user can claim: 95 / 150 = 0.633 WLD
- 140 users claim within 14 days
- Total claimed: 140 × 0.633 = 88.67 WLD

Day 16 (14 days later):
- Unclaimed: 95 - 88.67 = 6.33 WLD
- Anyone calls collectExpiredClaims()
- 6.33 WLD goes to platform owner
```

### Scenario 2: Mobile vs Desktop

```
Cycle 5 has 10 slots:
- Slot 0 (GLOBAL): 1000 WLD bid, anyone can claim
- Slot 1 (MOBILE_ONLY): 500 WLD bid, mobile users only
- Slot 2 (IOS_ONLY): 300 WLD bid, iOS users only
- Slot 3 (ANDROID_ONLY): 200 WLD bid, Android users only
- ...

User on iPhone can click:
- Slot 0 (GLOBAL) ✓
- Slot 1 (MOBILE_ONLY) ✓
- Slot 2 (IOS_ONLY) ✓
- Slot 3 (ANDROID_ONLY) ✗

User on desktop can click:
- Slot 0 (GLOBAL) ✓
- Slot 1 (MOBILE_ONLY) ✗
- Slot 2 (IOS_ONLY) ✗
- Slot 3 (ANDROID_ONLY) ✗
```

### Scenario 3: Geographic Targeting

```
Travel agency wants Argentina users:

Advertiser: Bids 50 WLD for AR_ONLY slot
Day 1:
- 1000 people click
- Backend checks cf-ipcountry header
- Only 80 are from Argentina
- 80 users record clicks

Day 2:
- Each Argentine user claims: (50 - 2.5) / 80 = 0.59 WLD
- Travel agency reaches exact target audience
```

## Backend Signature Changes

### Old Signature (v1)
```typescript
// Included reward amount (1-3 ADS tokens)
const messageHash = keccak256(
  userAddress,
  cycle,
  slotIndex,
  rewardAmount,  // ← Calculated by backend
  nonce,
  timestamp
);
```

### New Signature (v2)
```typescript
// No reward amount - just click authorization
const messageHash = keccak256(
  userAddress,
  cycle,
  slotIndex,
  nonce,
  timestamp
);
```

**Backend's job now**:
1. Verify user meets targeting criteria
2. Sign click authorization
3. That's it!

**Contract calculates rewards**:
- After cycle ends
- Based on total clicks
- Proportional distribution

## Economics

### Advertiser Perspective

**Old System**:
- Bid 10 WLD
- Unknown how many users will claim
- Unknown total cost (depends on swaps)
- Complex reward pool mechanics

**New System**:
- Bid 10 WLD for US_ONLY slot
- Know exact cost upfront: 10 WLD
- Platform fee: 5% (0.5 WLD)
- Users split: 9.5 WLD
- **Predictable CPM**: If 100 clicks, cost is 0.1 WLD per click

### User Perspective

**Old System**:
- Click ad in Argentina: get 1 ADS token
- Click ad in US: get 2 ADS tokens
- Click on iOS: get +1 ADS bonus
- Swap ADS for WLD (proportional to supply)
- Complex, multi-step process

**New System**:
- Click GLOBAL ad: share with everyone who clicked
- Click US_ONLY ad: only compete with other US users
- Click IOS_ONLY ad: only compete with other iOS users
- **One-step claim**: Get WLD directly
- **Fair split**: Everyone in your cohort gets same amount

## Migration Path

### What Changes

1. **Remove ADS Token**
   - No more minting
   - No more swapping
   - No more reward pool management

2. **Add Slot Types**
   - Advertisers choose targeting
   - Backend verifies criteria
   - Slots are more valuable

3. **Change Reward Logic**
   - From: Dynamic amount per user
   - To: Proportional share of bid

4. **Add Claim Deadline**
   - 14-day window to claim
   - Unclaimed goes to platform

### What Stays The Same

✅ World ID verification
✅ Backend signature requirement
✅ Daily cycles
✅ Ad slot bidding
✅ Platform fees (5%)
✅ Pull payment pattern

### Deployment Strategy

**Option 1: New Contract**
- Deploy ADSv2 alongside ADS
- Users migrate gradually
- Keep both running

**Option 2: Upgrade**
- Deploy ADSv2
- Sunset ADS
- One-time migration for users

**Option 3: Parallel**
- Run both systems
- Some advertisers prefer old model
- Some prefer new model

## Technical Implementation

### Contract Size

**Removed**:
- ADS token (ERC20) code
- Swap mechanics
- Reward pool tracking
- Dynamic supply management

**Added**:
- SlotType enum (10 types)
- hasClicked mapping
- totalClicks tracking
- Claim deadline logic
- Expired claim collection

**Net change**: ~200 lines less code, simpler logic

### Gas Costs

| Operation | Old Gas | New Gas | Change |
|-----------|---------|---------|--------|
| Claim reward | ~180k | ~120k | -33% ↓ |
| Swap tokens | ~90k | 0 | -100% ✅ |
| Record click | N/A | ~80k | New |
| Total per user | ~270k | ~200k | -26% ↓ |

### Backend Complexity

**Old**: Calculate reward based on geo-IP and device
**New**: Just verify targeting criteria

Simpler, faster, more secure.

## Security Considerations

### Attack Vectors

**Sybil Attacks**:
- ✅ Prevented by World ID (same as v1)
- One claim per unique human

**Geographic Spoofing**:
- ⚠️ Users could use VPN to appear in different country
- Mitigation: Use multiple geo-IP providers
- Consider: Device fingerprinting, IP reputation

**Click Fraud**:
- ⚠️ Users could click without viewing
- Mitigation: Track view time on frontend
- Consider: Proof-of-view mechanism

**Unclaimed Farming**:
- ⚠️ Users could avoid claiming to deprive others
- Mitigation: 14-day deadline ensures funds are distributed
- Platform gets unclaimed, can redistribute

### Trust Model

**Old System**:
- Trust backend to calculate fair rewards
- Trust reward pool has sufficient WLD
- Trust token economics

**New System**:
- Trust backend to verify targeting correctly
- Trust proportional distribution (on-chain math)
- Simpler trust assumptions

## Future Enhancements

### Advanced Targeting

```solidity
struct CustomTargeting {
    string[] requiredCountries;
    string[] excludedCountries;
    uint256 minAge;  // Via World ID proof
    uint256 maxAge;
    bool requiresPreviousClaims;  // Power users
    uint256 minReputationScore;
}
```

### Dynamic Pricing

Advertisers bid higher for competitive slots:
```
US_ONLY slot: 10 WLD bid, 100 clickers = 0.1 WLD/user
AR_ONLY slot: 2 WLD bid, 20 clickers = 0.1 WLD/user
```

Same reward per user, but advertiser pays based on reach.

### Slot Auctions

Real-time bidding:
```
Hour 0: Current bid 5 WLD
Hour 12: Someone bids 7 WLD (previous bidder refunded)
Hour 20: Someone bids 10 WLD (highest bid wins)
```

### Analytics Dashboard

Show advertisers:
- Click-through rate
- Geographic distribution
- Device breakdown
- Cost per click
- Conversion tracking

## Summary

**ADS Platform v2** simplifies the entire system by:

1. **Removing token complexity** - No minting, swapping, or supply management
2. **Direct WLD distribution** - Users get paid in what they want
3. **Fair proportional rewards** - Everyone in targeting cohort gets equal share
4. **Predictable advertiser costs** - Know exactly what you'll pay
5. **Built-in targeting** - Slots have native geo/device targeting
6. **Simpler economics** - Bid amount ÷ click count = reward per user

**Result**: Cleaner code, better UX, more predictable economics, easier to explain and understand.

---

**Ready to implement v2?** See `contracts/ADSv2.sol` and `backend/src/index-v2.ts` for the full implementation.
