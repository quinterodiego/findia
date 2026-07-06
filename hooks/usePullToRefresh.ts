import { useState, useRef, useCallback, useEffect } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>, threshold = 80) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const canPull = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshingRef.current) {
      startY.current = e.touches[0].clientY;
      canPull.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canPull.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      const clamped = Math.min(delta, threshold * 2);
      setIsPulling(true);
      setPullDistance(clamped);
      pullDistanceRef.current = clamped;
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!canPull.current) return;
    canPull.current = false;

    const distance = pullDistanceRef.current;
    setIsPulling(false);
    setPullDistance(0);
    pullDistanceRef.current = 0;

    if (distance >= threshold) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      try {
        await onRefreshRef.current();
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    }
  }, [threshold]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isPulling, isRefreshing, pullDistance, threshold };
}
