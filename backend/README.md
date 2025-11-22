# ADS Platform Backend

Signing service for ADS Platform claim rewards. Deployed to Oasis ROFL (Trusted Execution Environment).

## Features

- **Dynamic Rewards**: Calculate rewards based on geo-IP and device
- **Cryptographic Signing**: Sign claim messages to prevent manipulation
- **TEE Deployment**: Run in Oasis ROFL for verifiable computation
- **Health Checks**: Built-in health endpoint for monitoring

## Local Development

### Install Dependencies

```bash
pnpm install
```

### Run Development Server

```bash
# Set private key
export SIGNER_PRIVATE_KEY="0x..."

# Start server
pnpm dev
```

Server runs at `http://localhost:3001`

### Test Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Sign claim (example)
curl -X POST http://localhost:3001/api/sign-claim \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "cycle": "1",
    "slotIndex": 0
  }'
```

## Docker Deployment

### Build Image

```bash
# Build
docker build -t <your-dockerhub-username>/ads-backend:latest .

# Test locally
docker run -p 3001:3001 -e SIGNER_PRIVATE_KEY=0x... <your-dockerhub-username>/ads-backend:latest

# Push to Docker Hub
docker login
docker push <your-dockerhub-username>/ads-backend:latest
```

## Oasis ROFL Deployment

### Prerequisites

```bash
# Install Oasis CLI
npm install -g @oasisprotocol/cli

# Get testnet tokens (~150 TEST)
# Visit: https://faucet.testnet.oasis.io
```

### Deploy to Oasis

```bash
# 1. Update rofl.yaml with your Docker image
# Edit ../rofl.yaml and set image: your-dockerhub-username/ads-backend:latest

# 2. Register app on-chain
oasis rofl create \
  --network testnet \
  --name ads-signing-backend \
  --manifest ../rofl.yaml

# Note the App ID from output

# 3. Store private key securely
oasis rofl secret set SIGNER_PRIVATE_KEY \
  --app-id 0x<YOUR_APP_ID> \
  --value "0x<YOUR_PRIVATE_KEY>" \
  --network testnet

# 4. Build deployment bundle
oasis rofl build \
  --manifest ../rofl.yaml \
  --output ../ads-backend.orc

# 5. Deploy to ROFL network
oasis rofl deploy ../ads-backend.orc \
  --network testnet \
  --app-id 0x<YOUR_APP_ID>

# Note the endpoint URL from output
```

### Verify Deployment

```bash
# Check app info
oasis rofl info --app-id 0x<YOUR_APP_ID> --network testnet

# View logs
oasis rofl logs --app-id 0x<YOUR_APP_ID> --network testnet

# Test endpoint
curl https://ads-backend-0x<YOUR_APP_ID>.rofl.oasis.io/health
```

## Environment Variables

- `SIGNER_PRIVATE_KEY` (required): Private key for signing claims
- `PORT` (optional): Server port, defaults to 3001
- `NODE_ENV` (optional): Environment, defaults to 'development'

## API Reference

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "signer": "0x...",
  "timestamp": 1234567890,
  "tee": "oasis-rofl"
}
```

### POST /api/sign-claim

Sign a claim for reward.

**Request:**
```json
{
  "userAddress": "0x...",
  "cycle": "1",
  "slotIndex": 0
}
```

**Response:**
```json
{
  "rewardAmount": "1000000000000000000",
  "nonce": 1234567890,
  "timestamp": 1234567890,
  "signature": "0x..."
}
```

## Reward Calculation

| Location | Device | Reward |
|----------|--------|--------|
| Argentina | Android | 1 ADS |
| Other | Android | 2 ADS |
| Argentina | iOS | 2 ADS (1 base + 1 bonus) |
| Other | iOS | 3 ADS (2 base + 1 bonus) |

## Security

- Private key stored encrypted in Oasis ROFL
- All operations logged for audit trail
- Signature verification prevents reward manipulation
- TEE provides verifiable computation

## License

MIT
