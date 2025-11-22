# Deploying ADS Backend to Oasis ROFL (TEE)

This guide explains how to deploy the claim-signing backend as a **Trusted Execution Environment (TEE)** using Oasis ROFL (Runtime Off-chain Logic).

## Why Oasis ROFL for ADS Platform?

### Benefits of TEE Deployment

1. **Trustless Signature Generation**: Users can verify signatures come from legitimate TEE without trusting a centralized server
2. **Secure Key Storage**: Private key for signing claims is encrypted and isolated in TEE
3. **Verifiable Computation**: Reward calculations (geo-IP, device detection) are provably executed correctly
4. **No Central Point of Failure**: Decentralized deployment across ROFL providers
5. **On-chain Registration**: Backend app is registered on-chain, creating transparency

### Use Case for ADS

The backend currently signs claim transactions with dynamic reward amounts based on:
- Geo-IP location (Argentina vs. other countries)
- Device type (iOS vs. Android)

Running this in a TEE ensures:
- ✅ Signatures are legitimate and verifiable
- ✅ Private key cannot be extracted
- ✅ Reward calculation logic cannot be manipulated
- ✅ Users can audit the deployed code (containerized)

## Architecture Overview

```
┌─────────────────┐
│  World Mini App │
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTP Request
         │ (userAddress, cycle, slotIndex)
         ▼
┌─────────────────────────────────┐
│   Oasis ROFL TEE Container      │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Express API Server      │  │
│  │  POST /api/sign-claim    │  │
│  └──────────┬───────────────┘  │
│             │                   │
│             ▼                   │
│  ┌──────────────────────────┐  │
│  │  Reward Calculator       │  │
│  │  - Geo-IP detection      │  │
│  │  - Device fingerprinting │  │
│  └──────────┬───────────────┘  │
│             │                   │
│             ▼                   │
│  ┌──────────────────────────┐  │
│  │  Ethers.js Signer        │  │
│  │  (Private Key in TEE)    │  │
│  └──────────┬───────────────┘  │
│             │                   │
└─────────────┼───────────────────┘
              │
              │ Signature
              ▼
┌─────────────────────────────┐
│  World Chain                │
│  ADSDemo Contract           │
│  claimReward()              │
└─────────────────────────────┘
```

## Prerequisites

### 1. Install Oasis CLI

```bash
npm install -g @oasisprotocol/cli
# or
curl -fsSL https://get.oasis.io | bash
```

### 2. Get Testnet Tokens

