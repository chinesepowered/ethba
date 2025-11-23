import express from 'express';
import { ethers } from 'ethers';
import cors from 'cors';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Private key from environment (securely stored in Oasis ROFL)
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;

if (!SIGNER_PRIVATE_KEY) {
  console.error('ERROR: SIGNER_PRIVATE_KEY not set in environment');
  process.exit(1);
}

const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);

console.log('='.repeat(60));
console.log('ADS Platform v2 - Click Authorization Backend (Oasis ROFL TEE)');
console.log('='.repeat(60));
console.log(`Signer Address: ${wallet.address}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('='.repeat(60));

// Slot definitions (matches contract):
// Slot 0: Global (anyone can click)
// Slot 1: US only
// Slot 2: Argentina only

interface ClickRequest {
  userAddress: string;
  cycle: string;
  slotIndex: number;
}

/**
 * Verify user meets slot targeting criteria
 */
function verifyTargeting(_req: express.Request, slotIndex: number): { eligible: boolean; reason?: string } {
  // HACKATHON HARDCODED VALUES:
  // - Slot 0 (Global): always pass
  // - Slot 1 (US): always fail (for demo purposes)
  // - Slot 2 (Argentina): always pass

  // In production, you would check actual IP geolocation:
  // const country = (req.headers['cf-ipcountry'] as string) ||
  //                 (req.headers['x-vercel-ip-country'] as string) ||
  //                 'UNKNOWN';

  console.log(`[TARGETING] Slot ${slotIndex} check`);

  switch (slotIndex) {
    case 0: // Global
      console.log(`[TARGETING] Slot 0 (Global) - PASS`);
      return { eligible: true };

    case 1: // US only
      // HACKATHON: Always fail for demo
      console.log(`[TARGETING] Slot 1 (US Only) - FAIL (hardcoded for demo)`);
      return { eligible: false, reason: 'This ad is only available in the United States' };

    case 2: // Argentina only
      // HACKATHON: Always pass for demo
      console.log(`[TARGETING] Slot 2 (Argentina Only) - PASS (hardcoded for demo)`);
      return { eligible: true };

    default:
      return { eligible: false, reason: 'Invalid slot' };
  }
}

/**
 * Get human-readable slot name
 */
function getSlotName(slotIndex: number): string {
  switch (slotIndex) {
    case 0: return 'Global';
    case 1: return 'US Only';
    case 2: return 'Argentina Only';
    default: return 'Unknown';
  }
}

/**
 * Health check endpoint (required for Oasis ROFL)
 */
app.get('/health', (_req, res) => {
  return res.json({
    status: 'healthy',
    version: '2.0.0',
    signer: wallet.address,
    timestamp: Date.now(),
    tee: 'oasis-rofl',
  });
});

/**
 * Root endpoint
 */
app.get('/', (_req, res) => {
  return res.json({
    name: 'ADS Platform v2 - Click Authorization Backend',
    version: '2.0.0',
    description: 'Verifies targeting criteria and authorizes clicks for proportional reward distribution',
    tee: 'Oasis ROFL',
    signer: wallet.address,
    slots: 3,
    endpoints: {
      health: '/health',
      authorizeClick: '/api/authorize-click',
      slots: '/api/slots',
    },
  });
});

/**
 * Authorize click endpoint
 *
 * Verifies user meets slot targeting criteria and signs authorization.
 * No reward calculation - users claim proportional share after cycle ends.
 */
app.post('/api/authorize-click', async (req, res) => {
  try {
    const { userAddress, cycle, slotIndex } = req.body as ClickRequest;

    // Validate inputs
    if (!userAddress || cycle === undefined || slotIndex === undefined) {
      console.warn('[AUTHORIZE-CLICK] Missing parameters:', req.body);
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!ethers.isAddress(userAddress)) {
      console.warn('[AUTHORIZE-CLICK] Invalid address:', userAddress);
      return res.status(400).json({ error: 'Invalid address' });
    }

    if (slotIndex < 0 || slotIndex > 2) {
      return res.status(400).json({ error: 'Invalid slot index (must be 0, 1, or 2)' });
    }

    // Verify targeting criteria
    const { eligible, reason } = verifyTargeting(req, slotIndex);

    if (!eligible) {
      const slotName = getSlotName(slotIndex);
      console.warn(`[AUTHORIZE-CLICK] User ${userAddress.slice(0, 8)}... does not meet targeting criteria for ${slotName}`);
      return res.status(403).json({
        error: reason || 'User does not meet targeting criteria',
        slotName,
      });
    }

    // TODO: Production enhancements:
    // - Check if ad exists and is not removed (query contract)
    // - Check if user has already clicked (query contract)
    // - Track click events in database for analytics
    // - Rate limiting per user
    // - Validate cycle is current

    // Generate nonce and timestamp
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Create message hash (matches contract's recordClick function)
    // Note: No rewardAmount - users claim proportional share later
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, nonce, timestamp]
    );

    // Sign message
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Log for audit trail (visible in TEE logs)
    const slotName = getSlotName(slotIndex);
    console.log(`[CLICK AUTHORIZED] user=${userAddress.slice(0, 8)}... cycle=${cycle} slot=${slotIndex} (${slotName})`);

    // Return authorization
    return res.json({
      authorized: true,
      slotName,
      nonce,
      timestamp,
      signature,
    });
  } catch (error: any) {
    console.error('[AUTHORIZE-CLICK ERROR]', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Get slot info (helper endpoint)
 */
app.get('/api/slots', (_req, res) => {
  return res.json({
    slots: [
      { id: 0, name: 'Global', description: 'Anyone can click' },
      { id: 1, name: 'US Only', description: 'US IP addresses only' },
      { id: 2, name: 'Argentina Only', description: 'Argentina IP addresses only' },
    ],
  });
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
  console.log(`\n✅ ADS v2 Authorization Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Signer address: ${wallet.address}`);
  console.log(`\nRunning in Oasis ROFL TEE - All click authorizations are verifiable\n`);
});
