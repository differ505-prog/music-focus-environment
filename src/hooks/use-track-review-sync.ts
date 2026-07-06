'use client';

import { useEffect, useState } from 'react';

import { getTrackReviewStorageEventName } from '@/lib/track-review-store';

export function useTrackReviewSync() {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const eventName = getTrackReviewStorageEventName();
    const refresh = () => setRefreshTick((current) => current + 1);

    window.addEventListener(eventName, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return refreshTick;
}
