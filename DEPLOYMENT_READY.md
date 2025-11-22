# ✅ ADS Platform - Ready for Oasis ROFL Deployment

Your platform is now fully configured for Trusted Execution Environment deployment!

## What Was Implemented

### 1. Cross-Chain Name Resolution ✨
- **Changed from**: Ethereum Mainnet ENS
- **Changed to**: Arbitrum Name Service
- **Why**: Demonstrates cross-chain identity portability
  - Users on World Chain can display their Arbitrum names
  - Shows how reputation from one chain carries over to another
  - World ID provides sybil resistance, Arbitrum provides identity
  - No need for separate names on every chain

**File**: `src/hooks/useENS.ts`
```typescript
// Now uses Arbitrum One RPC
const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');
```

### 2. Standalone Backend for TEE 🔒

Complete Express server ready for Oasis ROFL deployment:

```
backend/
├── src/index.ts          # Express server with signing logic
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── Dockerfile            # Multi-stage Docker build
├── .dockerignore         # Build optimization
└── README.md             # Backend docs
```

**Features**:
- ✅ Health endpoint for monitoring
- ✅ Geo-IP based reward calculation
- ✅ Device detection (iOS bonus)
- ✅ CORS support
- ✅ Comprehensive logging
- ✅ Error handling
- ✅ TypeScript with strict mode

### 3. Oasis ROFL Configuration 📦

**File**: `rofl.yaml`
- Resource allocation (512Mi RAM, 1 CPU, 1Gi storage)
- Health checks every 30 seconds
- Secret management for private keys
- Docker image configuration
- Network and port setup

### 4. Deployment Automation 🚀

**File**: `deploy-oasis.sh`
- Interactive deployment script
- Guides through all steps
- Handles Docker build & push
- Manages Oasis registration
- Configures secrets
- Verifies deployment

### 5. Documentation 📚

- **OASIS_QUICKSTART.md**: Deploy to TEE in 10 minutes
- **PROJECT.md**: Updated with Arbitrum integration details
- **README.md**: Cross-chain trust highlighted
- **CHANGELOG.md**: Complete change history
- **backend/README.md**: Backend-specific docs

## Quick Start - Deploy to Oasis NOW

### Prerequisites

```bash
# Install Oasis CLI
npm install -g @oasisprotocol/cli

# Get testnet tokens (~100 TEST)
# Visit: https://faucet.testnet.oasis.io
```

### Option 1: Automated Deployment (Recommended)

```bash
# 1. Set your Docker Hub username
export DOCKER_IMAGE="YOUR_DOCKERHUB_USERNAME/ads-backend"

# 2. Run automated script
chmod +x deploy-oasis.sh
./deploy-oasis.sh
```

The script will guide you through:
- Docker build & push
- Oasis app registration
- Secret configuration
- Bundle creation
- TEE deployment

### Option 2: Manual Deployment

Follow the step-by-step guide in **[OASIS_QUICKSTART.md](./OASIS_QUICKSTART.md)**

## What You'll Get

After deployment:
- ✅ **HTTPS Endpoint**: `https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io`
- ✅ **TEE Attestation**: Cryptographic proof of correct execution
- ✅ **Encrypted Secrets**: Private key isolated in TEE
- ✅ **On-chain Registry**: Transparent app configuration
- ✅ **Verifiable Logs**: Audit trail of all operations

## Testing the Deployment

```bash
# Health check
curl https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io/health

# Expected response:
{
  "status": "healthy",
  "signer": "0x...",
  "timestamp": 1234567890,
  "tee": "oasis-rofl"
}

# Sign claim test
curl -X POST https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io/api/sign-claim \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "cycle": "1",
    "slotIndex": 0
  }'

# Expected response:
{
  "rewardAmount": "1000000000000000000",
  "nonce": 1234567890,
  "timestamp": 1234567890,
  "signature": "0x..."
}
```

## Monitoring

```bash
# View logs in real-time
oasis rofl logs --app-id 0xYOUR_APP_ID --network testnet --follow

# Check app status
oasis rofl info --app-id 0xYOUR_APP_ID --network testnet

# List all your apps
oasis rofl list --network testnet
```

## Update Frontend

After deployment, update your frontend `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_API_URL="https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io"
```

Then rebuild and redeploy:

```bash
pnpm build
vercel --prod
```

## Cost Breakdown

### Testnet (Getting Started)
- App registration: ~50 TEST (one-time)
- Initial deployment: ~50 TEST (one-time)
- Machine rental: ~5 TEST/day (ongoing)
- **Total needed**: ~100 TEST tokens

