const { createPublicClient, http } = require('viem');
const { worldchain } = require('viem/chains');

const ABI = require('./src/config/ads-abi.json');

const client = createPublicClient({
  chain: worldchain,
  transport: http('https://worldchain-mainnet.g.alchemy.com/public'),
});

const contractAddress = '0xB611e768b880f53C49786BC0f1B97A9291701aaf';

async function verifyContract() {
  console.log('Checking contract at:', contractAddress);
  console.log('');

  // Check if contract exists
  const code = await client.getBytecode({ address: contractAddress });
  console.log('Contract bytecode exists:', code ? 'YES' : 'NO');
  console.log('Bytecode length:', code ? code.length : 0);
  console.log('');

  // Check if ABI has register function
  const registerFunc = ABI.find(item => item.name === 'register' && item.type === 'function');
  console.log('ABI has register function:', registerFunc ? 'YES' : 'NO');
  if (registerFunc) {
    console.log('Register function signature:', registerFunc.inputs.map(i => i.type).join(','));
  }
  console.log('');

  // Try to call registered mapping
  try {
    const testAddress = '0x0000000000000000000000000000000000000001';
    const isRegistered = await client.readContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'registered',
      args: [testAddress],
    });
    console.log('Successfully called registered() function');
    console.log('Test address registered:', isRegistered);
  } catch (error) {
    console.error('Error calling registered():', error.message);
  }
}

verifyContract().catch(console.error);
