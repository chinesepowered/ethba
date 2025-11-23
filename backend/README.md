# ADS Platform Backend (v2)

Click authorization service for ADS Platform. Verifies targeting criteria and authorizes clicks. Deployed to Oasis ROFL (Trusted Execution Environment).

## Features

- **Targeting Verification**: Verify users meet slot targeting criteria (geo-IP, device type)
- **Click Authorization**: Sign click authorizations for proportional reward distribution
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

# Authorize click (example)
curl -X POST http://localhost:3001/api/authorize-click \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "cycle": "1",
    "slotIndex": 0,
    "slotType": 0
  }'

# Get slot types
curl http://localhost:3001/api/slot-types
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

### POST /api/authorize-click

Authorize a click for proportional reward distribution.

**Request:**
```json
{
  "userAddress": "0x...",
  "cycle": "1",
  "slotIndex": 0,
  "slotType": 0
}
```

**Response:**
```json
{
  "authorized": true,
  "slotType": "GLOBAL",
  "nonce": 1234567890,
  "timestamp": 1234567890,
  "signature": "0x..."
}
```

**Error Response (403):**
```json
{
  "error": "User does not meet targeting criteria",
  "slotType": "US_ONLY"
}
```

### GET /api/slot-types

Get list of available slot types and targeting criteria.

**Response:**
```json
{
  "slotTypes": [
    { "id": 0, "name": "GLOBAL", "description": "Anyone can claim" },
    { "id": 1, "name": "US_ONLY", "description": "US IP addresses only" },
    ...
  ]
}
```

## Targeting Criteria

The backend verifies users meet slot targeting requirements before authorizing clicks:

| Slot Type | Verification |
|-----------|-------------|
| GLOBAL | All users allowed |
| US_ONLY | US IP address required |
| AR_ONLY | Argentina IP address required |
| EU_ONLY | EU IP address required |
| ASIA_ONLY | Asian IP address required |
| MOBILE_ONLY | Mobile device required |
| DESKTOP_ONLY | Desktop device required |
| IOS_ONLY | iOS device required |
| ANDROID_ONLY | Android device required |
| CUSTOM | Custom targeting logic |

## Security

- Private key stored encrypted in Oasis ROFL
- All operations logged for audit trail
- Signature verification prevents reward manipulation
- TEE provides verifiable computation

## License

MIT
