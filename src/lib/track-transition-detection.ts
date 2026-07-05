'use client';

type TrackTransitionDetectionOptions = {
  metadataBpm?: number;
  introCueSeconds?: number;
};

export type MixInSuggestionAnalysis = {
  suggestedMixInSeconds: number;
  confidence: number;
  analysisWindowSeconds: number;
  beatAligned: boolean;
  summary: string;
};

function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };

  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMonoPcm(audioBuffer: AudioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleCount = audioBuffer.length;
  const mono = new Float32Array(sampleCount);

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channelData = audioBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      mono[sampleIndex] += channelData[sampleIndex] / channelCount;
    }
  }

  return mono;
}

export function analyzeAudioBufferForMixInSuggestion(
  audioBuffer: AudioBuffer,
  options: TrackTransitionDetectionOptions = {},
): MixInSuggestionAnalysis {
  const mono = buildMonoPcm(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const frameDurationSeconds = 0.05;
  const frameSize = Math.max(1024, Math.floor(sampleRate * frameDurationSeconds));
  const energies: number[] = [];

  for (let frameStart = 0; frameStart < mono.length; frameStart += frameSize) {
    const frameEnd = Math.min(frameStart + frameSize, mono.length);
    let sumSquares = 0;

    for (let sampleIndex = frameStart; sampleIndex < frameEnd; sampleIndex += 1) {
      const value = mono[sampleIndex] ?? 0;
      sumSquares += value * value;
    }

    energies.push(Math.sqrt(sumSquares / Math.max(frameEnd - frameStart, 1)));
  }

  const smoothedEnergies = energies.map((_, index) => {
    const slice = energies.slice(Math.max(index - 2, 0), Math.min(index + 3, energies.length));
    return average(slice);
  });
  const maxEnergy = Math.max(...smoothedEnergies, 0.0001);
  const normalizedEnergies = smoothedEnergies.map((value) => value / maxEnergy);
  const onsetStrength = normalizedEnergies.map((value, index) => Math.max(value - (normalizedEnergies[index - 1] ?? value), 0));
  const beatDurationSeconds = options.metadataBpm ? 60 / options.metadataBpm : null;
  const introCueSeconds = options.introCueSeconds ?? 0.5;
  const trackDurationSeconds = audioBuffer.duration;
  const searchStartSeconds = clamp(introCueSeconds, 0.5, Math.max(trackDurationSeconds - 4, 0.5));
  const searchEndSeconds = clamp(Math.min(trackDurationSeconds * 0.45, 48), searchStartSeconds, Math.max(trackDurationSeconds - 2, searchStartSeconds));
  const analysisWindowSeconds = beatDurationSeconds ? Math.max(beatDurationSeconds * 8, 3) : 4;
  const windowFrameCount = Math.max(4, Math.round(analysisWindowSeconds / frameDurationSeconds));
  let bestCandidate = {
    second: searchStartSeconds,
    score: -1,
    energy: 0,
    onset: 0,
    peakDensity: 0,
  };

  for (
    let frameIndex = Math.floor(searchStartSeconds / frameDurationSeconds);
    frameIndex <= Math.floor(searchEndSeconds / frameDurationSeconds);
    frameIndex += 1
  ) {
    const energySlice = normalizedEnergies.slice(frameIndex, frameIndex + windowFrameCount);
    const onsetSlice = onsetStrength.slice(frameIndex, frameIndex + windowFrameCount);

    if (energySlice.length < windowFrameCount) {
      break;
    }

    const avgEnergy = average(energySlice);
    const avgOnset = average(onsetSlice);
    const peakCount = onsetSlice.filter((value) => value > 0.08).length;
    const peakDensity = peakCount / onsetSlice.length;
    const candidateSecond = frameIndex * frameDurationSeconds;
    const earlyBias = 1 - candidateSecond / Math.max(searchEndSeconds, 1);
    const score = avgEnergy * 0.45 + avgOnset * 0.35 + peakDensity * 0.15 + earlyBias * 0.05;

    if (score > bestCandidate.score) {
      bestCandidate = {
        second: candidateSecond,
        score,
        energy: avgEnergy,
        onset: avgOnset,
        peakDensity,
      };
    }
  }

  let suggestedMixInSeconds = clamp(bestCandidate.second, introCueSeconds, Math.max(trackDurationSeconds - 2, introCueSeconds));
  let beatAligned = false;

  if (beatDurationSeconds && Number.isFinite(beatDurationSeconds) && beatDurationSeconds > 0) {
    const snappedSeconds =
      introCueSeconds + Math.round((suggestedMixInSeconds - introCueSeconds) / beatDurationSeconds) * beatDurationSeconds;
    suggestedMixInSeconds = clamp(Number(snappedSeconds.toFixed(2)), introCueSeconds, Math.max(trackDurationSeconds - 2, introCueSeconds));
    beatAligned = true;
  } else {
    suggestedMixInSeconds = Number(suggestedMixInSeconds.toFixed(2));
  }

  const confidence = clamp(bestCandidate.score / 0.75, 0.2, 0.98);
  const summary =
    confidence >= 0.72
      ? "前段已抓到穩定節拍，可作為建議進點。"
      : confidence >= 0.5
        ? "有抓到節拍區段，但建議人工試聽確認。"
        : "節拍進場不夠明確，建議人工確認。";

  return {
    suggestedMixInSeconds,
    confidence: Number(confidence.toFixed(2)),
    analysisWindowSeconds: Number(Math.min(searchEndSeconds, analysisWindowSeconds).toFixed(2)),
    beatAligned,
    summary,
  };
}

export async function detectTrackMixInSuggestionFromUrl(
  audioUrl: string,
  options: TrackTransitionDetectionOptions = {},
) {
  const AudioContextConstructor = getAudioContextConstructor();

  if (!AudioContextConstructor) {
    throw new Error("目前環境不支援接歌進點分析");
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

    return analyzeAudioBufferForMixInSuggestion(audioBuffer, options);
  } finally {
    void audioContext.close().catch(() => {});
  }
}
