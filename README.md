# ADS Platform

**Decentralized Advertising with Proportional Rewards**

A blockchain-based advertising platform where users earn WLD by clicking ads, and advertisers reach verified human audiences through World ID integration.

## What is ADS?

ADS (Advertising Distribution System) aligns incentives between users and advertisers through transparent on-chain mechanics:

- **Users earn WLD** by clicking advertisements during 24-hour cycles
- **Advertisers reach verified humans** protected by World ID sybil resistance
- **Fair proportional distribution** - each clicker gets equal share of the bid
- **Targeted audiences** with 10 slot types (Global, US-only, iOS-only, etc.)

## How It Works

### For Users (Earning WLD)

1. **Register** with World ID verification in the World Mini App
2. **Browse ads** - see which ones you're eligible for based on location/device
3. **Click ads** that interest you during the cycle
4. **Claim rewards** after the cycle ends - get your proportional share

**Example**: An advertiser bids 100 WLD for a US-only slot. 50 US users click it. After the 5% platform fee, each user can claim 1.9 WLD (95 WLD ÷ 50 users).

### For Advertisers (Reaching Real Humans)

1. **Choose a slot type** to target your ideal audience
2. **Bid WLD** for the slot - higher bids attract more attention
3. **Your ad runs** for 24 hours (or 1 minute in demo mode)
4. **Users click** - only eligible users based on your targeting
5. **Results on-chain** - transparent metrics you can verify

### Targeting Options (10 Slot Types)

- **Global**: Anyone worldwide
- **Geographic**: US-only, Argentina-only, EU-only, Asia-only
- **Device**: Mobile-only, Desktop-only, iOS-only, Android-only
- **Custom**: Advanced targeting

## Key Features

### Proportional Tranche Distribution

Unlike traditional pay-per-click, ADS uses a proportional reward model:

- **Advertiser bids**: 100 WLD for a slot
- **Platform fee**: 5% (5 WLD)
- **User pool**: 95 WLD distributed equally among all clickers
- **Your share**: 95 WLD ÷ total_clicks

This creates:
- **Predictable costs** for advertisers (fixed bid amount)
- **Fair distribution** for users (equal shares)
- **Sybil resistance** through World ID (one person = one share)

### Targeting Enforcement

**Backend Authorization**: Before recording a click on-chain, the backend verifies eligibility:
- US-only ad? Check geo-IP for US location
- iOS-only ad? Verify user-agent shows iOS device
- Not eligible? Click rejected, no gas wasted

**On-Chain Recording**: Verified clicks recorded on World Chain with backend signature

### World ID Integration

- **Orb Verification** (Production): One account per unique human
- **Device Verification** (Demo): One account per device for testing
- Prevents multi-accounting and bot farms

## Privacy & Transparency

**What We Track:**
- Geo-IP country code (for targeting verification)
- Device type (for targeting verification)
- World ID verification status
- On-chain click & claim history

**What We Don't Track:**
- Personal information
- Browsing history outside the app
- Precise location data
- User behavior across sites

**Transparency:**
- All contracts are open source and verified
- Ad bids and clicks are on-chain
- Reward calculations are verifiable
- Backend signatures prevent manipulation

## Technology Stack

Built on cutting-edge Web3 infrastructure:

- **Blockchain**: World Chain (EVM-compatible L2)
- **Identity**: World ID verification (Orb/Device)
- **Smart Contracts**: Solidity with Permit2 integration
- **Frontend**: Next.js + React (World Mini App)
- **Token**: WLD (Worldcoin native token)
- **Transactions**: Permit2 for gasless approvals

## Why Proportional Distribution?

Compared to token-based systems:

- **50% less code** - simpler architecture
- **Direct WLD rewards** - no intermediary token
- **Predictable economics** - advertisers know exact cost
- **Fair for all** - equal shares prevent gaming
- **No token price risk** - rewards in WLD directly

## Example Scenarios

### Scenario 1: Popular Global Ad
- **Bid**: 1000 WLD
- **Clicks**: 500 users
- **Each user gets**: (1000 × 0.95) ÷ 500 = **1.9 WLD**

### Scenario 2: Niche iOS-Only Ad
- **Bid**: 100 WLD
- **Clicks**: 20 iOS users
- **Each user gets**: (100 × 0.95) ÷ 20 = **4.75 WLD**

### Scenario 3: High-Value US Campaign
- **Bid**: 5000 WLD
- **Clicks**: 250 US users
- **Each user gets**: (5000 × 0.95) ÷ 250 = **19 WLD**

## Security Architecture

### Permit2 Integration
- Single-transaction bidding (no separate approval)
- MiniKit handles signature generation
- Compatible with World Mini Apps requirements

### Backend Signature Verification
- Users cannot click ineligible ads
- Backend signs authorization after verification
- Contract validates signature on-chain
- Prevents cheating and gas waste

### Pull Payment Pattern
- Platform fees accumulated safely
- No risk of contract bricking
- Robust cycle management

## Getting Started

This is a World Mini App - it runs inside the World App on your phone.

**Documentation:**
- `project.md` - Complete technical documentation
- `deploy.md` - Deployment guide for World Chain

**Support:**
- World ID Docs: https://docs.worldcoin.org
- World Mini Apps: https://docs.world.org/mini-apps
