'use client';
import { RefreshCw } from 'lucide-react';

interface Props {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  threshold: number;
}

export default function PullToRefresh({ isPulling, isRefreshing, pullDistance, threshold }: Props) {
  if (!isPulling && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const translateY = isRefreshing ? 72 : Math.min(pullDistance * 0.5 + 16, 72);
  const ready = progress >= 1;

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        top: 64,
        transform: `translateY(${translateY}px)`,
        transition: isRefreshing || !isPulling ? 'transform 0.25s ease' : undefined,
      }}
    >
      <div className={`rounded-full p-3 shadow-lg border transition-colors ${
        ready
          ? 'bg-[#FF3A5F] border-[#FF3A5F]'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <RefreshCw
          className={`w-5 h-5 transition-colors ${
            ready ? 'text-white' : 'text-[#FF3A5F]'
          } ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 270}deg)`,
            transition: isRefreshing ? undefined : 'transform 0.1s ease',
          }}
        />
      </div>
    </div>
  );
}
