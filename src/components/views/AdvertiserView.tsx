'use client';

import { useState } from 'react';
import { useADSContract } from '@/hooks/useADSContract';
import { Globe, MapPin } from 'iconoir-react';
import { parseEther, formatEther } from 'viem';

interface AdvertiserViewProps {
  userAddress: string;
}

const SLOTS = [
  { id: 0, name: 'Global', description: 'Anyone can click', icon: <Globe className="w-5 h-5" /> },
  { id: 1, name: 'US Only', description: 'US IP addresses only', icon: <MapPin className="w-5 h-5" /> },
  { id: 2, name: 'Argentina Only', description: 'Argentina IP addresses only', icon: <MapPin className="w-5 h-5" /> },
];

export function AdvertiserView({ }: AdvertiserViewProps) {
  const { currentCycle, currentAds, loading, placeAdBid } = useADSContract();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [bidding, setBidding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    bidAmount: '',
  });

  // Debug: Log state for troubleshooting
  console.log('[AdvertiserView] State:', {
    currentCycle: currentCycle?.toString(),
    loading,
    bidding,
    selectedSlot,
    hasFormData: !!formData.bidAmount,
  });

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlot === null || !currentCycle) return;

    setBidding(true);

    try {
      const bidAmount = parseEther(formData.bidAmount);

      await placeAdBid(
        currentCycle,
        BigInt(selectedSlot),
        formData.name,
        formData.description,
        formData.imageUrl,
        bidAmount
      );

      alert('Bid placed successfully!');

      // Reset form
      setFormData({
        name: '',
        description: '',
        imageUrl: '',
        bidAmount: '',
      });
      setSelectedSlot(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to place bid';
      alert(errorMessage);
    } finally {
      setBidding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Advertise Your Product</h2>
        <p className="text-sm text-gray-600">
          Bid WLD for ad slots • Cycle {currentCycle?.toString() || '0'}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2">How Advertising Works</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• Choose a slot type to target specific audiences</li>
          <li>• Place a WLD bid for your chosen slot</li>
          <li>• Your ad runs for the current cycle (24 hours)</li>
          <li>• Users who match your targeting can click your ad</li>
          <li>• Each clicker gets an equal share: (Your Bid - 5% Fee) / Total Clicks</li>
          <li>• Higher bids attract more attention!</li>
        </ul>
      </div>

      {/* Slot Selection */}
      <div>
        <h3 className="font-bold text-gray-900 mb-4">Select Ad Slot</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SLOTS.map((slot) => {
            const currentAd = currentAds[slot.id];
            const hasAd = currentAd?.advertiser !== '0x0000000000000000000000000000000000000000';
            const isSelected = selectedSlot === slot.id;

            return (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                className={`p-5 rounded-xl border-2 transition-all ${isSelected
                  ? 'border-purple-500 bg-purple-50'
                  : hasAd
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-gray-200 hover:border-purple-300'
                  }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`${isSelected ? 'text-purple-600' : 'text-gray-600'}`}>
                    {slot.icon}
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-base mb-1">{slot.name}</p>
                    <p className="text-xs text-gray-600">{slot.description}</p>
                  </div>
                </div>
                {hasAd && currentAd ? (
                  <div className="bg-white rounded-lg p-2 mt-2 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Current Bid</p>
                    <p className="text-sm font-semibold text-purple-600">
                      {formatEther(currentAd.bidAmount)} WLD
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 rounded-lg p-2 mt-2 border border-green-200">
                    <p className="text-xs text-green-700 font-medium">Available</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bid Form */}
      {selectedSlot !== null && (
        <form onSubmit={handleSubmitBid} className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900 text-lg">
            Place Bid for {SLOTS[selectedSlot].name}
          </h3>

          {/* Ad Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ad Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
              placeholder="e.g., Amazing Product"
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
              placeholder="Describe your product or service..."
              rows={3}
              maxLength={500}
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              URL (optional)
            </label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
              placeholder="https://example.com/image.png"
            />
            <p className="text-xs text-gray-600 mt-1">
              Link to image or product page
            </p>
          </div>

          {/* Bid Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bid Amount (WLD) *
            </label>
            <input
              type="number"
              step="0.000001"
              min="0.000001"
              value={formData.bidAmount}
              onChange={(e) => setFormData({ ...formData, bidAmount: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
              placeholder="1.0"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              No minimum bid • Platform fee: 5% • Users receive: 95% split equally
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={bidding || loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bidding ? 'Placing Bid...' : loading ? 'Loading...' : 'Place Bid'}
          </button>

          {/* Debug Info */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Current Cycle: {currentCycle !== null ? currentCycle.toString() : 'Loading...'}</p>
            {loading && <p className="text-blue-600">Loading contract data...</p>}
            {bidding && <p className="text-purple-600">Transaction in progress...</p>}
          </div>
        </form>
      )}
    </div>
  );
}
