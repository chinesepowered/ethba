require('dotenv').config({ path: '.env.local' });
const { ethers } = require('ethers');

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS || '0xb0A9358b2ddAba56b98820527fcC0ACc36F42dCd';
  const rpcUrl = process.env.WORLD_CHAIN_RPC_URL || "https://worldchain-mainnet.g.alchemy.com/public";

  // The address that placed the ad (your World ID wallet)
  const userAddress = '0x8f46Af69d672E4B0f6A24a274d6b3e293b8FA12F';

  console.log('\n🔍 Checking Registration Status\n');
  console.log('Contract:', contractAddress);
  console.log('User Address:', userAddress);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ['function registered(address) view returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);

  const isRegistered = await contract.registered(userAddress);
  console.log('\nRegistered:', isRegistered);

  if (!isRegistered) {
    console.log('\n❌ This address is NOT registered!');
    console.log('You need to register in the app before you can click ads.');
  } else {
    console.log('\n✅ This address IS registered!');
    console.log('The click should work. If it\'s still failing, there might be another issue.');
  }
}

main().catch(console.error);
