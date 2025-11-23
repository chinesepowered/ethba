require('dotenv').config({ path: '.env.local' });
const { ethers } = require('ethers');
const ADS_ABI = require('../artifacts/contracts/ADSDemo.sol/ADSDemo.json').abi;

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS;
  const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const rpcUrl = process.env.WORLD_CHAIN_RPC_URL || "https://worldchain-mainnet.g.alchemy.com/public";

  console.log('\n🧪 Testing recordClick Simulation\n');
  console.log('Contract Address:', contractAddress);

  // Setup provider and wallets
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signerWallet = new ethers.Wallet(signerPrivateKey, provider);
  const userWallet = new ethers.Wallet(deployerPrivateKey, provider);

  console.log('User Address:', userWallet.address);
  console.log('Signer Address:', signerWallet.address);

  // Connect to contract
  const contract = new ethers.Contract(contractAddress, ADS_ABI, userWallet);

  // Check registration
  const isRegistered = await contract.registered(userWallet.address);
  console.log('\n✓ User Registered:', isRegistered);

  // Get current cycle
  const currentCycle = await contract.getCurrentCycle();
  console.log('✓ Current Cycle:', currentCycle.toString());

  // Check if there's a clickable cycle
  if (currentCycle === 0n) {
    console.log('\n⚠️  No clickable cycle yet (still in cycle 0)');
    return;
  }

  const clickableCycle = currentCycle - 1n;
  console.log('✓ Clickable Cycle:', clickableCycle.toString());

  // Get ad slot data
  const slot = await contract.adSlots(clickableCycle, 0);
  console.log('\n📦 Ad Slot Data for cycle', clickableCycle.toString(), 'slot 0:');
  console.log('  Advertiser:', slot[0]);
  console.log('  Name:', slot[1]);
  console.log('  Bid Amount:', ethers.formatEther(slot[4]), 'WLD');
  console.log('  Finalized:', slot[5]);
  console.log('  Removed:', slot[6]);
  console.log('  Total Clicks:', slot[7].toString());

  // Create signature
  const nonce = Date.now();
  const timestamp = Math.floor(Date.now() / 1000);

  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
    [userWallet.address, clickableCycle, 0, nonce, timestamp]
  );

  const signature = await signerWallet.signMessage(ethers.getBytes(messageHash));

  console.log('\n🔐 Signature Info:');
  console.log('  Nonce:', nonce);
  console.log('  Timestamp:', timestamp);
  console.log('  Signature:', signature);

  // Try to call recordClick (static call to simulate)
  console.log('\n🎬 Simulating recordClick...');
  try {
    await contract.recordClick.staticCall(
      clickableCycle,
      0,
      nonce,
      timestamp,
      signature
    );
    console.log('✅ Simulation SUCCESS! The transaction would work.');
  } catch (error) {
    console.log('❌ Simulation FAILED!');
    console.log('Error:', error.message);

    // Try to decode the error
    if (error.data) {
      console.log('Error Data:', error.data);
    }

    // Check specific conditions that might fail
    console.log('\n🔍 Debugging:');

    // Check if already clicked
    const hasClicked = await contract.hasClicked(clickableCycle, 0, userWallet.address);
    console.log('  Has already clicked:', hasClicked);

    // Check if signer is authorized
    const isAuthorized = await contract.authorizedSigners(signerWallet.address);
    console.log('  Signer authorized:', isAuthorized);

    throw error;
  }
}

main().catch((error) => {
  console.error('\n💥 Error:', error.message);
  process.exitCode = 1;
});
