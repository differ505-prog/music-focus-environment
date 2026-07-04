'use client';

import { useEffect, useState } from "react";

import { tracks as baseTracks } from "@/data/music-assets";
import { buildRuntimeTracks, getTrackReviewStorageEventName, readTrackReviewOverrides } from "@/lib/track-review-store";

export function useRuntimeTracks() {
  const [runtimeTracks, setRuntimeTracks] = useState(() => buildRuntimeTracks(baseTracks, readTrackReviewOverrides()));

  useEffect(() => {
    const syncRuntimeTracks = () => {
      setRuntimeTracks(buildRuntimeTracks(baseTracks, readTrackReviewOverrides()));
    };

    syncRuntimeTracks();

    const eventName = getTrackReviewStorageEventName();
    window.addEventListener(eventName, syncRuntimeTracks);
    window.addEventListener("storage", syncRuntimeTracks);

    return () => {
      window.removeEventListener(eventName, syncRuntimeTracks);
      window.removeEventListener("storage", syncRuntimeTracks);
    };
  }, []);

  return runtimeTracks;
}
