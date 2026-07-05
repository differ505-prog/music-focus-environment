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

type CandidateMetrics = {
  second: number;
  score: number;
  energy: number;
  onset: number;
  sustainedRhythm: number;
  beatRegularity: number;
  transientMean: number;
  transientCoverage: number;
  qualifies: boolean;
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

function standardDeviation(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function getWindowMax(values: readonly number[], centerIndex: number, radius: number) {
  let maxValue = 0;

  for (let index = Math.max(0, centerIndex - radius); index <= Math.min(values.length - 1, centerIndex + radius); index += 1) {
    maxValue = Math.max(maxValue, values[index] ?? 0);
  }

  return maxValue;
}

function calculateBeatRegularityScore(onsetSlice: readonly number[], beatFrameSpan: number | null) {
  if (!beatFrameSpan || beatFrameSpan < 2 || onsetSlice.length < 4) {
    return 0;
  }

  const roundedBeatFrameSpan = Math.max(2, Math.round(beatFrameSpan));
  const sampleCount = Math.max(4, Math.floor(onsetSlice.length / roundedBeatFrameSpan));
  let bestScore = 0;

  for (let offset = 0; offset < roundedBeatFrameSpan; offset += 1) {
    const pulses: number[] = [];

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const frameIndex = offset + sampleIndex * roundedBeatFrameSpan;

      if (frameIndex >= onsetSlice.length) {
        break;
      }

      pulses.push(getWindowMax(onsetSlice, frameIndex, 1));
    }

    if (pulses.length < 4) {
      continue;
    }

    const pulseMean = average(pulses);
    const pulseCoverage = pulses.filter((value) => value >= 0.045).length / pulses.length;
    const pulseConsistency = clamp(1 - standardDeviation(pulses) / Math.max(pulseMean, 0.001), 0, 1);
    const score = pulseCoverage * 0.65 + pulseConsistency * 0.35;
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

function calculateSustainedRhythmScore(
  onsetSlice: readonly number[],
  energySlice: readonly number[],
  frameDurationSeconds: number,
) {
  const blockFrameCount = Math.max(2, Math.round(0.25 / frameDurationSeconds));
  const blockScores: number[] = [];

  for (let index = 0; index < onsetSlice.length; index += blockFrameCount) {
    const onsetBlock = onsetSlice.slice(index, index + blockFrameCount);
    const energyBlock = energySlice.slice(index, index + blockFrameCount);

    if (onsetBlock.length === 0 || energyBlock.length === 0) {
      continue;
    }

    blockScores.push(average(onsetBlock) * 0.55 + average(energyBlock) * 0.45);
  }

  if (blockScores.length === 0) {
    return 0;
  }

  const threshold = Math.max(average(blockScores) * 0.78, 0.08);
  let longestRun = 0;
  let currentRun = 0;

  for (const blockScore of blockScores) {
    if (blockScore >= threshold) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
      continue;
    }

    currentRun = 0;
  }

  return longestRun / blockScores.length;
}

function qualifiesAsDrumSection(metrics: {
  sustainedRhythm: number;
  beatRegularity: number;
  transientMean: number;
  transientCoverage: number;
  onset: number;
  hasBeatGrid: boolean;
}) {
  const baseQualified =
    metrics.transientMean >= 0.17 &&
    metrics.transientCoverage >= 0.22 &&
    metrics.onset >= 0.02 &&
    metrics.sustainedRhythm >= 0.28;

  if (!baseQualified) {
    return false;
  }

  if (!metrics.hasBeatGrid) {
    return true;
  }

  return metrics.beatRegularity >= 0.52;
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

function buildFrameEnergies(signal: Float32Array, frameSize: number) {
  const energies: number[] = [];

  for (let frameStart = 0; frameStart < signal.length; frameStart += frameSize) {
    const frameEnd = Math.min(frameStart + frameSize, signal.length);
    let sumSquares = 0;

    for (let sampleIndex = frameStart; sampleIndex < frameEnd; sampleIndex += 1) {
      const value = signal[sampleIndex] ?? 0;
      sumSquares += value * value;
    }

    energies.push(Math.sqrt(sumSquares / Math.max(frameEnd - frameStart, 1)));
  }

  return energies;
}

function buildTransientSignal(signal: Float32Array) {
  const transient = new Float32Array(signal.length);

  for (let sampleIndex = 1; sampleIndex < signal.length; sampleIndex += 1) {
    transient[sampleIndex] = Math.abs((signal[sampleIndex] ?? 0) - (signal[sampleIndex - 1] ?? 0));
  }

  return transient;
}

export function analyzeAudioBufferForMixInSuggestion(
  audioBuffer: AudioBuffer,
  options: TrackTransitionDetectionOptions = {},
): MixInSuggestionAnalysis {
  const mono = buildMonoPcm(audioBuffer);
  const transientSignal = buildTransientSignal(mono);
  const sampleRate = audioBuffer.sampleRate;
  const frameDurationSeconds = 0.05;
  const frameSize = Math.max(1024, Math.floor(sampleRate * frameDurationSeconds));
  const energies = buildFrameEnergies(mono, frameSize);
  const transientEnergies = buildFrameEnergies(transientSignal, frameSize);

  const smoothedEnergies = energies.map((_, index) => {
    const slice = energies.slice(Math.max(index - 2, 0), Math.min(index + 3, energies.length));
    return average(slice);
  });
  const smoothedTransientEnergies = transientEnergies.map((_, index) => {
    const slice = transientEnergies.slice(Math.max(index - 1, 0), Math.min(index + 2, transientEnergies.length));
    return average(slice);
  });
  const maxEnergy = Math.max(...smoothedEnergies, 0.0001);
  const maxTransientEnergy = Math.max(...smoothedTransientEnergies, 0.0001);
  const normalizedEnergies = smoothedEnergies.map((value) => value / maxEnergy);
  const normalizedTransientEnergies = smoothedTransientEnergies.map((value) => value / maxTransientEnergy);
  const onsetStrength = normalizedTransientEnergies.map((value, index) =>
    Math.max(value - (normalizedTransientEnergies[index - 1] ?? value), 0),
  );
  const beatDurationSeconds = options.metadataBpm ? 60 / options.metadataBpm : null;
  const beatFrameSpan = beatDurationSeconds ? beatDurationSeconds / frameDurationSeconds : null;
  const introCueSeconds = options.introCueSeconds ?? 0.5;
  const trackDurationSeconds = audioBuffer.duration;
  const searchStartSeconds = clamp(introCueSeconds, 0.5, Math.max(trackDurationSeconds - 4, 0.5));
  const searchEndSeconds = clamp(Math.min(trackDurationSeconds * 0.45, 48), searchStartSeconds, Math.max(trackDurationSeconds - 2, searchStartSeconds));
  const analysisWindowSeconds = beatDurationSeconds ? Math.max(beatDurationSeconds * 8, 3) : 4;
  const windowFrameCount = Math.max(4, Math.round(analysisWindowSeconds / frameDurationSeconds));
  let bestCandidate: CandidateMetrics = {
    second: searchStartSeconds,
    score: -1,
    energy: 0,
    onset: 0,
    sustainedRhythm: 0,
    beatRegularity: 0,
    transientMean: 0,
    transientCoverage: 0,
    qualifies: false,
  };
  let bestQualifiedCandidate: CandidateMetrics | null = null;

  for (
    let frameIndex = Math.floor(searchStartSeconds / frameDurationSeconds);
    frameIndex <= Math.floor(searchEndSeconds / frameDurationSeconds);
    frameIndex += 1
  ) {
    const energySlice = normalizedEnergies.slice(frameIndex, frameIndex + windowFrameCount);
    const transientSlice = normalizedTransientEnergies.slice(frameIndex, frameIndex + windowFrameCount);
    const onsetSlice = onsetStrength.slice(frameIndex, frameIndex + windowFrameCount);

    if (energySlice.length < windowFrameCount) {
      break;
    }

    const avgEnergy = average(energySlice);
    const avgTransient = average(transientSlice);
    const avgOnset = average(onsetSlice);
    const sustainedRhythm = calculateSustainedRhythmScore(onsetSlice, transientSlice, frameDurationSeconds);
    const beatRegularity = calculateBeatRegularityScore(onsetSlice, beatFrameSpan);
    const candidateSecond = frameIndex * frameDurationSeconds;
    const earlyBias = 1 - candidateSecond / Math.max(searchEndSeconds, 1);
    const transientCoverage = transientSlice.filter((value) => value >= 0.16).length / transientSlice.length;
    const qualifies = qualifiesAsDrumSection({
      sustainedRhythm,
      beatRegularity,
      transientMean: avgTransient,
      transientCoverage,
      onset: avgOnset,
      hasBeatGrid: beatFrameSpan != null,
    });
    const weakPulsePenalty = qualifies ? 1 : 0.25;
    const score =
      (sustainedRhythm * 0.34 +
        beatRegularity * 0.28 +
        avgTransient * 0.2 +
        transientCoverage * 0.1 +
        avgOnset * 0.04 +
        avgEnergy * 0.02 +
        earlyBias * 0.02) *
      weakPulsePenalty;

    const candidate: CandidateMetrics = {
      second: candidateSecond,
      score,
      energy: avgEnergy,
      onset: avgOnset,
      sustainedRhythm,
      beatRegularity,
      transientMean: avgTransient,
      transientCoverage,
      qualifies,
    };

    if (
      qualifies &&
      (!bestQualifiedCandidate ||
        score > bestQualifiedCandidate.score ||
        (Math.abs(score - bestQualifiedCandidate.score) < 0.025 && candidateSecond < bestQualifiedCandidate.second))
    ) {
      bestQualifiedCandidate = candidate;
    }

    if (score > bestCandidate.score) {
      bestCandidate = candidate;
    }
  }

  if (bestQualifiedCandidate) {
    bestCandidate = bestQualifiedCandidate;
  }

  if (beatFrameSpan && beatFrameSpan >= 2) {
    const backtrackFrameLimit = Math.max(1, Math.round(beatFrameSpan * 4));
    let bestStartSecond = bestCandidate.second;

    for (let frameIndex = Math.floor(bestCandidate.second / frameDurationSeconds); frameIndex >= 0; frameIndex -= 1) {
      if (Math.floor(bestCandidate.second / frameDurationSeconds) - frameIndex > backtrackFrameLimit) {
        break;
      }

      const energySlice = normalizedEnergies.slice(frameIndex, frameIndex + windowFrameCount);
      const transientSlice = normalizedTransientEnergies.slice(frameIndex, frameIndex + windowFrameCount);
      const onsetSlice = onsetStrength.slice(frameIndex, frameIndex + windowFrameCount);

      if (energySlice.length < windowFrameCount || transientSlice.length < windowFrameCount || onsetSlice.length < windowFrameCount) {
        continue;
      }

      const sustainedRhythm = calculateSustainedRhythmScore(onsetSlice, transientSlice, frameDurationSeconds);
      const beatRegularity = calculateBeatRegularityScore(onsetSlice, beatFrameSpan);
      const avgTransient = average(transientSlice);
      const avgOnset = average(onsetSlice);
      const transientCoverage = transientSlice.filter((value) => value >= 0.16).length / transientSlice.length;
      const qualifies = qualifiesAsDrumSection({
        sustainedRhythm,
        beatRegularity,
        transientMean: avgTransient,
        transientCoverage,
        onset: avgOnset,
        hasBeatGrid: true,
      });

      if (
        qualifies &&
        sustainedRhythm >= bestCandidate.sustainedRhythm * 0.9 &&
        beatRegularity >= Math.max(bestCandidate.beatRegularity * 0.9, 0.45) &&
        transientCoverage >= 0.16
      ) {
        bestStartSecond = frameIndex * frameDurationSeconds;
        continue;
      }

      break;
    }

    bestCandidate.second = bestStartSecond;
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

  const confidence = clamp(
    bestCandidate.sustainedRhythm * 0.45 + bestCandidate.beatRegularity * 0.35 + bestCandidate.score * 0.2,
    0.2,
    0.98,
  );
  const summary =
    bestCandidate.qualifies && bestCandidate.sustainedRhythm >= 0.68 && bestCandidate.beatRegularity >= 0.55
      ? "已優先鎖定連續穩定且有明顯鼓點的區段，可作為建議進點。"
      : bestCandidate.qualifies && confidence >= 0.5
        ? "有抓到拍點區段，但鼓點存在感或連續穩定度普通，建議人工試聽確認。"
        : "前段沒有通過鼓點資格門檻，建議人工確認。";

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
