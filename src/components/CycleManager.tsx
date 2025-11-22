'use client';

import { useState } from 'react';
import { useADSContract } from '@/hooks/useADSContract';
import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import { ArrowRight } from 'iconoir-react';

export function CycleManager() {
  const { currentCycle, progressCycle } = useADSContract();
  const [isProgressing, setIsProgressing] = useState(false);

  const handleProgressCycle = async () => {
    try {
      setIsProgressing(true);
      await progressCycle();
    } catch (error) {
      console.error('Failed to progress cycle:', error);
      alert('Failed to progress cycle. Please try again.');
    } finally {
      setIsProgressing(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm opacity-90">Current Cycle</p>
          <p className="text-3xl font-bold">
            #{currentCycle !== null ? currentCycle.toString() : '...'}
          </p>
          <p className="text-xs opacity-75 mt-1">
            Anyone can progress to the next cycle
          </p>
        </div>
        <Button
          onClick={handleProgressCycle}
          disabled={isProgressing || currentCycle === null}
          variant="primary"
          size="md"
          className="bg-white text-blue-600 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
        >
          {isProgressing ? (
            'Progressing...'
          ) : (
            <>
              Next Cycle
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
