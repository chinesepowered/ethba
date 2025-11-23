#!/bin/bash
# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    npm install --legacy-peer-deps
fi

# Compile contracts
npx hardhat compile --force

# Extract ABI
node -e "
const fs = require('fs');
const artifact = require('./artifacts/contracts/ADSDemo.sol/ADSDemo.json');
fs.writeFileSync('./src/config/ads-abi.json', JSON.stringify(artifact.abi, null, 2));
console.log('✅ ABI updated in src/config/ads-abi.json');
"
