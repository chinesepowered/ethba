import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// This should be stored securely in environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '0x...';

// Slot type enum matching contract
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

// Check if user is eligible for the slot type
function checkEligibility(request: NextRequest, slotType: number): { eligible: boolean; reason?: string } {
  // Get geo-IP from headers
  const country = request.headers.get('cf-ipcountry') ||
                  request.headers.get('x-vercel-ip-country') ||
                  'UNKNOWN';

  // Get device info from user-agent
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(userAgent);
  const isDesktop = !isMobile;

  switch (slotType) {
    case SlotType.GLOBAL:
      return { eligible: true };

    case SlotType.US_ONLY:
      if (country !== 'US') {
        return { eligible: false, reason: 'This ad is only available in the United States' };
      }
      return { eligible: true };

    case SlotType.AR_ONLY:
      if (country !== 'AR') {
        return { eligible: false, reason: 'This ad is only available in Argentina' };
      }
      return { eligible: true };

    case SlotType.EU_ONLY:
      // List of EU country codes
      const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
      if (!euCountries.includes(country)) {
        return { eligible: false, reason: 'This ad is only available in the European Union' };
      }
      return { eligible: true };

    case SlotType.ASIA_ONLY:
      // List of Asian country codes
      const asianCountries = ['CN', 'JP', 'KR', 'IN', 'ID', 'TH', 'VN', 'PH', 'MY', 'SG', 'BD', 'PK', 'TW', 'HK', 'MO'];
      if (!asianCountries.includes(country)) {
        return { eligible: false, reason: 'This ad is only available in Asia' };
      }
      return { eligible: true };

    case SlotType.MOBILE_ONLY:
      if (!isMobile) {
        return { eligible: false, reason: 'This ad is only available on mobile devices' };
      }
      return { eligible: true };

    case SlotType.DESKTOP_ONLY:
      if (!isDesktop) {
        return { eligible: false, reason: 'This ad is only available on desktop devices' };
      }
      return { eligible: true };

    case SlotType.IOS_ONLY:
      if (!isIOS) {
        return { eligible: false, reason: 'This ad is only available on iOS devices' };
      }
      return { eligible: true };

    case SlotType.ANDROID_ONLY:
      if (!isAndroid) {
        return { eligible: false, reason: 'This ad is only available on Android devices' };
      }
      return { eligible: true };

    case SlotType.CUSTOM:
      // Custom targeting would require additional logic
      // For now, allow all
      return { eligible: true };

    default:
      return { eligible: false, reason: 'Unknown slot type' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, cycle, slotIndex, slotType } = body;

    if (!userAddress || cycle === undefined || slotIndex === undefined || slotType === undefined) {
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

    // Check targeting eligibility
    const { eligible, reason } = checkEligibility(request, slotType);
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
