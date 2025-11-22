# ADS Platform - Decentralized Advertising with World ID

A hackathon-ready decentralized advertising platform built on World Chain with World ID verification, dynamic geo-based rewards, and optional TEE deployment on Oasis.

## 🎯 Project Overview

Users earn **ADS tokens** by clicking ads. Advertisers bid **WLD tokens** for ad slots. The platform uses:

- ⚡ **1-minute cycles** (demo) or daily cycles (production)
- 🌍 **Geo-based rewards**: Different token amounts for Argentina vs. other countries
- 📱 **Device bonuses**: Extra rewards for iOS users
- 🔐 **World ID verification**: Sybil-resistant claims
- 🏷️ **ENS integration**: Shows advertiser names from Ethereum mainnet with verification
- 🔒 **TEE-ready backend**: Optional deployment to Oasis ROFL for trustless execution

## 📁 Repository Structure

```
ethba/
├── contracts/
│   ├── ADS.sol          # Production contract (daily cycles, orb verification)
│   └── ADSDemo.sol      # Demo contract (1-min cycles, device verification, seeding)
│
├── src/
│   ├── app/
│   │   ├── (protected)/home/      # Main ad viewing page
│   │   └── api/
│   │       ├── sign-claim/        # Backend signs claims with dynamic rewards
│   │       └── verify-proof/      # World ID verification
│   ├── components/
│   │   ├── AdCard/                # Ad display with ENS names
│   │   ├── Stats/                 # Pool balances & user stats
│   │   ├── SwapCard/              # ADS → WLD swapping
│   │   └── Verify/                # World ID registration
│   ├── hooks/
│   │   ├── useADSContract.ts      # Contract interaction
│   │   └── useENS.ts              # ENS reverse resolution with verification
│   └── config/
│       ├── contracts.ts           # Addresses & chain config
│       └── abi.ts                 # Contract ABIs
│
├── FRONTEND_README.md             # Frontend documentation
├── OASIS_ROFL_GUIDE.md           # TEE deployment guide
└── README.md                      # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Update `.env.local`:

```bash
# World ID
NEXT_PUBLIC_APP_ID="app_staging_xxx"
NEXT_PUBLIC_WLD_ACTION="verify-human"

# Contracts (deploy first)
NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_WLD_TOKEN_ADDRESS="0x..."

# World Chain
NEXT_PUBLIC_CHAIN_ID="480"
NEXT_PUBLIC_RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"

# Backend signer
SIGNER_PRIVATE_KEY="0x..."
```

### 3. Deploy Contracts

```bash
# Deploy ADSDemo to World Chain mainnet
# Update contract addresses in .env.local
```

### 4. Run Development Server

```bash
pnpm dev
```

Access via ngrok for World App testing:

```bash
ngrok http 3000
# Update AUTH_URL in .env.local
```

## 🎮 Demo Flow

### For Judges/Users

1. **Open Mini App** in World App
2. **Register** with World ID (device-level verification)
3. **View Ads** for current cycle (1-minute in demo)
4. **Click Ad** → Request signature from backend
5. **Claim Reward** → Receive ADS tokens (amount varies by location/device)
6. **Swap Tokens** → Exchange ADS for WLD from reward pool

### For Demo Setup (Hackathon)

The ADSDemo contract has seeding functions for instant setup:

```solidity
// Seed demo data (owner only)
seedRegistration(address user)           // Bypass World ID
seedAdSlot(cycle, slot, advertiser, ...) // Create fake ads
seedADSBalance(user, amount)             // Give users ADS tokens
seedRewardPool(wldAmount)                // Add WLD to pool
forceAdvanceCycle()                      // Skip 1-minute wait
```

Result: **Live ecosystem** with history, other users, and working swaps in <5 minutes!

## 🏗️ Smart Contract Architecture

### Production: ADS.sol

- **Cycles**: 24 hours (daily)
- **Verification**: Orb-verified World ID (groupId = 1)
- **Use Case**: Real platform deployment

### Demo: ADSDemo.sol

- **Cycles**: 1 minute
- **Verification**: Device-level World ID (groupId = 0)
- **Seeding**: Owner can populate test data
- **Use Case**: Hackathon demos, testing

### Key Features (Both Contracts)

✅ **Dynamic rewards** via backend signature
✅ **Auction-based bidding** for ad slots
✅ **Automatic cycle management**
✅ **Pool-based token swapping**
✅ **Pull payment pattern** for fees (prevents bricking)
✅ **World ID sybil resistance**

## 🌐 ENS Integration

### Proper Reverse Resolution with Verification

Following [ENS best practices](https://docs.ens.domains/web/reverse):

1. **Reverse lookup**: `address` → `name.eth`
2. **Forward verification**: `name.eth` → `address`
3. **Security check**: Only display if addresses match

**Why?** Prevents spoofing attacks where malicious actors set fake reverse records.

**Network**: Ethereum Mainnet (supports L2 primary names automatically)

## 🔐 Security Model

### Backend Signature Verification

The contract ensures users can't claim without backend approval:

```solidity
// Contract recreates message hash
bytes32 messageHash = keccak256(abi.encodePacked(
    msg.sender,
    cycle,
    slotIndex,
    rewardAmount,    // ← User cannot modify this
    nonce,
    timestamp
));

