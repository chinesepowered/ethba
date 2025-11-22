# ADS Platform

**Decentralized Advertising with Verified Audiences**

A blockchain-based advertising platform that rewards users for viewing ads while providing advertisers with sybil-resistant, verified audiences through World ID integration.

## What is ADS?

ADS (Advertising Distribution System) reimagines digital advertising by aligning incentives between users and advertisers:

- **Users earn tokens** by viewing and engaging with advertisements
- **Advertisers reach verified humans** protected by World ID sybil resistance
- **Fair value distribution** through transparent on-chain mechanics
- **Privacy-preserving rewards** with dynamic compensation based on user context

## Key Features

### For Users

- **Earn While You Browse**: Get paid in ADS tokens for viewing advertisements
- **Dynamic Rewards**: Compensation varies based on your location and device
- **Instant Swaps**: Exchange earned ADS tokens for WLD from the reward pool
- **Privacy First**: No tracking beyond what's necessary for fair compensation
- **Sybil Protection**: World ID ensures one person = one account

### For Advertisers

- **Verified Audiences**: Reach real humans, not bots or duplicate accounts
- **Auction-Based Pricing**: Bid for ad slots in competitive cycles
- **Transparent Metrics**: On-chain visibility into ad performance
- **ENS Integration**: Build brand recognition with your ENS name
- **Flexible Cycles**: Choose between rapid (1-minute) or daily (24-hour) campaigns

## How It Works

### 1. User Registration
- Open the Mini App in World App
- Complete World ID verification (device or orb level)
- Start earning immediately

### 2. View & Earn
- Browse current cycle's advertisements
- Click ads that interest you
- Claim ADS token rewards
- Reward amounts vary by location and device

### 3. Swap Tokens
- Exchange ADS tokens for WLD
- Proportional swaps from the reward pool
- Instant settlement on-chain

### 4. Advertiser Bidding
- Place WLD bids for ad slots
- Compete in auction-based cycles
- Reach verified human audiences

## Dynamic Rewards

The platform uses context-aware reward distribution:

| User Context | Base Reward | iOS Bonus | Total |
|-------------|-------------|-----------|-------|
| Argentina + Android | 1 ADS | - | **1 ADS** |
| Other Countries + Android | 2 ADS | - | **2 ADS** |
| Argentina + iOS | 1 ADS | +1 ADS | **2 ADS** |
| Other Countries + iOS | 2 ADS | +1 ADS | **3 ADS** |

Rewards are cryptographically signed by the backend to prevent manipulation.

## Security & Trust

### Cryptographic Signature Verification
Users cannot forge or modify reward amounts. Every claim requires a valid signature from the authorized backend signer.

### Cross-Chain Name Resolution
Advertiser names are resolved from Arbitrum One, demonstrating cross-chain identity:
1. Address → Name lookup on Arbitrum
2. Name → Address verification
3. Only displayed if addresses match

**Why Arbitrum names?**
- Demonstrates cross-chain trust and identity portability
- World ID provides sybil resistance, Arbitrum names provide established identity
- Shows how reputation from one chain carries over to another
- No need for separate names on every chain

This prevents spoofing attacks and showcases interoperability.

### World ID Integration
- **Orb Verification** (Production): One claim per unique human
- **Device Verification** (Demo): One claim per device
- Prevents sybil attacks and multi-accounting

### Trusted Execution Environment
Optionally deploy the backend to Oasis ROFL for:
- Verifiable computation
- Encrypted key storage
- Decentralized execution
- Auditable code

## Technology Stack

Built on cutting-edge Web3 infrastructure:

- **Blockchain**: World Chain (EVM-compatible)
- **Identity**: World ID verification
- **Smart Contracts**: Solidity with OpenZeppelin security
- **Frontend**: Next.js + React (World Mini App)
- **Naming**: ENS (Ethereum Mainnet)
- **Optional TEE**: Oasis ROFL

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
pnpm dev

# For World App testing (use ngrok)
ngrok http 3000
```

See [DEPLOY.md](./DEPLOY.md) for complete deployment instructions.

## Contract Variants

### Production (`ADS.sol`)
- **Cycles**: 24 hours (daily)
- **Verification**: Orb-level World ID
- **Use Case**: Real platform deployment

### Demo (`ADSDemo.sol`)
- **Cycles**: 1 minute (rapid testing)
- **Verification**: Device-level World ID
- **Seeding**: Pre-populated test data
- **Use Case**: Development and demonstrations

## Architecture Highlights

### Pull Payment Pattern
Platform fees are accumulated and withdrawn separately, preventing contract bricking if fee transfers fail.

### Automatic Cycle Management
Cycles finalize automatically, unlocking funds and enabling swaps without manual intervention.

### Proportional Swapping
Token swaps use the formula: `(userADS / totalADS) × rewardPool`

This ensures fair value distribution as the token supply changes.

### Ad Slot Auctions
Advertisers compete for slots by placing WLD bids. Higher bids displace lower ones, with automatic refunds.

## Privacy & Transparency

**What We Track:**
- Geo-IP country code (for reward calculation)
- Device type (for reward bonuses)
- World ID verification status
- On-chain claim history

**What We Don't Track:**
- Personal information
- Browsing history outside the app
- Precise location data
- User behavior across sites

**Transparency:**
- All contracts are open source
- Ad bids and claims are on-chain
- Reward calculations are verifiable
- Optional TEE deployment for trustless execution

## Future Roadmap

- [ ] Advertiser dashboard with analytics
- [ ] Click tracking with proof-of-view
- [ ] Cycle start notifications
- [ ] User claim history viewer
- [ ] Top earners leaderboard
- [ ] Referral system
- [ ] Advanced ad targeting options

## Documentation

- **[PROJECT.md](./PROJECT.md)**: Complete technical documentation for developers
- **[DEPLOY.md](./DEPLOY.md)**: Step-by-step deployment guide
- **[OASIS_QUICKSTART.md](./OASIS_QUICKSTART.md)**: Deploy to Oasis ROFL TEE in 10 minutes
- **Contracts**: See `contracts/` directory for Solidity source
- **Backend**: See `backend/` directory for TEE signing service

## Support & Community

- **Issues**: Report bugs on GitHub
- **World ID Docs**: https://docs.worldcoin.org
- **Oasis ROFL**: https://docs.oasis.io/build/rofl
- **ENS Docs**: https://docs.ens.domains

## License

MIT License - see LICENSE file for details

---

**Built with** ❤️ **on World Chain**
