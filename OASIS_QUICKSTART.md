# Oasis ROFL Deployment - Quick Start

Deploy the ADS Platform signing backend to Oasis ROFL TEE in under 10 minutes.

## Prerequisites

```bash
# Install Oasis CLI
npm install -g @oasisprotocol/cli

# Get testnet tokens (~150 TEST)
# Visit: https://faucet.testnet.oasis.io

# Verify installation
oasis version
```

## Step 1: Build and Push Docker Image

```bash
cd backend

# Build image
docker build -t YOUR_USERNAME/ads-backend:latest .

# Test locally (optional)
docker run -p 3001:3001 -e SIGNER_PRIVATE_KEY=0xYOUR_KEY YOUR_USERNAME/ads-backend:latest

# Push to Docker Hub
docker login
docker push YOUR_USERNAME/ads-backend:latest
```

## Step 2: Update Configuration

Edit `rofl.yaml` in project root:

```yaml
image: YOUR_USERNAME/ads-backend:latest  # Update this line
```

## Step 3: Register App

```bash
cd ..

# Register on-chain
oasis rofl create \
  --network testnet \
  --name ads-signing-backend \
  --manifest rofl.yaml

# Save the App ID from output!
```

## Step 4: Configure Secrets

```bash
# Set private key (will be encrypted in TEE)
oasis rofl secret set SIGNER_PRIVATE_KEY \
  --app-id 0xYOUR_APP_ID \
  --value "0xYOUR_PRIVATE_KEY" \
  --network testnet
```

## Step 5: Build and Deploy

```bash
# Build deployment bundle
oasis rofl build \
  --manifest rofl.yaml \
  --output ads-backend.orc

# Deploy to ROFL network
oasis rofl deploy ads-backend.orc \
  --network testnet \
  --app-id 0xYOUR_APP_ID
```

Save the endpoint URL from output!

## Step 6: Verify Deployment

```bash
# Check app status
oasis rofl info --app-id 0xYOUR_APP_ID --network testnet

# View logs
oasis rofl logs --app-id 0xYOUR_APP_ID --network testnet --follow

# Test endpoint
curl https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io/health
```

Expected response:
```json
{
  "status": "healthy",
  "signer": "0x...",
  "timestamp": 1234567890,
  "tee": "oasis-rofl"
}
```

## Step 7: Update Frontend

Update `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_API_URL="https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io"
```

Rebuild and redeploy frontend:

```bash
pnpm build
vercel --prod
```

## Automated Deployment

Use the provided script:

```bash
# Set environment variables
export DOCKER_IMAGE="YOUR_USERNAME/ads-backend"
export DOCKER_TAG="latest"
export NETWORK="testnet"

# Run deployment script
chmod +x deploy-oasis.sh
./deploy-oasis.sh
```

The script will guide you through all steps interactively.

## Monitoring

### View Logs

```bash
# Follow logs in real-time
oasis rofl logs --app-id 0xYOUR_APP_ID --network testnet --follow

# Get last 100 lines
oasis rofl logs --app-id 0xYOUR_APP_ID --network testnet --tail 100
```

### Check Status

```bash
# App information
oasis rofl info --app-id 0xYOUR_APP_ID --network testnet

# List all apps
oasis rofl list --network testnet
```

### Test Endpoints

```bash
# Health check
curl https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io/health

# Sign claim (test)
curl -X POST https://ads-backend-0xYOUR_APP_ID.rofl.oasis.io/api/sign-claim \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "cycle": "1",
    "slotIndex": 0
  }'
```

## Update Deployment

To deploy code changes:

```bash
# 1. Rebuild Docker image
cd backend
docker build -t YOUR_USERNAME/ads-backend:v2 .
docker push YOUR_USERNAME/ads-backend:v2

# 2. Update rofl.yaml
# image: YOUR_USERNAME/ads-backend:v2

# 3. Rebuild and redeploy
cd ..
oasis rofl build --manifest rofl.yaml --output ads-backend-v2.orc
oasis rofl deploy ads-backend-v2.orc \
  --app-id 0xYOUR_APP_ID \
  --network testnet
```

## Cost Breakdown

### Testnet
- App registration: ~50 TEST (one-time)
- Deployment: ~50 TEST (one-time)
- Machine rental: ~5 TEST/day (ongoing)
- **Total to get started**: ~100 TEST

### Mainnet (Production)
- Estimated: $20-50/month in ROSE tokens
- Depends on resource usage and uptime

## Troubleshooting

### "Insufficient balance"
- Get more TEST tokens from faucet
- Check balance: `oasis account show`

### "App registration failed"
- Verify you have enough TEST tokens
- Check network is set to `testnet`
- Ensure rofl.yaml is valid

### "Secret not found"
- List secrets: `oasis rofl secret list --app-id 0xYOUR_APP_ID`
- Verify secret name matches rofl.yaml: `SIGNER_PRIVATE_KEY`

### "Health check failing"
- Check Docker image works locally first
- Verify port 3001 is exposed in Dockerfile
- Review logs: `oasis rofl logs`
- Ensure /health endpoint returns 200

### "Signature verification fails"
- Get signer address from health endpoint
- Add to contract's authorizedSigners mapping
- Verify private key is correct

## Production Migration

When ready for mainnet:

1. Deploy contracts to production
2. Update rofl.yaml network to `mainnet`
3. Get ROSE tokens for mainnet
4. Follow same deployment steps with `--network mainnet`
5. Update frontend environment variables
6. Monitor costs and performance

## Resources

- **Oasis ROFL Docs**: https://docs.oasis.io/build/rofl
- **CLI Reference**: https://docs.oasis.io/build/rofl/cli
- **Examples**: https://github.com/oasisprotocol/rofl-examples
- **Support**: Oasis Discord - https://oasis.io/discord

---

**Deployment time**: ~10 minutes
**Cost**: ~100 TEST tokens to start
**Result**: Verifiable TEE backend with cryptographic attestation
