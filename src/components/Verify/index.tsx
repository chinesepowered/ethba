'use client';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { useState } from 'react';

interface VerifyProps {
  onRegistrationComplete?: () => void;
}

/**
 * Register for ADS platform using World ID
 * After verification, the user is registered on the smart contract
 */
export const Verify = ({ onRegistrationComplete }: VerifyProps) => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  const onClickVerify = async () => {
    setButtonState('pending');

    const action = process.env.NEXT_PUBLIC_WLD_ACTION || 'verify-human';

    const result = await MiniKit.commandsAsync.verify({
      action,
      verification_level: VerificationLevel.Device, // Device verification for demo
    });

    // Verify the proof on backend
    const response = await fetch('/api/verify-proof', {
      method: 'POST',
      body: JSON.stringify({
        payload: result.finalPayload,
        action,
      }),
    });

    const data = await response.json();
    if (data.verifyRes.success) {
      setButtonState('success');

      // TODO: Call smart contract to register user
      // This would require transaction signing via MiniKit

      onRegistrationComplete?.();
    } else {
      setButtonState('failed');

      setTimeout(() => {
        setButtonState(undefined);
      }, 2000);
    }
  };

  return (
    <div className="grid w-full gap-4">
      <p className="text-lg font-semibold">Register with World ID</p>
      <p className="text-sm text-gray-600">
        Verify your humanity to claim ad rewards on the ADS platform
      </p>
      <LiveFeedback
        label={{
          failed: 'Failed to verify',
          pending: 'Verifying...',
          success: 'Verified! You can now claim rewards',
        }}
        state={buttonState}
        className="w-full"
      >
        <Button
          onClick={onClickVerify}
          disabled={buttonState === 'pending'}
          size="lg"
          variant="primary"
          className="w-full"
        >
          Verify with World ID (Device)
        </Button>
      </LiveFeedback>
    </div>
  );
};