- Request ~150 TEST tokens from [Oasis Testnet Faucet](https://faucet.testnet.oasis.io)
- Needed for: app registration, machine rental, transactions

### 3. Prepare Backend Application

Your backend needs to be:
- ✅ Containerized (Docker image)
- ✅ Published to a public registry (Docker Hub, GHCR, etc.)
- ✅ HTTP server exposing `/api/sign-claim` endpoint

## Step-by-Step Deployment

### Step 1: Create Backend Docker Container

Create a standalone Express server for the signing logic:

**File: `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
```

**File: `backend/src/index.ts`**

```typescript
import express from 'express';
import { ethers } from 'ethers';

const app = express();
app.use(express.json());

// Private key stored as environment variable (set via ROFL secrets)
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY!;
const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);

// Reward calculation logic
function calculateReward(req: express.Request): bigint {
  let reward = ethers.parseUnits('1', 18); // Base: 1 ADS

  // Get geo-IP from headers
  const country = req.headers['cf-ipcountry'] ||
                  req.headers['x-vercel-ip-country'] ||
                  'UNKNOWN';

  // Get device from user-agent
  const userAgent = req.headers['user-agent'] || '';
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

// Health check endpoint (required for ROFL)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Sign claim endpoint
app.post('/api/sign-claim', async (req, res) => {
  try {
    const { userAddress, cycle, slotIndex } = req.body;

    // Validate inputs
    if (!userAddress || cycle === undefined || slotIndex === undefined) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Calculate reward based on request headers
    const rewardAmount = calculateReward(req);

    // Generate nonce and timestamp
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Create message hash (matches contract)
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, rewardAmount.toString(), nonce, timestamp]
    );

    // Sign message
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Log for audit trail in TEE
    console.log(`[CLAIM] user=${userAddress} cycle=${cycle} slot=${slotIndex} reward=${ethers.formatUnits(rewardAmount, 18)} ADS`);

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
  console.log(`ADS Signing Server running on port ${PORT}`);
  console.log(`Signer address: ${wallet.address}`);
});
```

**File: `backend/package.json`**

```json
{
  "name": "ads-signing-backend",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ethers": "^6.15.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Step 2: Build and Publish Docker Image

```bash
cd backend

# Build Docker image
docker build -t <your-dockerhub-username>/ads-backend:latest .

# Test locally
docker run -p 3001:3001 -e SIGNER_PRIVATE_KEY=0x... <your-dockerhub-username>/ads-backend:latest

# Publish to Docker Hub
docker push <your-dockerhub-username>/ads-backend:latest
```

### Step 3: Initialize ROFL Application

Create ROFL configuration:

```bash
# In your project root
oasis rofl init
```

This creates `rofl.yaml`:

```yaml
name: ads-signing-backend
version: 1.0.0

# Docker image from public registry
image: <your-dockerhub-username>/ads-backend:latest

# Resource allocation
resources:
  memory: 512Mi  # 512 MB RAM
  cpu: 1         # 1 CPU core
  storage: 1Gi   # 1 GB persistent storage

# Network configuration
network:
  ports:
    - containerPort: 3001
      protocol: TCP

# Health check
healthCheck:
  path: /health
  port: 3001
  intervalSeconds: 30
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 3

# Environment (secrets managed separately)
env: []
```

### Step 4: Create On-Chain App Registration

Register your app on Oasis Sapphire (testnet):

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

**What this does:**
- Registers your app as an on-chain entity
- Creates verifiable record of app configuration
- Allows users to audit deployed code

### Step 5: Manage Secrets (Private Key)

Store your signer private key securely on-chain:

```bash
# Set private key as encrypted secret
oasis rofl secret set SIGNER_PRIVATE_KEY \
  --app-id 0x1234...5678 \
  --value "0xYOUR_PRIVATE_KEY_HERE" \
  --network testnet
```

**Security:**
- Secret is encrypted on-chain
- Only accessible within TEE
- Cannot be extracted by providers or attackers

Update `rofl.yaml` to reference the secret:

```yaml
env:
  - name: SIGNER_PRIVATE_KEY
    valueFrom:
      secretKeyRef:
        name: SIGNER_PRIVATE_KEY
```

### Step 6: Build Deployment Bundle

Package your application for ROFL:

```bash
oasis rofl build \
  --manifest rofl.yaml \
  --output ads-backend.orc
```

**Output:**
```
✅ Bundle created: ads-backend.orc
📦 Size: 45 MB
🔐 TEE attestation included
```

### Step 7: Deploy to ROFL Infrastructure

Deploy to ROFL provider network:

```bash
oasis rofl deploy ads-backend.orc \
  --network testnet \
  --app-id 0x1234...5678
```

**Output:**
```
🚀 Deploying to ROFL providers...
✅ Deployed successfully
🌐 Endpoint: https://ads-backend-0x1234.rofl.oasis.io
💰 Cost: ~50 TEST tokens + ongoing rental
```

### Step 8: Update Frontend Configuration

Update `.env.local` with your ROFL endpoint:

```bash
NEXT_PUBLIC_BACKEND_API_URL="https://ads-backend-0x1234.rofl.oasis.io"
```

## Verifying TEE Deployment

### 1. Check App Registration

```bash
oasis rofl info --app-id 0x1234...5678 --network testnet
```

Shows:
- App name and version
- Docker image hash
- Resource allocation
- Deployment status
- TEE attestation

### 2. Verify Signer Address

The signer address is logged on startup. Users can verify:

```bash
curl https://ads-backend-0x1234.rofl.oasis.io/health
```

Compare with authorized signer in your smart contract.

### 3. Audit Code

Anyone can:
1. Pull the Docker image: `docker pull <your-dockerhub-username>/ads-backend:latest`
2. Inspect the code
3. Verify image hash matches on-chain registration

## Cost Breakdown

### One-time Costs (Testnet)
- App registration: ~50 TEST
- Initial deployment: ~50 TEST

### Ongoing Costs (Testnet)
- Machine rental: ~5 TEST/day
- Transaction fees: minimal

### Production (Mainnet)
- Estimated: $10-50/month depending on usage
- Paid in ROSE tokens

## Monitoring and Maintenance

### View Logs

```bash
oasis rofl logs --app-id 0x1234...5678 --network testnet
```

Shows:
- Request logs
- Signature generation events
- Error messages

### Update Deployment

To update your code:

```bash
# 1. Build new Docker image
docker build -t <your-dockerhub-username>/ads-backend:v2 .
docker push <your-dockerhub-username>/ads-backend:v2

# 2. Update rofl.yaml
# image: <your-dockerhub-username>/ads-backend:v2

# 3. Rebuild and redeploy
oasis rofl build --manifest rofl.yaml --output ads-backend-v2.orc
oasis rofl deploy ads-backend-v2.orc --app-id 0x1234...5678 --network testnet
```

### Scale Resources

If you need more capacity:

```yaml
resources:
  memory: 1Gi    # Increase to 1 GB
  cpu: 2         # 2 CPU cores
  storage: 2Gi
```

Then rebuild and redeploy.

## Security Considerations

### ✅ What TEE Protects

1. **Private key isolation**: Cannot be extracted from TEE
2. **Code integrity**: Verified via attestation
3. **Execution verification**: Provable computation
4. **Secrets encryption**: On-chain secrets encrypted

### ⚠️ What TEE Doesn't Protect

1. **Input validation**: Still need to validate user requests
2. **Rate limiting**: Implement application-level rate limiting
3. **DDoS protection**: Use additional infrastructure if needed
4. **Logic bugs**: Code correctness is still your responsibility

### Best Practices

1. **Audit logging**: Log all claim signatures for transparency
2. **Rate limiting**: Prevent abuse (max X claims per user per cycle)
3. **Input validation**: Verify addresses, cycle numbers, etc.
4. **Database tracking**: Track click events to prevent claims without clicks
5. **Monitoring**: Set up alerts for unusual activity

## Advantages Over Traditional Deployment

| Aspect | Traditional (Vercel/AWS) | Oasis ROFL TEE |
|--------|-------------------------|----------------|
| **Trust** | Users must trust server | Cryptographically verifiable |
| **Key Security** | Can be compromised | Encrypted in TEE |
| **Transparency** | Opaque backend | On-chain registration |
| **Auditability** | Closed source | Anyone can inspect |
| **Decentralization** | Single provider | Distributed ROFL network |
| **Censorship Resistance** | Can be shut down | Persistent on-chain |

## Troubleshooting

### "App registration failed"
- Check you have enough TEST tokens
- Verify network is set to `testnet`

### "Secret not found"
- Ensure secret was set: `oasis rofl secret list --app-id <id>`
- Verify `valueFrom.secretKeyRef.name` matches

### "Health check failing"
- Verify `/health` endpoint returns 200
- Check port configuration (3001)
- Review logs: `oasis rofl logs`

### "Signature verification fails on contract"
- Ensure signer address matches contract's `authorizedSigners`
- Verify message hash format matches contract
- Check private key is correct

## Next Steps

1. **Deploy to Testnet**: Follow steps above
2. **Test Integration**: Verify frontend can call ROFL backend
3. **Monitor Performance**: Check logs and response times
4. **Production Migration**: Deploy to mainnet when ready
5. **Add Features**:
   - Click tracking database
   - Rate limiting
   - Analytics dashboard
   - Multi-signer support

## Resources

- [Oasis ROFL Docs](https://docs.oasis.io/build/rofl)
- [Oasis CLI Reference](https://docs.oasis.io/build/rofl/cli)
- [TEE Security Model](https://docs.oasis.io/build/rofl/security)
- [Example Apps](https://github.com/oasisprotocol/rofl-examples)

---

**Summary:** Deploying to Oasis ROFL transforms your backend from a trusted server into a **verifiable, decentralized TEE** that users can audit and trust without relying on centralized infrastructure. Perfect for a hackathon project showcasing cutting-edge Web3 security!
