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

// Slot type enum (matches contract)
enum SlotType {
  GLOBAL = 0,
  US_ONLY = 1,
  AR_ONLY = 2,
  EU_ONLY = 3,
  ASIA_ONLY = 4,
  MOBILE_ONLY = 5,
  DESKTOP_ONLY = 6,
  IOS_ONLY = 7,
  ANDROID_ONLY = 8,
  CUSTOM = 9,
}

interface ClickRequest {
  userAddress: string;
  cycle: string;
  slotIndex: number;
  slotType: SlotType;
}

/**
 * Verify user meets slot targeting criteria
 */
function verifyTargeting(req: express.Request, slotType: SlotType): boolean {
  // Get geo-IP from headers
  const country = (req.headers['cf-ipcountry'] as string) ||
                  (req.headers['x-vercel-ip-country'] as string) ||
                  'UNKNOWN';

  // Get device from user-agent
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  const isDesktop = !isMobile;

  // Get continent (simplified - in production use proper geo-IP service)
  const EU_COUNTRIES = ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'NO', 'FI', 'PL', 'PT', 'GR', 'CZ', 'HU', 'IE'];
  const ASIA_COUNTRIES = ['JP', 'CN', 'KR', 'IN', 'SG', 'TH', 'VN', 'ID', 'MY', 'PH', 'TW', 'HK'];

  console.log(`[TARGETING] Country: ${country}, UserAgent: ${userAgent.substring(0, 50)}...`);

  switch (slotType) {
    case SlotType.GLOBAL:
      return true; // Anyone can click

    case SlotType.US_ONLY:
      return country === 'US';

    case SlotType.AR_ONLY:
      return country === 'AR';

    case SlotType.EU_ONLY:
      return EU_COUNTRIES.includes(country);

    case SlotType.ASIA_ONLY:
      return ASIA_COUNTRIES.includes(country);

    case SlotType.MOBILE_ONLY:
      return isMobile;

    case SlotType.DESKTOP_ONLY:
      return isDesktop;

    case SlotType.IOS_ONLY:
      return isIOS;

    case SlotType.ANDROID_ONLY:
      return isAndroid;

    case SlotType.CUSTOM:
      // Future: implement custom targeting logic
      return true;

    default:
      return false;
  }
}

/**
 * Get human-readable slot type name
 */
function getSlotTypeName(slotType: SlotType): string {
  return SlotType[slotType] || 'UNKNOWN';
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
    endpoints: {
      health: '/health',
      authorizeClick: '/api/authorize-click',
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
    const { userAddress, cycle, slotIndex, slotType } = req.body as ClickRequest;

    // Validate inputs
    if (!userAddress || cycle === undefined || slotIndex === undefined || slotType === undefined) {
      console.warn('[AUTHORIZE-CLICK] Missing parameters:', req.body);
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!ethers.isAddress(userAddress)) {
      console.warn('[AUTHORIZE-CLICK] Invalid address:', userAddress);
      return res.status(400).json({ error: 'Invalid address' });
    }

    if (slotIndex < 0 || slotIndex >= 10) {
      return res.status(400).json({ error: 'Invalid slot index' });
    }

    // Verify targeting criteria
    const meetsTargeting = verifyTargeting(req, slotType);

    if (!meetsTargeting) {
      const slotTypeName = getSlotTypeName(slotType);
      console.warn(`[AUTHORIZE-CLICK] User ${userAddress.slice(0, 8)}... does not meet targeting criteria for ${slotTypeName}`);
      return res.status(403).json({
        error: 'User does not meet targeting criteria',
        slotType: slotTypeName,
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
    const slotTypeName = getSlotTypeName(slotType);
    console.log(`[CLICK AUTHORIZED] user=${userAddress.slice(0, 8)}... cycle=${cycle} slot=${slotIndex} type=${slotTypeName}`);

    // Return authorization
    return res.json({
      authorized: true,
      slotType: slotTypeName,
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
 * Get targeting info for a slot type (helper endpoint)
 */
app.get('/api/slot-types', (_req, res) => {
  return res.json({
    slotTypes: [
      { id: SlotType.GLOBAL, name: 'GLOBAL', description: 'Anyone can claim' },
      { id: SlotType.US_ONLY, name: 'US_ONLY', description: 'US IP addresses only' },
      { id: SlotType.AR_ONLY, name: 'AR_ONLY', description: 'Argentina IP addresses only' },
      { id: SlotType.EU_ONLY, name: 'EU_ONLY', description: 'EU IP addresses only' },
      { id: SlotType.ASIA_ONLY, name: 'ASIA_ONLY', description: 'Asia IP addresses only' },
      { id: SlotType.MOBILE_ONLY, name: 'MOBILE_ONLY', description: 'Mobile devices only' },
      { id: SlotType.DESKTOP_ONLY, name: 'DESKTOP_ONLY', description: 'Desktop devices only' },
      { id: SlotType.IOS_ONLY, name: 'IOS_ONLY', description: 'iOS devices only' },
      { id: SlotType.ANDROID_ONLY, name: 'ANDROID_ONLY', description: 'Android devices only' },
      { id: SlotType.CUSTOM, name: 'CUSTOM', description: 'Custom targeting' },
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