// Verifies signature from authorized signer
address signer = ecrecover(ethSignedHash, signature);
require(authorizedSigners[signer], "Not authorized");
```

**Users cannot:**
- ❌ Forge signatures (need backend's private key)
- ❌ Modify reward amounts (breaks signature)
- ❌ Reuse signatures (nonce tracking)
- ❌ Claim without clicking (backend controls signatures)

### Reward Calculation (Backend)

```typescript
let reward = parseEther('1'); // Base: 1 ADS

// Geo-IP detection
if (country !== 'AR') {
  reward = parseEther('2'); // Non-Argentina: 2 ADS
}

// Device bonus
if (isIOS) {
  reward += parseEther('1'); // iOS: +1 ADS
}
```

**Example scenarios:**
- 🇦🇷 Argentina + Android = **1 ADS**
- 🇺🇸 USA + Android = **2 ADS**
- 🇦🇷 Argentina + iOS = **2 ADS**
- 🇺🇸 USA + iOS = **3 ADS**

## 🛡️ TEE Deployment (Optional)

For maximum trust, deploy the backend to **Oasis ROFL** (Trusted Execution Environment):

### Benefits

1. **Trustless**: Users can verify signatures come from legitimate TEE
2. **Secure keys**: Private key encrypted and isolated
3. **Verifiable**: Reward calculations provably executed correctly
4. **Decentralized**: No single point of failure
5. **Auditable**: Code is on-chain and inspectable

### Quick Deploy

```bash
# 1. Build Docker image
cd backend
docker build -t username/ads-backend .
docker push username/ads-backend

# 2. Initialize ROFL
oasis rofl init

# 3. Register on-chain
oasis rofl create --network testnet

# 4. Store private key securely
oasis rofl secret set SIGNER_PRIVATE_KEY --value "0x..."

# 5. Deploy to TEE
oasis rofl build --output ads-backend.orc
oasis rofl deploy ads-backend.orc --network testnet
```

**Result**: Backend runs in **verifiable TEE** with cryptographic attestation!

📖 **Full Guide**: See [OASIS_ROFL_GUIDE.md](./OASIS_ROFL_GUIDE.md)

## 🎨 Frontend Features

- ✅ **Mobile-first design** (World App requirement)
- ✅ **Real-time stats** (pool balances, user balance)
- ✅ **ENS names** with verification
- ✅ **Live swap estimates**
- ✅ **Claim status tracking**
- ✅ **Cycle countdown** (demo: 1 min, prod: 24 hrs)
- ✅ **Error handling** with user-friendly messages

## 📚 Documentation

- **[FRONTEND_README.md](./FRONTEND_README.md)**: Complete frontend guide
  - Setup instructions
  - User flow
  - API documentation
  - Security model

- **[OASIS_ROFL_GUIDE.md](./OASIS_ROFL_GUIDE.md)**: TEE deployment guide
  - What is ROFL
  - Step-by-step deployment
  - Cost breakdown
  - Monitoring & maintenance

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.20, OpenZeppelin |
| **Frontend** | Next.js 15, React 19, TypeScript |
| **UI Kit** | World ID Mini Apps UI Kit |
| **Web3** | Ethers.js 6, Viem |
| **Blockchain** | World Chain (Mainnet) |
| **Identity** | World ID (Device/Orb verification) |
| **Naming** | ENS (Ethereum Mainnet) |
| **Backend** | Node.js, Express |
| **TEE (Optional)** | Oasis ROFL |

## 🏆 Hackathon Highlights

### Unique Features

1. **Geo-based Rewards**: First platform to use geo-IP for differentiated token economics
2. **TEE Integration**: Optional deployment to Oasis for verifiable computation
3. **ENS Verification**: Proper reverse resolution with security checks
4. **World ID**: Sybil-resistant claims with device verification
5. **Demo-Ready**: Seeding functions for instant ecosystem setup

### Technical Achievements

- ✅ Pull payment pattern prevents contract bricking
- ✅ Dynamic reward amounts via cryptographic signatures
- ✅ Automatic cycle management with fund unlocking
- ✅ Proportional token swapping
- ✅ Mobile-first World Mini App
- ✅ Production + demo contract variants

## 📝 License

MIT License

## 📞 Support

- **World ID Docs**: https://docs.worldcoin.org/mini-apps
- **Oasis ROFL**: https://docs.oasis.io/build/rofl
- **ENS Docs**: https://docs.ens.domains

---

**Built for ETH Global / World Chain Hackathon 2025** 🌍⚡