### Mainnet (Production)
- Estimated: $20-50/month in ROSE tokens
- Paid in ROSE tokens
- Scales with usage

## Security Benefits

### What TEE Provides
✅ **Private Key Isolation**: Cannot be extracted from enclave
✅ **Verifiable Computation**: Reward calculations are provably correct
✅ **Cryptographic Attestation**: Users can verify code integrity
✅ **On-chain Registry**: Transparent configuration
✅ **Encrypted Secrets**: Secure key storage

### What TEE Doesn't Protect
⚠️ **Input Validation**: Still needed at application level
⚠️ **Rate Limiting**: Implement in your code
⚠️ **Logic Bugs**: Code correctness is your responsibility
⚠️ **DDoS**: May need additional infrastructure

## Architecture

```
┌─────────────────────┐
│  World Mini App     │
│  (World Chain)      │
└──────────┬──────────┘
           │
           │ HTTPS Request
           │ cf-ipcountry: AR
           │ user-agent: iPhone
           ▼
┌─────────────────────────────────┐
│   Oasis ROFL TEE Container      │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Express API Server      │  │
│  │  - Geo-IP Detection      │  │
│  │  - Device Detection      │  │
│  │  - Reward Calculation    │  │
│  └──────────┬───────────────┘  │
│             │                   │
│             ▼                   │
│  ┌──────────────────────────┐  │
│  │  Ethers.js Signer        │  │
│  │  (Private Key in TEE)    │  │
│  │  Signs: 2 ADS + 1 bonus  │  │
│  └──────────┬───────────────┘  │
│             │                   │
└─────────────┼───────────────────┘
              │
              │ Signature: 0x...
              ▼
┌─────────────────────────────┐
│  World Chain                │
│  ADSDemo Contract           │
│  - Verifies signature       │
│  - Mints 3 ADS to user      │
└─────────────────────────────┘
```

## Cross-Chain Identity Flow

```
┌─────────────────────────────┐
│  Advertiser on World Chain  │
│  Address: 0xABC...DEF       │
└──────────┬──────────────────┘
           │
           │ Display name?
           ▼
┌─────────────────────────────┐
│  Arbitrum One               │
│  Reverse Lookup             │
│  0xABC...DEF → alice.eth    │
└──────────┬──────────────────┘
           │
           │ Verify ownership
           ▼
┌─────────────────────────────┐
│  Arbitrum One               │
│  Forward Lookup             │
│  alice.eth → 0xABC...DEF    │
└──────────┬──────────────────┘
           │
           │ ✓ Match!
           ▼
┌─────────────────────────────┐
│  World Chain UI             │
│  Display: "alice.eth"       │
│  Trust: Verified on Arb     │
└─────────────────────────────┘
```

## Next Steps

1. ✅ **Backend Ready**: Built and tested locally
2. ✅ **Docker Ready**: Image builds successfully
3. ✅ **Config Ready**: `rofl.yaml` configured
4. ⏳ **Deploy to Oasis**: Follow quickstart guide
5. ⏳ **Update Frontend**: Set backend URL
6. ⏳ **Test Integration**: Verify end-to-end flow
7. ⏳ **Production**: Migrate to mainnet

## Troubleshooting

### Docker Build Issues
```bash
cd backend
pnpm install
pnpm build
docker build -t ads-backend:test .
```

### Oasis CLI Issues
```bash
# Reinstall CLI
npm uninstall -g @oasisprotocol/cli
npm install -g @oasisprotocol/cli

# Verify installation
oasis version
```

### Private Key Generation
```bash
# Generate secure private key
openssl rand -hex 32 | xargs -I {} echo "0x{}"
```

## Resources

- **Oasis ROFL Docs**: https://docs.oasis.io/build/rofl
- **Oasis CLI Reference**: https://docs.oasis.io/build/rofl/cli
- **Arbitrum Docs**: https://docs.arbitrum.io
- **ENS Docs**: https://docs.ens.domains
- **World ID Docs**: https://docs.worldcoin.org

## Support

- **Oasis Discord**: https://oasis.io/discord
- **GitHub Issues**: Create issue in your repo
- **Documentation**: See all MD files in project root

---

## 🎉 You're Ready!

Your ADS Platform is now ready for TEE deployment. The backend will run in a verifiable Trusted Execution Environment with cryptographic attestation, and your users can see how identity from Arbitrum carries over to World Chain.

**Deployment time**: ~10 minutes
**Cost**: ~100 TEST tokens
**Result**: Production-ready decentralized advertising platform with cross-chain trust

Run `./deploy-oasis.sh` to begin! 🚀
