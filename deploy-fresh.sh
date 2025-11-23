#!/bin/bash
echo "🚀 Deploying fresh contract with fixed code..."
npx hardhat run scripts/deploy.cjs --network worldchain

echo ""
echo "⚠️  IMPORTANT: Copy the new contract address to your .env.local:"
echo "   NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS=<new_address>"
