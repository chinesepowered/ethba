'use client';

import { useState, useEffect } from 'react';
import { ArrowDown } from 'iconoir-react';

interface SwapCardProps {
  userBalance: string;
  onSwap: (amount: string) => Promise<void>;
  getEstimate: (amount: string) => Promise<string>;
}

export function SwapCard({ userBalance, onSwap, getEstimate }: SwapCardProps) {
  const [adsAmount, setAdsAmount] = useState('');
  const [wldEstimate, setWldEstimate] = useState('0');
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!adsAmount || parseFloat(adsAmount) <= 0) {
      setWldEstimate('0');
      return;
    }

    let cancelled = false;

    async function fetchEstimate() {
      try {
        const estimate = await getEstimate(adsAmount);
        if (!cancelled) {
          setWldEstimate(estimate);
        }
      } catch (err) {
        console.error('Failed to get estimate:', err);
        if (!cancelled) {
          setWldEstimate('0');
        }
      }
    }

    const timer = setTimeout(fetchEstimate, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [adsAmount, getEstimate]);

  const handleSwap = async () => {
    setError('');

    const amount = parseFloat(adsAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > parseFloat(userBalance)) {
      setError('Insufficient balance');
      return;
    }

    setSwapping(true);
    try {
      await onSwap(adsAmount);
      setAdsAmount('');
      setWldEstimate('0');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Swap failed';
      setError(errorMessage);
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Swap Tokens</h2>

      {/* From - ADS */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          From
        </label>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <input
              type="number"
              value={adsAmount}
              onChange={(e) => setAdsAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-2xl font-semibold outline-none w-full"
              step="0.01"
            />
            <span className="text-lg font-bold text-gray-900">ADS</span>
          </div>
          <p className="text-sm text-gray-500">
            Balance: {parseFloat(userBalance).toFixed(4)} ADS
          </p>
          <button
            onClick={() => setAdsAmount(userBalance)}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold mt-1"
          >
            Max
          </button>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center -my-2">
        <div className="bg-white border-2 border-gray-200 rounded-full p-2">
          <ArrowDown className="w-5 h-5 text-gray-600" />
        </div>
      </div>

      {/* To - WLD */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          To (Estimated)
        </label>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold text-gray-900">
              {parseFloat(wldEstimate).toFixed(6)}
            </span>
            <span className="text-lg font-bold text-gray-900">WLD</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={swapping || !adsAmount || parseFloat(adsAmount) <= 0}
        className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {swapping ? 'Swapping...' : 'Swap'}
      </button>

      {/* Info */}
      <p className="text-xs text-gray-500 text-center mt-4">
        Exchange rate is based on your share of total ADS supply
      </p>
    </div>
  );
}
