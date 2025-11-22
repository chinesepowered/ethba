# Deployment Guide

This guide will help you deploy the ADS Platform to World Chain and run it as a World Mini App.

## Prerequisites

1. Node.js 18+ installed
2. pnpm installed (`npm install -g pnpm`)
3. World App installed on your phone
4. Some WLD tokens for deployment

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the required values:

```env
# World Chain Configuration
NEXT_PUBLIC_CHAIN_ID=480
NEXT_PUBLIC_RPC_URL=https://worldchain-mainnet.g.alchemy.com/public

# Contract Addresses (will fill after deployment)
NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS=
NEXT_PUBLIC_WLD_TOKEN_ADDRESS=0x2cFc85d8E48F8EAB294be644d9E25C3030863003

# Backend Signer (generate a new private key)
SIGNER_PRIVATE_KEY=

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### WLD Token Address on World Chain
- **Mainnet**: `0x2cFc85d8E48F8EAB294be644d9E25C3030863003`
- **Testnet**: Check World Chain docs

## Step 3: Deploy Smart Contracts

### Option A: Deploy to World Chain Mainnet

1. Create a deployer wallet and fund it with WLD
2. Update `hardhat.config.cjs` with your deployer private key:

```javascript
module.exports = {
  networks: {
    worldchain: {
      url: "https://worldchain-mainnet.g.alchemy.com/public",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 480,
    },
  },
  // ... rest of config
};
```

3. Create deployment script `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const WLD_TOKEN = "0x2cFc85d8E48F8EAB294be644d9E25C3030863003";
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const WORLD_ID = "0x...", // World ID contract address

  const ADS = await hre.ethers.getContractFactory("ADSDemo");
  const ads = await ADS.deploy(WLD_TOKEN, PERMIT2, WORLD_ID);

  await ads.waitForDeployment();

  console.log("ADS Demo deployed to:", await ads.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

4. Run deployment:

```bash
DEPLOYER_PRIVATE_KEY=your_key pnpm hardhat run scripts/deploy.js --network worldchain
```

5. Copy the deployed contract address to your `.env.local`:

```env
NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS=0x...
```

## Step 4: Generate Backend Signer Key

Generate a new private key for the backend signer (for authorizing clicks):

```bash
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

Add this to `.env.local`:

```env
SIGNER_PRIVATE_KEY=0x...
```

**IMPORTANT**: Never commit this private key to Git! Keep it secure.

## Step 5: Configure the Contract

After deployment, you need to set the backend signer address in the contract:

```javascript
// In hardhat console or via script
const ads = await ethers.getContractAt("ADSDemo", "YOUR_CONTRACT_ADDRESS");
const wallet = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY);
await ads.setBackendSigner(wallet.address);
```

## Step 6: Test Locally

```bash
pnpm dev
```

Visit `http://localhost:3000` in your browser.

## Step 7: Deploy to Production

### Option A: Deploy to Vercel

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_CHAIN_ID`
   - `NEXT_PUBLIC_RPC_URL`
   - `NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_WLD_TOKEN_ADDRESS`
   - `SIGNER_PRIVATE_KEY`
   - `NEXTAUTH_URL` (your production URL)
   - `NEXTAUTH_SECRET`
4. Deploy!

### Option B: Self-host

```bash
pnpm build
pnpm start
```

## Step 8: Register as World Mini App

1. Visit https://developer.worldcoin.org/
2. Create a new Mini App
3. Configure:
   - **Name**: ADS Platform
   - **App ID**: Choose a unique ID
   - **URL**: Your production URL
   - **Icon**: Upload an icon
4. Submit for review

## Step 9: Test in World App

1. Open World App on your phone
2. Go to Mini Apps
3. Search for your app or use the developer test URL
4. Test the full flow:
   - Login with World ID
   - Browse ads
   - Place a bid (requires WLD)
   - Click an ad
   - Claim rewards

## Contract Functions Overview

### For Advertisers
- `placeAdBid()` - Bid WLD for an ad slot using Permit2
- `removeAd()` - Remove your ad and get refund

### For Users
- `recordClick()` - Record clicking an ad (requires backend signature)
- `claimReward()` - Claim proportional share after cycle ends
- `getUserClaimableRewards()` - Check all claimable rewards

### For Admin (Owner)
- `setBackendSigner()` - Set the backend signer address
- `finalizeCycle()` - Finalize completed cycles
- `forceFinalizeCycle()` - (Demo only) Manually advance cycles
- `withdrawFees()` - Withdraw collected platform fees

## Troubleshooting

### "Permit2 signature invalid"
- Make sure your Permit2 object matches the World Mini Apps format (all strings)
- Check that the deadline hasn't expired
- Verify PERMIT2 contract address is correct

### "Signer mismatch"
- Make sure you called `setBackendSigner()` with the correct address
- Verify the SIGNER_PRIVATE_KEY in .env.local matches the configured signer

### "Transaction failed"
- Check you have enough WLD for the bid
- Ensure user has verified with World ID
- Check contract has enough allowance via Permit2

## Security Checklist

- [ ] SIGNER_PRIVATE_KEY is kept secret and not committed to Git
- [ ] Backend endpoints have rate limiting
- [ ] Contract owner key is in a hardware wallet
- [ ] Deployment addresses are verified on block explorer
- [ ] Frontend is served over HTTPS
- [ ] Environment variables are set correctly in production

## Support

For issues:
- Check contract events on block explorer
- Review MiniKit console logs
- Check backend API logs for click authorization errors
- Verify environment variables are set correctly
