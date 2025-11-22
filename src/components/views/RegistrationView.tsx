'use client';

import React, { useState, useEffect } from 'react';
import { Button, Spinner } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit } from '@worldcoin/minikit-js';
import { Address } from 'viem';
import { UserCircle } from 'iconoir-react';
import { useTabs } from '@/providers/TabContext';
import { useSession } from 'next-auth/react';
import { useADSClient } from '@/hooks/useADSClient';
import { CONTRACTS } from '@/config/contracts';
import ADS_ABI from '@/config/ads-abi.json';

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

  // Check cached registration status
  useEffect(() => {
    if (walletAddress) {
      const registered = localStorage.getItem(`ads_registered_${walletAddress}`);
      if (registered === 'true') {
        setIsRegistered(true);
      }
    }
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
        abi: ADS_ABI,
        functionName: 'registered',
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

  // Simple registration without World ID
  const register = async () => {
    if (!MiniKit.isInstalled()) {
      setMessage('Please open this app in World App');
      return;
    }

    try {
      console.log('[RegistrationView] Starting registration...');
      setIsCreating(true);
      setMessage('Registering...');

      // Check if already registered first
      if (walletAddress) {
        const alreadyRegistered = await client.readContract({
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_ABI,
          functionName: 'registered',
          args: [walletAddress],
        }) as boolean;

        if (alreadyRegistered) {
          console.log('[RegistrationView] User already registered on-chain');
          setMessage('Already registered!');
          localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
          setIsRegistered(true);
          setIsCreating(false);
          return;
        }
      }

      console.log('[RegistrationView] Calling register on contract:', CONTRACTS.ADS_DEMO);

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [{
          address: CONTRACTS.ADS_DEMO,
          abi: ADS_ABI,
          functionName: 'register',
          args: [], // No args needed - simple registration
        }],
      });

      console.log('[RegistrationView] Transaction result:', finalPayload);

      if (finalPayload?.status === 'success') {
        setMessage('Registration successful!');
        if (walletAddress) {
          localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
        }
        setIsRegistered(true);
        refreshData();
        setTimeout(() => checkRegistration(), 3000);
      } else {
        console.error('[RegistrationView] Transaction failed:', finalPayload);
        const errorPayload = finalPayload as any;
        const errorMessage = errorPayload?.error || errorPayload?.error_code || 'Failed to register';

        if (errorMessage.includes('already registered') || errorMessage.includes('AlreadyRegistered')) {
          setMessage('Already registered! Loading...');
          if (walletAddress) {
            localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
          }
          setIsRegistered(true);
          setTimeout(() => checkRegistration(), 1000);
        } else {
          setMessage(`Registration failed: ${errorMessage}`);
        }
      }
    } catch (error: unknown) {
      console.error('[RegistrationView] Failed to register:', error);
      const errorStr = error?.toString() || '';
      if (errorStr.includes('already registered') || errorStr.includes('AlreadyRegistered')) {
        setMessage('Already registered! Loading...');
        setIsRegistered(true);
        if (walletAddress) {
          localStorage.setItem(`ads_registered_${walletAddress}`, 'true');
        }
        setTimeout(() => checkRegistration(), 1000);
      } else {
        setMessage(`Failed to register. Error: ${errorStr.substring(0, 150)}`);
      }
    } finally {
      setIsCreating(false);
    }
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
              Register for ADS Platform
            </h1>
            <p className="text-sm text-gray-600">
              Join the decentralized advertising platform
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border-2 border-blue-200">
              <h3 className="font-semibold text-sm mb-2 text-blue-800">🎯 What You Can Do</h3>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Browse and click on ads to earn WLD rewards</li>
                <li>• Claim your accumulated rewards</li>
                <li>• Place your own ads to reach users</li>
                <li>• Participate in fair, transparent advertising</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border-2 border-purple-200">
              <h3 className="font-semibold text-sm mb-2 text-purple-800">⚡ Hackathon Demo</h3>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Simple one-click registration</li>
                <li>• Manual cycle progression for testing</li>
                <li>• Full advertiser and clicker functionality</li>
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
                Register Now
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
