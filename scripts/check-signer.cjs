require('dotenv').config({ path: '.env.local' });
const { ethers } = require('ethers');

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS;
  const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
  const rpcUrl = process.env.WORLD_CHAIN_RPC_URL || "https://worldchain-mainnet.g.alchemy.com/public";

  console.log('\n🔍 Checking Authorized Signer Configuration\n');
  console.log('Contract Address:', contractAddress);

  // Get the public address from the private key
  const signerWallet = new ethers.Wallet(signerPrivateKey);
  const signerAddress = signerWallet.address;
  console.log('Expected Signer Address:', signerAddress);

  // Connect to contract
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ['function authorizedSigners(address) view returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);

  // Check if signer is authorized
  const isAuthorized = await contract.authorizedSigners(signerAddress);
  console.log('Is Signer Authorized:', isAuthorized);

  if (!isAuthorized) {
    console.log('\n❌ PROBLEM FOUND: Signer is NOT authorized!');
    console.log('Run: npx hardhat run scripts/add-signer.cjs --network worldchain');
  } else {
    console.log('\n✅ Signer is properly authorized');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
