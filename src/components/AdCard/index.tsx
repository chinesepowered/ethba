'use client';

import { formatUnits } from 'ethers';
import { useENS } from '@/hooks/useENS';
import { AdSlot } from '@/hooks/useADSContract';
import { User, Check } from 'iconoir-react';

interface AdCardProps {
  ad: AdSlot;
  slotIndex: number;
  canClaim: boolean;
  hasClaimed: boolean;
  onClaim: () => void;
  claiming: boolean;
}

function AdvertiserInfo({ address }: { address: string }) {
  const { ensName, loading } = useENS(address);

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <User className="w-4 h-4" />
      <span className="font-mono">
        {loading ? 'Loading...' : ensName || shortAddress}
      </span>
      {ensName && (
        <span className="text-xs text-gray-400 font-mono">({shortAddress})</span>
      )}
    </div>
  );
}

export function AdCard({
  ad,
  slotIndex,
  canClaim,
  hasClaimed,
  onClaim,
  claiming,
}: AdCardProps) {
  // Check if ad exists by verifying advertiser is not zero address
  const hasAd = ad.advertiser && ad.advertiser !== '0x0000000000000000000000000000000000000000';

  if (!hasAd || ad.removed) {
    return (
      <div className="bg-gray-100 rounded-xl p-6 border border-gray-200">
        <p className="text-gray-500 text-center">Slot {slotIndex + 1}: No ad</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-blue-300 transition-all shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{ad.name}</h3>
          <AdvertiserInfo address={ad.advertiser} />
        </div>
        <div className="bg-blue-50 px-3 py-1 rounded-full">
          <span className="text-xs font-semibold text-blue-700">
            Slot {slotIndex + 1}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-700 mb-4 line-clamp-3">{ad.description}</p>

      {/* Bid Amount */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
        <span>Bid:</span>
        <span className="font-semibold text-gray-900">
          {formatUnits(ad.bidAmount, 18)} WLD
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {canClaim && !hasClaimed && (
          <button
            onClick={onClaim}
            disabled={claiming}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claiming ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {hasClaimed && (
          <div className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg font-semibold">
            <Check className="w-5 h-5" />
            Claimed
          </div>
        )}
      </div>
    </div>
  );
}
