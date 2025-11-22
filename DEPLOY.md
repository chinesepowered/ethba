# Deployment Guide

Complete guide to deploying the ADS Platform to production or testing environments.

## Prerequisites

### Required Tools
- Node.js 20+
- pnpm package manager
- Git
- Docker (for TEE deployment)
- World App (mobile)

### Required Accounts
- World ID Developer Portal account
- Alchemy or similar RPC provider (optional)
- Docker Hub account (for TEE deployment)
- Vercel account (for frontend hosting)

### Required Tokens
- WLD tokens on World Chain (for testing contracts)
- ETH on World Chain (for gas fees)
- ROSE tokens (for Oasis ROFL deployment - optional)

## Part 1: Environment Setup

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd ethba
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create `.env.local` from template:

```bash
# Authentication
AUTH_SECRET=""  # Generate with: npx auth secret
HMAC_SECRET_KEY=""  # Generate with: openssl rand -base64 32

# World ID Configuration
NEXT_PUBLIC_APP_ID="app_staging_xxx"  # From World ID Developer Portal
NEXT_PUBLIC_WLD_ACTION="verify-human"
AUTH_URL=""  # Your production URL (or ngrok for testing)

# Contract Addresses (fill in after deployment)
NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_WLD_TOKEN_ADDRESS="0x..."

# Backend API
NEXT_PUBLIC_BACKEND_API_URL="http://localhost:3001"  # or ROFL endpoint

# World Chain Configuration
NEXT_PUBLIC_CHAIN_ID="480"
NEXT_PUBLIC_RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"

# Backend Signer Private Key
SIGNER_PRIVATE_KEY="0x..."  # Generate with: openssl rand -hex 32 | xargs -I {} echo "0x{}"
```

### 4. Generate Secrets

```bash
# Generate AUTH_SECRET
npx auth secret

# Generate HMAC_SECRET_KEY
openssl rand -base64 32

# Generate SIGNER_PRIVATE_KEY
openssl rand -hex 32 | xargs -I {} echo "0x{}"
```

Save these values to `.env.local`.

## Part 2: World ID Setup

### 1. Create World ID App

