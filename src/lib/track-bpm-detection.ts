'use client';

import { analyzeAudioBufferForBpm } from "@/lib/bpm-analyzer";

export async function detectTrackBpmFromUrl(audioUrl: string, laneOptions: readonly number[]) {
  if (typeof window === "undefined" || !window.AudioContext) {
    throw new Error("目前環境不支援 BPM 偵測");
  }

  const audioContext = new window.AudioContext();

  try {
    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error("音檔載入失敗");
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    return analyzeAudioBufferForBpm(audioBuffer, laneOptions);
  } finally {
    void audioContext.close().catch(() => {});
  }
}
