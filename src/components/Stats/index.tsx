'use client';

import { formatUnits } from 'ethers';
import { Coin, Wallet, Database } from 'iconoir-react';

interface StatsProps {
  userBalance: bigint;
  poolBalances: {
    availablePool: bigint;
    locked: bigint;
    fees: bigint;
  } | null;
  userSwapValue?: string;
}

export function Stats({ userBalance, poolBalances, userSwapValue }: StatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {/* User Balance */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="w-6 h-6" />
          <h3 className="text-sm font-medium opacity-90">Your ADS Balance</h3>
        </div>
        <p className="text-3xl font-bold">{formatUnits(userBalance, 18)}</p>
        {userSwapValue && (
          <p className="text-sm opacity-75 mt-1">≈ {userSwapValue} WLD</p>
        )}
      </div>

      {/* Reward Pool */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-6 h-6" />
          <h3 className="text-sm font-medium opacity-90">Reward Pool</h3>
        </div>
        <p className="text-3xl font-bold">
          {poolBalances ? formatUnits(poolBalances.availablePool, 18) : '0'}
        </p>
        <p className="text-sm opacity-75 mt-1">WLD Available</p>
      </div>

      {/* Locked Funds */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Coin className="w-6 h-6" />
          <h3 className="text-sm font-medium opacity-90">Locked Funds</h3>
        </div>
        <p className="text-3xl font-bold">
          {poolBalances ? formatUnits(poolBalances.locked, 18) : '0'}
        </p>
        <p className="text-sm opacity-75 mt-1">WLD Locked</p>
      </div>
    </div>
  );
}