1. Visit [World ID Developer Portal](https://developer.worldcoin.org)
2. Create a new app
3. Choose:
   - **Staging** for testing
   - **Production** for mainnet

### 2. Configure Action

1. Navigate to "Actions" in your app
2. Create new action:
   - **Action ID**: `verify-human`
   - **Type**: Incognito Action
   - **Description**: "User registration for ADS Platform"

3. Copy the **App ID** to `NEXT_PUBLIC_APP_ID` in `.env.local`

### 3. Configure Mini App (Optional)

If deploying as World Mini App:

1. Navigate to "Mini Apps" section
2. Add manifest URL (your domain + `/mini-app.json`)
3. Set app icon and metadata

## Part 3: Smart Contract Deployment

### Option A: Deploy Demo Contract (Recommended for Testing)

The demo contract has 1-minute cycles and seeding functions.

**Deploy Script:**

```solidity
// scripts/deploy-demo.js
import { ethers } from "hardhat";

async function main() {
  // Get WLD token address on World Chain
  const WLD_TOKEN = "0x...";  // World Token address

  // Get World ID App ID (convert to uint256)
  const APP_ID = "app_staging_xxx";

  // Get World ID action (convert to uint256)
  const ACTION_ID = "verify-human";

  // Deploy contract
  const ADSDemo = await ethers.getContractFactory("ADSDemo");
  const adsDemo = await ADSDemo.deploy(
    WLD_TOKEN,
    APP_ID,
    ACTION_ID
  );

  await adsDemo.deployed();

  console.log("ADSDemo deployed to:", adsDemo.address);

  // Deployer automatically receives 5 ADS tokens
  const balance = await adsDemo.balanceOf(deployer.address);
  console.log("Deployer ADS balance:", ethers.utils.formatEther(balance));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Deploy Command:**

```bash
npx hardhat run scripts/deploy-demo.js --network worldchain
```

**After Deployment:**
1. Copy contract address to `NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS`
2. Verify contract on World Chain explorer
3. Add signer address to `authorizedSigners` mapping

### Option B: Deploy Production Contract

Production contract has daily cycles and orb verification.

Same deployment process but use `ADS.sol` instead of `ADSDemo.sol`.

### Verify Contract

```bash
npx hardhat verify --network worldchain <CONTRACT_ADDRESS> <WLD_TOKEN> <APP_ID> <ACTION_ID>
```

### Configure Authorized Signer

The signer address (from `SIGNER_PRIVATE_KEY`) must be added to the contract:

```bash
# Get signer address
node -e "const ethers = require('ethers'); console.log(new ethers.Wallet('YOUR_PRIVATE_KEY').address);"

# Add to contract (call from owner address)
# Call contract.addAuthorizedSigner(SIGNER_ADDRESS)
```

## Part 4: Frontend Deployment

### Local Development

```bash
pnpm dev
```

Access at `http://localhost:3000`

### Testing with World App (ngrok)

1. Install ngrok:
```bash
npm install -g ngrok
```

2. Start local server:
```bash
pnpm dev
```

3. Expose via ngrok:
```bash
ngrok http 3000
```

4. Update `.env.local`:
```bash
AUTH_URL="https://your-subdomain.ngrok.io"
```

5. Open World App and navigate to your ngrok URL

### Production Deployment (Vercel)

1. **Install Vercel CLI:**
```bash
pnpm install -g vercel
```

2. **Build and Deploy:**
```bash
# Build locally first
pnpm build

# Deploy to Vercel
vercel --prod
```

3. **Configure Environment Variables on Vercel:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add all variables from `.env.local`
   - Redeploy

4. **Update World ID App:**
   - Set `AUTH_URL` to your Vercel domain
   - Update Mini App manifest URL if applicable

## Part 5: Backend Deployment

### Option A: Run Backend in Next.js API Routes (Default)

The default setup runs the backend as Next.js API routes. No additional deployment needed.

**API Routes:**
- `/api/sign-claim` - Signature generation
- `/api/verify-proof` - World ID verification

These are automatically deployed with the frontend.

### Option B: Standalone Backend Server

For higher performance or TEE deployment:

**Create `backend/` directory:**

```
backend/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

**File: `backend/src/index.ts`**

```typescript
import express from 'express';
import { ethers } from 'ethers';

const app = express();
app.use(express.json());

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY!;
const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);

function calculateReward(req: express.Request): bigint {
  let reward = ethers.parseUnits('1', 18);

  const country = req.headers['cf-ipcountry'] ||
                  req.headers['x-vercel-ip-country'] ||
                  'UNKNOWN';
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);

  if (country !== 'AR') {
    reward = ethers.parseUnits('2', 18);
  }

  if (isIOS) {
    reward += ethers.parseUnits('1', 18);
  }

  return reward;
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', signer: wallet.address });
});

app.post('/api/sign-claim', async (req, res) => {
  try {
    const { userAddress, cycle, slotIndex } = req.body;

    if (!userAddress || cycle === undefined || slotIndex === undefined) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const rewardAmount = calculateReward(req);
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, rewardAmount.toString(), nonce, timestamp]
    );

    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    res.json({
      rewardAmount: rewardAmount.toString(),
      nonce,
      timestamp,
      signature,
    });
  } catch (error: any) {
    console.error('Sign claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ADS Backend running on port ${PORT}`);
  console.log(`Signer address: ${wallet.address}`);
});
```

**Deploy to any Node.js hosting:**
- Railway
- Render
- Fly.io
- AWS/GCP/Azure

## Part 6: TEE Deployment (Optional - Oasis ROFL)

For maximum trust and decentralization, deploy the backend to a Trusted Execution Environment.

### Prerequisites

```bash
# Install Oasis CLI
npm install -g @oasisprotocol/cli

# Get testnet tokens
# Visit: https://faucet.testnet.oasis.io
```

### Step 1: Create Docker Image

**File: `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY src ./src
COPY tsconfig.json ./

