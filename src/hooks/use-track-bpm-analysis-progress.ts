'use client';

import { useEffect, useState } from "react";

const EVENT_NAME = "track-bpm-analysis-progress";

export type BpmSegmentProgressEvent = {
  trackId: string;
  segmentIndex: number;
  totalSegments: number;
  currentBpm: number | null;
  rawBpm: number | null;
  confidence: number | null;
  isComplete: boolean;
};

type ProgressState = BpmSegmentProgressEvent | null;

/** Subscribes to the broadcast event dispatched by global-player during multi-segment analysis. */
export function useTrackBpmAnalysisProgress(trackId: string | undefined) {
  const [progress, setProgress] = useState<ProgressState>(null);

  useEffect(() => {
    if (!trackId) {
      setProgress(null);
      return;
    }

    const handler = (event: Event) => {
      const payload = (event as CustomEvent<BpmSegmentProgressEvent>).detail;
      if (payload.trackId === trackId) {
        setProgress(payload);
      }
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [trackId]);

  const isAnalyzing = progress != null && !progress.isComplete;
  return { progress, isAnalyzing };
}
