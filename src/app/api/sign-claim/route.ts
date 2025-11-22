import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// This should be stored securely in environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '0x...';

// Reward calculation logic based on geo-IP and device
function calculateReward(request: NextRequest): bigint {
  // Base reward: 1 ADS token
  let reward = ethers.parseUnits('1', 18);

  // Get geo-IP from headers (you would use a geo-IP service in production)
  const country = request.headers.get('cf-ipcountry') ||
                  request.headers.get('x-vercel-ip-country') ||
                  'UNKNOWN';

  // Get device info from user-agent
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);

  // Argentina + Android: 1 ADS
  // Other countries + Android: 2 ADS
  // +1 ADS bonus for iOS devices

  if (country !== 'AR') {
    reward = ethers.parseUnits('2', 18); // 2 ADS for non-Argentina
  }

  if (isIOS) {
    reward += ethers.parseUnits('1', 18); // +1 ADS for iOS
  }

  return reward;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, cycle, slotIndex } = body;

    if (!userAddress || cycle === undefined || slotIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address' },
        { status: 400 }
      );
    }

    // TODO: Add additional validations:
    // - Check if ad exists and is not removed
    // - Check if user has already claimed
    // - Verify user actually clicked the ad (track in database)
    // - Rate limiting

    // Calculate reward based on geo-IP and device
    const rewardAmount = calculateReward(request);

    // Generate nonce and timestamp
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Create message hash matching contract's claimReward function
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, rewardAmount.toString(), nonce, timestamp]
    );

    // Sign the message
    const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    return NextResponse.json({
      rewardAmount: rewardAmount.toString(),
      nonce,
      timestamp,
      signature,
    });
  } catch (error: unknown) {
    console.error('Sign claim error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