RUN pnpm build

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Build and Push:**

```bash
cd backend

# Build
docker build -t <your-dockerhub-username>/ads-backend:latest .

# Test locally
docker run -p 3001:3001 -e SIGNER_PRIVATE_KEY=0x... <your-dockerhub-username>/ads-backend:latest

# Push to Docker Hub
docker login
docker push <your-dockerhub-username>/ads-backend:latest
```

### Step 2: Initialize ROFL Application

```bash
cd ..
oasis rofl init
```

**Edit `rofl.yaml`:**

```yaml
name: ads-signing-backend
version: 1.0.0

image: <your-dockerhub-username>/ads-backend:latest

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
  intervalSeconds: 30
  timeoutSeconds: 5

env:
  - name: SIGNER_PRIVATE_KEY
    valueFrom:
      secretKeyRef:
        name: SIGNER_PRIVATE_KEY
```

### Step 3: Register On-Chain

```bash
oasis rofl create \
  --network testnet \
  --name ads-signing-backend \
  --manifest rofl.yaml
```

**Output:**
```
✅ App registered on-chain
📝 App ID: 0x1234...5678
💰 Cost: ~50 TEST tokens
```

### Step 4: Store Private Key

```bash
oasis rofl secret set SIGNER_PRIVATE_KEY \
  --app-id 0x1234...5678 \
  --value "0xYOUR_PRIVATE_KEY_HERE" \
  --network testnet
```

### Step 5: Build & Deploy

```bash
# Build deployment bundle
oasis rofl build \
  --manifest rofl.yaml \
  --output ads-backend.orc

# Deploy to ROFL network
oasis rofl deploy ads-backend.orc \
  --network testnet \
  --app-id 0x1234...5678
```

**Output:**
```
🚀 Deploying to ROFL providers...
✅ Deployed successfully
🌐 Endpoint: https://ads-backend-0x1234.rofl.oasis.io
💰 Cost: ~50 TEST + ongoing rental
```

### Step 6: Update Frontend Config

```bash
# Update .env.local
NEXT_PUBLIC_BACKEND_API_URL="https://ads-backend-0x1234.rofl.oasis.io"
```

### Verify TEE Deployment

```bash
# Check app info
oasis rofl info --app-id 0x1234...5678 --network testnet

# View logs
oasis rofl logs --app-id 0x1234...5678 --network testnet

# Verify signer address
curl https://ads-backend-0x1234.rofl.oasis.io/health
```

## Part 7: Testing & Verification

### Test User Flow

1. **Open World App** on mobile device
2. **Navigate to your deployed URL**
3. **Register with World ID:**
   - Click "Register"
   - Complete verification
   - Confirm on-chain registration

4. **View Ads:**
   - Check current cycle ads display
   - Verify advertiser info (address, ENS name)
   - Check bid amounts

5. **Claim Reward:**
   - Click "Claim Reward" on an ad
   - Verify backend signature request
   - Confirm transaction
   - Check ADS balance increases

6. **Swap Tokens:**
   - Enter ADS amount
   - Check swap estimate
   - Execute swap
   - Verify WLD received

### Test Contract Functions

```bash
# Check current cycle
cast call <CONTRACT_ADDRESS> "getCurrentCycle()" --rpc-url <RPC_URL>

# Check user registration
cast call <CONTRACT_ADDRESS> "isRegistered(address)" <USER_ADDRESS> --rpc-url <RPC_URL>

# Check pool balances
cast call <CONTRACT_ADDRESS> "getPoolBalances()" --rpc-url <RPC_URL>
```

### Demo Setup (ADSDemo Contract Only)

For quick demonstrations, use seeding functions:

