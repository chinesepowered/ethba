import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// This should be stored securely in environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '0x...';

// Slot definitions:
// Slot 0: Global (anyone can click)
// Slot 1: US only
// Slot 2: Argentina only

// Check if user is eligible for the slot
function checkEligibility(request: NextRequest, slotIndex: number): { eligible: boolean; reason?: string } {
  // HACKATHON HARDCODED VALUES:
  // - Slot 0 (Global): always pass
  // - Slot 1 (US): always fail (for demo purposes)
  // - Slot 2 (Argentina): always pass

  // In production, you would check actual IP geolocation:
  // const country = request.headers.get('cf-ipcountry') ||
  //                 request.headers.get('x-vercel-ip-country') ||
  //                 'UNKNOWN';

  switch (slotIndex) {
    case 0: // Global
      return { eligible: true };

    case 1: // US only
      // HACKATHON: Always fail for demo
      return { eligible: false, reason: 'This ad is only available in the United States' };

    case 2: // Argentina only
      // HACKATHON: Always pass for demo
      return { eligible: true };

    default:
      return { eligible: false, reason: 'Invalid slot' };
  }
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

    // Validate slot index
    if (slotIndex < 0 || slotIndex > 2) {
      return NextResponse.json(
        { error: 'Invalid slot index (must be 0, 1, or 2)' },
        { status: 400 }
      );
    }

    // Check targeting eligibility
    const { eligible, reason } = checkEligibility(request, slotIndex);
    if (!eligible) {
      return NextResponse.json(
        { error: reason || 'You are not eligible for this ad' },
        { status: 403 }
      );
    }

    // TODO: Add additional validations:
    // - Check if ad exists and is not removed
    // - Check if user has already clicked this ad
    // - Verify cycle is current
    // - Rate limiting per user
    // - Store click record in database

    // Generate nonce and timestamp
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Create message hash matching contract's recordClick function
    // recordClick expects: userAddress, cycle, slotIndex, nonce, timestamp
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, cycle, slotIndex, nonce, timestamp]
    );

    // Sign the message
    const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    return NextResponse.json({
      nonce,
      timestamp,
      signature,
    });
  } catch (error: unknown) {
    console.error('Authorize click error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
