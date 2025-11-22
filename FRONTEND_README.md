# ADS Platform - Frontend Documentation

A decentralized advertising platform built on World Chain with World ID integration.

## Features

- **View Current Ads**: Browse ads for the current cycle with advertiser info (address, ENS name, World ID)
- **Claim Rewards**: Earn ADS tokens by clicking ads (variable rewards based on geo-IP and device)
- **Swap Tokens**: Exchange ADS tokens for WLD from the reward pool
- **World ID Registration**: Device-level verification for user authentication
- **ENS Integration**: Shows advertiser ENS names from Sepolia testnet

## Architecture

### Contract Integration

- **ADSDemo Contract**: 1-minute cycle demo version of the ADS platform
- **Dynamic Rewards**: Backend calculates rewards based on:
  - Argentina IP + Android: 1 ADS
  - Other countries + Android: 2 ADS
  - +1 ADS bonus for iOS devices

### Key Components

```
src/
├── app/
│   ├── (protected)/
│   │   └── home/
│   │       ├── page.tsx          # Main page (server component)
│   │       └── HomeContent.tsx   # Client component with contract logic
│   └── api/
│       ├── sign-claim/           # Backend signs claims with reward amounts
│       └── verify-proof/         # Verifies World ID proofs
├── components/
│   ├── AdCard/                   # Displays individual ad with ENS info
│   ├── Stats/                    # Shows pool balances and user stats
│   ├── SwapCard/                 # Swap interface for ADS → WLD
│   ├── Verify/                   # World ID registration
│   └── Navigation/               # Bottom navigation
├── hooks/
│   ├── useADSContract.ts         # Main contract interaction hook
│   └── useENS.ts                 # ENS name resolution (Sepolia)
└── config/
    ├── contracts.ts              # Contract addresses and chain config
    └── abi.ts                    # Contract ABIs
```

## Setup

### 1. Environment Variables

Update `.env.local`:

```bash
# World ID
NEXT_PUBLIC_APP_ID="app_staging_xxx"
NEXT_PUBLIC_WLD_ACTION="verify-human"

# Contract Addresses (deploy contracts first)
NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_WLD_TOKEN_ADDRESS="0x..."

# Chain Config (World Chain Mainnet)
NEXT_PUBLIC_CHAIN_ID="480"
NEXT_PUBLIC_RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"

# ENS (Sepolia Testnet)
NEXT_PUBLIC_ENS_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"

# Backend Signer (generate with: openssl rand -hex 32)
SIGNER_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Deploy Contracts

Deploy the ADSDemo contract to World Chain and update the addresses in `.env.local`.

### 4. Configure World ID

1. Go to [World ID Developer Portal](https://developer.worldcoin.org)
2. Create a new app
3. Add an incognito action with ID: `verify-human`
4. Update `NEXT_PUBLIC_APP_ID` in `.env.local`

### 5. Run Development Server

```bash
pnpm dev
```

Access via ngrok for World App testing:

```bash
ngrok http 3000
```

Update `AUTH_URL` in `.env.local` with your ngrok URL.

## User Flow

### 1. Registration
- User opens Mini App in World App
- Clicks "Register with World ID"
- Completes device-level verification
- Registered on smart contract (can claim rewards)

### 2. Viewing Ads
- Home page shows current cycle's ads
- Each ad displays:
  - Ad name and description
  - Advertiser address (with ENS name if available)
  - Bid amount in WLD
  - Claim status (can claim / claimed)

### 3. Claiming Rewards
1. User clicks "Claim Reward" on an ad
2. Frontend requests signature from `/api/sign-claim`
3. Backend calculates reward based on geo-IP and device:
   ```typescript
   // Argentina + Android: 1 ADS
   // Other countries + Android: 2 ADS
   // +1 ADS for iOS
   ```
4. Backend signs the reward amount
5. Frontend calls contract's `claimReward()` with signature
6. User receives ADS tokens

### 4. Swapping Tokens
- Navigate to swap section
- Enter ADS amount to swap
- See estimated WLD output
- Execute swap (proportional to total supply)

## Backend API

### POST /api/sign-claim

Signs a claim transaction with calculated reward amount.

**Request:**
```json
{
  "userAddress": "0x...",
  "cycle": "123",
  "slotIndex": 0
}
```

**Response:**
```json
{
  "rewardAmount": "1000000000000000000", // in wei
  "nonce": 1234567890,
  "timestamp": 1234567890,
  "signature": "0x..."
}
```

**Reward Calculation:**
- Reads `cf-ipcountry` or `x-vercel-ip-country` header for geo-IP
- Reads `user-agent` for device type (iOS/Android)
- Applies reward rules

### POST /api/verify-proof

Verifies World ID proof from MiniKit.

**Request:**
```json
{
  "payload": {
    "merkle_root": "...",
    "nullifier_hash": "...",
    "proof": "...",
    "verification_level": "device"
  },
  "action": "verify-human"
}
```

## ENS Integration

- Uses **Sepolia testnet** for ENS lookups (not mainnet)
- `useENS` hook fetches ENS names for advertiser addresses
- Shows format: `vitalik.eth (0x1234...5678)`
- Falls back to shortened address if no ENS name

## Contract Methods Used

### View Functions
- `getCurrentCycle()`: Get current time cycle
- `getCurrentAds()`: Fetch all ads for current cycle
- `getPoolBalances()`: Get reward pool, locked funds, and fees
- `balanceOf(user)`: Get user's ADS token balance
- `calculateSwapOutput(adsAmount)`: Estimate WLD for swap
- `hasUserClaimed(user, cycle, slot)`: Check claim status
- `isRegistered(user)`: Check World ID registration

### State-Changing Functions
- `claimReward(cycle, slot, rewardAmount, nonce, timestamp, signature)`: Claim ADS tokens
- `swapADSForWLD(adsAmount)`: Swap ADS for WLD
- `register(signal, root, nullifierHash, proof)`: Register with World ID

## Security

### Backend Signature Verification
The contract verifies signatures to prevent users from claiming without backend approval:

```solidity
// Contract recreates the same hash
bytes32 messageHash = keccak256(abi.encodePacked(
    msg.sender,
    cycle,
    slotIndex,
    rewardAmount,  // User cannot modify this
    nonce,
    timestamp
));

