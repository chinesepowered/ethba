const { createPublicClient, http } = require('viem');
const { worldchain } = require('viem/chains');

const client = createPublicClient({
  chain: worldchain,
  transport: http('https://worldchain-mainnet.g.alchemy.com/public'),
});

const contractAddress = '0xB611e768b880f53C49786BC0f1B97A9291701aaf';

async function checkWorldID() {
  console.log('Checking World ID configuration...\n');

  // Read worldId address from contract
  try {
    const worldIdAddress = await client.readContract({
      address: contractAddress,
      abi: [{
        "inputs": [],
        "name": "worldId",
        "outputs": [{"internalType": "contract IWorldID", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
      }],
      functionName: 'worldId',
    });
    console.log('World ID Router address:', worldIdAddress);

    // Expected World ID Router on World Chain
    const expectedWorldId = '0x57f928158C3EE7CDad1e4D8642503c4D0201f611';
    console.log('Expected World ID Router:', expectedWorldId);
    console.log('Match:', worldIdAddress.toLowerCase() === expectedWorldId.toLowerCase() ? 'YES' : 'NO');
    console.log('');

    // Check if World ID Router contract exists
    const worldIdCode = await client.getBytecode({ address: worldIdAddress });
    console.log('World ID Router exists:', worldIdCode ? 'YES' : 'NO');
    console.log('World ID Router bytecode length:', worldIdCode ? worldIdCode.length : 0);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkWorldID().catch(console.error);
