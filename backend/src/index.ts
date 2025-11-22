import express from 'express';
import { ethers } from 'ethers';
import cors from 'cors';

const app = express();

// Middleware
app.use(express.json());
app.use(cors()); // Allow cross-origin requests from frontend

// Private key from environment (securely stored in Oasis ROFL)
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;

if (!SIGNER_PRIVATE_KEY) {
  console.error('ERROR: SIGNER_PRIVATE_KEY not set in environment');
  process.exit(1);
}

const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);

console.log('='.repeat(60));
console.log('ADS Platform - Signing Backend (Oasis ROFL TEE)');
console.log('='.repeat(60));
console.log(`Signer Address: ${wallet.address}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('='.repeat(60));

/**
 * Calculate reward based on geo-IP and device
 *
 * Reward Rules:
 * - Base: 1 ADS for Argentina + Android
 * - 2 ADS for non-Argentina + Android
 * - +1 ADS bonus for iOS devices
 */
function calculateReward(req: express.Request): bigint {
  let reward = ethers.parseUnits('1', 18); // Base: 1 ADS

  // Get geo-IP from headers (Cloudflare or Vercel)
  const country = req.headers['cf-ipcountry'] as string ||
                  req.headers['x-vercel-ip-country'] as string ||
                  'UNKNOWN';

  // Get device from user-agent
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);

  // Non-Argentina: 2 ADS
  if (country !== 'AR') {
    reward = ethers.parseUnits('2', 18);
  }

  // iOS bonus: +1 ADS
  if (isIOS) {
    reward += ethers.parseUnits('1', 18);
  }

  console.log(`[REWARD CALC] Country: ${country}, iOS: ${isIOS}, Reward: ${ethers.formatUnits(reward, 18)} ADS`);

  return reward;
}

/**
 * Health check endpoint (required for Oasis ROFL)
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    signer: wallet.address,
    timestamp: Date.now(),
    tee: 'oasis-rofl',
  });
});

/**
 * Root endpoint
 */
app.get('/', (_req, res) => {
  res.json({
    name: 'ADS Platform Signing Backend',
    version: '1.0.0',
    tee: 'Oasis ROFL',
    signer: wallet.address,
    endpoints: {
      health: '/health',
      signClaim: '/api/sign-claim',
    },
  });
});

/**
 * Sign claim endpoint
 *
 * Frontend requests a signature for claiming rewards.
 * Backend calculates reward based on geo-IP and device,
 * then signs the claim to prevent manipulation.
 */
app.post('/api/sign-claim', async (req, res) => {
  try {
    const { userAddress, cycle, slotIndex } = req.body;

    // Validate inputs
    if (!userAddress || cycle === undefined || slotIndex === undefined) {
      console.warn('[SIGN-CLAIM] Missing parameters:', req.body);
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!ethers.isAddress(userAddress)) {
      console.warn('[SIGN-CLAIM] Invalid address:', userAddress);
      return res.status(400).json({ error: 'Invalid address' });
    }

    // TODO: Production enhancements:
    // - Check if ad exists and is not removed (query contract)
    // - Check if user has already claimed (query contract)
    // - Track click events in database
    // - Rate limiting per user
    // - Validate cycle is finalized

    // Calculate reward based on request headers
    const rewardAmount = calculateReward(req);

    // Generate nonce and timestamp
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Create message hash (must match contract's claimReward function)
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, rewardAmount.toString(), nonce, timestamp]
    );

    // Sign message
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Log for audit trail (visible in TEE logs)
    console.log(`[CLAIM] user=${userAddress.slice(0, 8)}... cycle=${cycle} slot=${slotIndex} reward=${ethers.formatUnits(rewardAmount, 18)} ADS`);

    // Return signed claim
    return res.json({
      rewardAmount: rewardAmount.toString(),
      nonce,
      timestamp,
      signature,
    });
  } catch (error: any) {
    console.error('[SIGN-CLAIM ERROR]', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Catch-all for undefined routes
 */
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ ADS Signing Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Signer address: ${wallet.address}`);
  console.log(`\nRunning in Oasis ROFL TEE - All operations are verifiable\n`);
});