// Verifies signature matches authorized signer
address signer = ecrecover(ethSignedHash, signature);
require(authorizedSigners[signer], "Not authorized");
```

Users cannot:
- Forge signatures (need backend's private key)
- Modify reward amounts (breaks signature)
- Reuse signatures (nonce tracking)
- Claim without clicking (backend controls signatures)

### Additional Security Considerations

**Production Todos:**
1. Add click tracking database (prevent claims without actual clicks)
2. Implement rate limiting on `/api/sign-claim`
3. Add user authentication to sign-claim endpoint
4. Validate ad exists and is not removed before signing
5. Check user hasn't already claimed before signing
6. Use secure key management for `SIGNER_PRIVATE_KEY` (AWS KMS, etc.)

## Deployment

### Vercel Deployment

```bash
pnpm build
vercel --prod
```

Update `AUTH_URL` to your production URL.

### World App Integration

1. Deploy to production (Vercel recommended)
2. Update app manifest in World ID portal
3. Set Mini App URL to your production domain
4. Test in World App on mobile

## Testing

### Local Testing (Desktop)
- Use browser dev tools mobile emulation
- Test with different user-agents for reward calculation
- Mock geo-IP headers for testing

### World App Testing (Mobile)
- Deploy to ngrok
- Open Mini App in World App
- Test full flow including World ID verification
- Test on both iOS and Android for reward differentiation

## Known Limitations

1. **Contract interaction requires MetaMask**: Currently using ethers with window.ethereum
   - TODO: Use MiniKit transaction commands for seamless UX
2. **ENS lookup performance**: May be slow on first load
   - TODO: Add caching layer
3. **No pagination**: Shows all current ads
   - TODO: Add pagination if >10 ads per cycle

## Future Enhancements

- [ ] Use MiniKit transaction commands instead of MetaMask
- [ ] Add advertiser dashboard (place bids, view analytics)
- [ ] Implement ad click tracking with proof of view
- [ ] Add notification when new cycle starts
- [ ] Show user's claim history
- [ ] Add leaderboard of top earners
- [ ] Implement referral system

## Support

For issues or questions:
- Check World ID docs: https://docs.world.org/mini-apps
- MiniKit SDK: https://docs.world.org/minikit-js
- Contract source: `./contracts/ADSDemo.sol`