```bash
# Seed user registration (bypass World ID)
cast send <CONTRACT_ADDRESS> "seedRegistration(address)" <USER_ADDRESS> --private-key <OWNER_KEY>

# Seed ad slot
cast send <CONTRACT_ADDRESS> "seedAdSlot(uint256,uint256,address,string,string,string,uint256)" \
  <CYCLE> <SLOT_INDEX> <ADVERTISER> "Ad Name" "Description" "https://..." <BID_AMOUNT> \
  --private-key <OWNER_KEY>

# Seed ADS balance
cast send <CONTRACT_ADDRESS> "seedADSBalance(address,uint256)" <USER_ADDRESS> <AMOUNT> --private-key <OWNER_KEY>

# Seed reward pool
cast send <CONTRACT_ADDRESS> "seedRewardPool(uint256)" <WLD_AMOUNT> --private-key <OWNER_KEY>

# Force advance cycle
cast send <CONTRACT_ADDRESS> "forceAdvanceCycle()" --private-key <OWNER_KEY>
```

## Part 8: Monitoring & Maintenance

### Monitor Contract Events

```bash
# Watch for new registrations
cast logs --address <CONTRACT_ADDRESS> --event "UserRegistered(address)" --rpc-url <RPC_URL>

# Watch for claims
cast logs --address <CONTRACT_ADDRESS> --event "RewardClaimed(address,uint256,uint256,uint256)" --rpc-url <RPC_URL>

# Watch for swaps
cast logs --address <CONTRACT_ADDRESS> --event "ADSSwapped(address,uint256,uint256)" --rpc-url <RPC_URL>
```

### Update ROFL Deployment

```bash
# 1. Build new Docker image
docker build -t <username>/ads-backend:v2 .
docker push <username>/ads-backend:v2

# 2. Update rofl.yaml
# image: <username>/ads-backend:v2

# 3. Rebuild and redeploy
oasis rofl build --manifest rofl.yaml --output ads-backend-v2.orc
oasis rofl deploy ads-backend-v2.orc --app-id <APP_ID> --network testnet
```

## Troubleshooting

### "Transaction reverted: NotRegistered"
- User needs to register with World ID first
- Check `isRegistered(address)` on contract
- For demo: use `seedRegistration(address)`

### "Invalid signature"
- Verify signer address matches contract's `authorizedSigners`
- Check message hash format matches contract
- Ensure private key is correct

### "Insufficient pool"
- Reward pool is empty
- For demo: use `seedRewardPool(amount)`
- For production: wait for advertisers to bid

### "World ID verification failed"
- Check App ID matches contract
- Verify action ID is correct
- Ensure user hasn't already verified with this nullifier

### "ENS name not showing"
- Verification may have failed (spoofing prevention)
- ENS name might not be set up properly
- Check browser console for errors

## Production Checklist

- [ ] Contracts deployed and verified
- [ ] Authorized signer configured
- [ ] Environment variables set
- [ ] World ID app configured
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed (API routes or standalone)
- [ ] Optional: TEE deployment complete
- [ ] User flow tested end-to-end
- [ ] Monitoring set up
- [ ] Documentation updated

## Security Checklist

- [ ] Private keys stored securely (never commit)
- [ ] Environment variables not exposed to client
- [ ] Signature verification working correctly
- [ ] Rate limiting configured (production)
- [ ] Input validation on all endpoints
- [ ] Contract ownership transferred to multisig (production)
- [ ] Emergency pause mechanism tested
- [ ] Audit completed (production)

## Cost Estimates

### Testnet/Demo
- Contract deployment: ~$0.50 worth of ETH
- Frontend hosting (Vercel): Free tier
- Backend: Free tier on most platforms
- Oasis ROFL (optional): ~150 TEST tokens

### Production
- Contract deployment: ~$5-10
- Frontend hosting: $0-20/month
- Backend: $10-50/month
- Oasis ROFL (optional): ~$20-50/month in ROSE tokens

## Support Resources

- **World ID Documentation**: https://docs.worldcoin.org/mini-apps
- **Oasis ROFL Docs**: https://docs.oasis.io/build/rofl
- **ENS Documentation**: https://docs.ens.domains
- **Project Technical Docs**: See [PROJECT.md](./PROJECT.md)

---

**Deployment complete!** Your ADS Platform is now live and ready to connect users with advertisers.
