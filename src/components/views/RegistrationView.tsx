'use client';

import React, { useState, useEffect } from 'react';
import { Button, Spinner } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, VerificationLevel, MiniAppVerifyActionPayload, ISuccessResult, ResponseEvent } from '@worldcoin/minikit-js';
import { Address, decodeAbiParameters } from 'viem';
import { UserCircle } from 'iconoir-react';
import { useTabs } from '@/providers/TabContext';
import { useSession } from 'next-auth/react';
import { useADSClient } from '@/hooks/useADSClient';
import { CONTRACTS } from '@/config/contracts';
import { ADS_DEMO_ABI } from '@/config/abi';

export function RegistrationView() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');
  const { refreshData } = useTabs();
  const { data: session, status: sessionStatus } = useSession();

  // Following proven pattern - wallet address is stored as user.id
  const walletAddress = session?.user?.id as Address | undefined;
  const client = useADSClient();

  // World ID verification state
  const [isVerified, setIsVerified] = useState(false);
  const [verificationProof, setVerificationProof] = useState<{
    root: string;
    nullifierHash: string;
    proof: string[] | string;
  } | null>(null);

  // Check for cached World ID verification
  useEffect(() => {
    const cacheKey = `worldid_verification_ads-register`;
    const cachedVerification = localStorage.getItem(cacheKey);

    if (cachedVerification) {
      try {
        const parsed = JSON.parse(cachedVerification);
        setVerificationProof(parsed);
        setIsVerified(true);
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    // Check if user already registered
    if (walletAddress) {
      const registered = localStorage.getItem(`ads_registered_${walletAddress}`);
      if (registered === 'true') {
        setIsRegistered(true);
      }
    }
  }, [walletAddress]);

  // Setup World ID verification listener
  useEffect(() => {
    if (!MiniKit.isInstalled() || !walletAddress) return;

    MiniKit.subscribe(
      ResponseEvent.MiniAppVerifyAction,
      async (response: MiniAppVerifyActionPayload) => {
        if (response.status === "error") {
          setMessage('World ID verification failed. Please try again.');
          return;
        }

        const successResponse = response as ISuccessResult;
        const verificationData = {
          root: successResponse.merkle_root,
          nullifierHash: successResponse.nullifier_hash,
          proof: Array.isArray(successResponse.proof) ? successResponse.proof : [successResponse.proof]
        };

        setVerificationProof(verificationData);
        setIsVerified(true);
        setMessage('World ID verification successful! Registering...');

        // Cache the verification
        const cacheKey = `worldid_verification_ads-register`;
        localStorage.setItem(cacheKey, JSON.stringify(verificationData));

        // Automatically proceed with registration
        setTimeout(() => {
          proceedWithRegistration(verificationData);
        }, 1000);
      }
    );

    return () => {
      MiniKit.unsubscribe(ResponseEvent.MiniAppVerifyAction);
    };
  }, [walletAddress]);

  // Check registration status from contract
  const checkRegistration = async () => {
    try {
      setIsLoading(true);

      if (!walletAddress) {
        setIsLoading(false);
        return;
      }

      const registered = await client.readContract({
        address: CONTRACTS.ADS_DEMO,
        abi: ADS_DEMO_ABI,
        functionName: 'isRegistered',
        args: [walletAddress],
      }) as boolean;

      if (registered) {
        setIsRegistered(true);
        localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
      } else {
        setIsRegistered(false);
      }
    } catch (error) {
      console.error('Failed to check registration:', error);
      setIsRegistered(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress && sessionStatus === 'authenticated') {
      checkRegistration();
    } else if (sessionStatus === 'authenticated') {
      console.error('[RegistrationView] Session authenticated but no wallet address');
      setIsLoading(false);
    }
  }, [walletAddress, sessionStatus]);

  // Proceed with registration using verification data
  const proceedWithRegistration = async (verificationData: { root: string; nullifierHash: string; proof: string[] | string; }) => {
    try {
      setIsCreating(true);
      setMessage('Registering with World ID...');

      // Format proof according to World ID docs
      let formattedProof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

      try {
        if (Array.isArray(verificationData.proof)) {
          if (verificationData.proof.length === 1) {
            const unpackedProof = decodeAbiParameters(
              [{ type: 'uint256[8]' }],
              verificationData.proof[0] as `0x${string}`
            )[0];
            formattedProof = unpackedProof;
          } else if (verificationData.proof.length >= 8) {
            const proofArray = verificationData.proof.slice(0, 8).map((p: string) => BigInt(p));
            if (proofArray.length === 8) {
              formattedProof = proofArray as unknown as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
            } else {
              setMessage(`Invalid proof array length: ${proofArray.length}`);
              setIsCreating(false);
              return;
            }
          } else {
            setMessage(`Invalid proof array length: ${verificationData.proof.length}`);
            setIsCreating(false);
            return;
          }
        } else if (typeof verificationData.proof === 'string') {
          const unpackedProof = decodeAbiParameters(
            [{ type: 'uint256[8]' }],
            verificationData.proof as `0x${string}`
          )[0];
          formattedProof = unpackedProof;
        } else {
          setMessage('Invalid proof format');
          setIsCreating(false);
          return;
        }
      } catch (proofError) {
        console.error('Failed to format proof:', proofError);
        setMessage('Invalid proof format');
        setIsCreating(false);
        return;
      }

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [{
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_DEMO_ABI,
          functionName: 'registerUser',
          args: [
            walletAddress, // signal should be the wallet address
            verificationData.root,
            verificationData.nullifierHash,
            formattedProof,
          ],
        }],
      });

      if (finalPayload?.status === 'success') {
        setMessage('Registration successful!');
        if (walletAddress) {
          localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
        }
        setIsRegistered(true);
        refreshData();
        // Refresh data after a short delay
        setTimeout(() => checkRegistration(), 3000);
      } else {
        const errorMessage = (finalPayload as { error?: string })?.error || 'Failed to register';
        if (errorMessage.includes('already registered') || errorMessage.includes('AlreadyRegistered')) {
          setMessage('Already registered! Loading...');
          if (walletAddress) {
            localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
          }
          setIsRegistered(true);
          setTimeout(() => checkRegistration(), 1000);
        } else {
          setMessage(errorMessage);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to register:', error);
      const errorStr = error?.toString() || '';
      if (errorStr.includes('already registered') || errorStr.includes('AlreadyRegistered')) {
        setMessage('Already registered! Loading...');
        setIsRegistered(true);
        if (walletAddress) {
          localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
        }
        setTimeout(() => checkRegistration(), 1000);
      } else {
        setMessage(`Failed to register. Error: ${errorStr}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Register with World ID verification
  const register = async () => {
    if (!MiniKit.isInstalled()) {
      setMessage('Please open this app in World App');
      return;
    }

    if (!isVerified || !verificationProof) {
      setMessage('Please complete World ID verification first');
      startWorldIDVerification();
      return;
    }

    // If already verified, proceed with registration
    await proceedWithRegistration(verificationProof);
  };

  // Start World ID verification for registration
  const startWorldIDVerification = () => {
    if (!MiniKit.isInstalled()) return;

    if (!walletAddress) {
      setMessage('Wallet address not available. Please try again.');
      return;
    }

    setMessage('Please complete World ID verification...');

    const verifyPayload = {
      action: "ads-register",
      signal: walletAddress, // Use wallet address as signal
      verification_level: VerificationLevel.Device, // Use Device for testing
    };

    MiniKit.commands.verify(verifyPayload);
  };

  // Show loading spinner
  if (isLoading || sessionStatus === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-8 h-8" />
        <span className="ml-2 text-sm text-gray-600">
          {sessionStatus === 'loading' ? 'Loading session...' : 'Checking registration...'}
        </span>
      </div>
    );
  }

  // Show registration form if not registered
  if (!isRegistered) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="p-6 bg-white border-2 border-blue-300 rounded-xl shadow-lg">
          <div className="text-center mb-6">
            <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 p-6 flex items-center justify-center">
              <UserCircle className="w-full h-full text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Register with World ID
            </h1>
            <p className="text-sm text-gray-600">
              Verify your humanity to earn rewards by clicking ads
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border-2 border-blue-200">
              <h3 className="font-semibold text-sm mb-2 text-blue-800">🎯 What You Can Do</h3>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Browse and click on ads to earn WLD rewards</li>
                <li>• Claim your accumulated rewards</li>
                <li>• Place your own ads to reach users</li>
                <li>• One verification per person ensures fairness</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border-2 border-purple-200">
              <h3 className="font-semibold text-sm mb-2 text-purple-800">🔒 Privacy Protected</h3>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• World ID proves you're human without revealing identity</li>
                <li>• Zero-knowledge proof protects your privacy</li>
                <li>• No personal information is shared or stored</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={register}
            disabled={isCreating}
            variant="primary"
            className="w-full"
          >
            {isCreating ? (
              <span className="flex items-center justify-center">
                <Spinner className="mr-2 h-4 w-4" />
                Registering...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <UserCircle className="w-4 h-4 mr-2" />
                Verify & Register
              </span>
            )}
          </Button>

          {message && (
            <div className="mt-4 p-2 bg-blue-100 text-blue-700 rounded-lg text-sm text-center">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null; // Once registered, parent component will show main content
}
