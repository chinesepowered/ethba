# ENS L2 Primary Names Setup Guide for Base Sepolia

## Quick Start

### Option 1: Use the Setup Script (Recommended)

1. **Install dependencies:**
   ```bash
   npm install --save-dev tsx
   ```

2. **Get testnet ETH:**
   - Ethereum Sepolia: https://sepoliafaucet.com/
   - Base Sepolia: https://www.alchemy.com/faucets/base-sepolia

3. **Register an ENS name on Sepolia:**
   - Go to https://sepolia.app.ens.domains
   - Connect wallet and register a name (e.g., `yourname.eth`)

4. **Run the setup script:**
   ```bash
   npx tsx scripts/setup-ens-l2.ts yourname.eth
   ```

   This will:
   - Set Base Sepolia address for your ENS name (on L1)
   - Set reverse record to point to your ENS name (on L2)

### Option 2: Manual Setup via ENS App

#### Step 1: Set L2 Address (on Ethereum Sepolia)
1. Visit https://sepolia.app.ens.domains
2. Connect your wallet (make sure you're on Sepolia network)
3. Search for your ENS name
4. Go to **Records** tab
5. Click **Addresses** → **Add Address**
6. Select **Base Sepolia** from the chain dropdown
7. Enter your wallet address
8. Click **Save** and confirm transaction

#### Step 2: Set Reverse Record (on Base Sepolia)
1. Switch your wallet to **Base Sepolia** network
2. Go to Etherscan: https://sepolia.basescan.org/address/0x00000BeEF055f7934784D6d81b6BC86665630dbA#writeContract
3. Click **Connect to Web3** to connect your wallet
4. Find the `setName` function
5. Enter your ENS name (e.g., `yourname.eth`)
6. Click **Write** and confirm transaction

## Verification

After setup, test your configuration:

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet, baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const baseSepoliaCoinType = BigInt((0x80000000 | 84532) >>> 0);

// Should return your ENS name
const name = await client.getEnsName({
  address: '0xYourAddress',
  coinType: baseSepoliaCoinType,
  universalResolverAddress: '0xc0497E381f536Be9ce14B0dD3817cBcAe57d2F62',
});

console.log('ENS Name:', name); // Should show yourname.eth
```

## Important Notes

⚠️ **Propagation Delay**: The official ENS L2 implementation has a propagation period of **up to 6 hours**. Be patient!

⚠️ **Network Requirements**:
- Step 1 requires ETH on Ethereum Sepolia
- Step 2 requires ETH on Base Sepolia

⚠️ **Name Ownership**: You must own the ENS name on Sepolia testnet before setting it up for L2.

## Contract Addresses Reference

### Ethereum Sepolia (L1)
- **Public Resolver**: `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD`
- **Default Reverse Registrar**: `0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6`
- **Universal Resolver**: `0xc0497E381f536Be9ce14B0dD3817cBcAe57d2F62`

### Base Sepolia (L2)
- **Reverse Registrar**: `0x00000BeEF055f7934784D6d81b6BC86665630dbA`

## Troubleshooting

**"Name not resolving"**
- Wait up to 6 hours for propagation
- Verify both steps completed successfully
- Check transactions on block explorers

**"Transaction failing"**
- Ensure you have enough testnet ETH for gas
- Verify you're on the correct network
- Make sure you own the ENS name

**"Verification failed"**
- Ensure Step 1 completed before Step 2
- Check that addresses match exactly (case-insensitive)
- Verify the ENS name resolves to your address on Base Sepolia cointype

## Resources

- ENS Documentation: https://docs.ens.domains
- ENS Sepolia App: https://sepolia.app.ens.domains
- Base Sepolia Faucet: https://www.alchemy.com/faucets/base-sepolia
- Sepolia Faucet: https://sepoliafaucet.com/
