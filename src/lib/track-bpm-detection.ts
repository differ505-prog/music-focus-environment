'use client';

import { analyzeAudioBufferForBpm } from "@/lib/bpm-analyzer";

type TrackBpmDetectionOptions = {
  metadataBpm?: number;
  allowedBpms?: readonly number[];
};

function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };

  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

export async function detectTrackBpmFromUrl(
  audioUrl: string,
  laneOptions: readonly number[],
  options: TrackBpmDetectionOptions = {},
) {
  const AudioContextConstructor = getAudioContextConstructor();

  if (!AudioContextConstructor) {
    throw new Error("目前環境不支援 BPM 偵測");
  }

  const audioContext = new AudioContextConstructor();

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume().catch(() => {});
    }

    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error("音檔載入失敗");
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    return analyzeAudioBufferForBpm(audioBuffer, laneOptions, options);
  } finally {
    void audioContext.close().catch(() => {});
  }
}
