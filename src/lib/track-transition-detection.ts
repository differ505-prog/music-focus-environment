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
  grooveFloor: number;
  cueMomentum: number;
  strategy: "drum" | "groove" | "fallback";
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

function buildRhythmBlockScores(
  onsetSlice: readonly number[],
  transientSlice: readonly number[],
  energySlice: readonly number[],
  frameDurationSeconds: number,
) {
  const blockFrameCount = Math.max(2, Math.round(0.25 / frameDurationSeconds));
  const blockScores: number[] = [];

  for (let index = 0; index < onsetSlice.length; index += blockFrameCount) {
    const onsetBlock = onsetSlice.slice(index, index + blockFrameCount);
    const transientBlock = transientSlice.slice(index, index + blockFrameCount);
    const energyBlock = energySlice.slice(index, index + blockFrameCount);

    if (onsetBlock.length === 0 || transientBlock.length === 0 || energyBlock.length === 0) {
      continue;
    }

    blockScores.push(average(onsetBlock) * 0.42 + average(transientBlock) * 0.38 + average(energyBlock) * 0.2);
  }

  return blockScores;
}

function calculateGrooveFloorScore(blockScores: readonly number[]) {
  if (blockScores.length === 0) {
    return 0;
  }

  const sortedScores = [...blockScores].sort((left, right) => left - right);
  const floorSampleCount = Math.max(1, Math.floor(sortedScores.length * 0.4));
  const floorMean = average(sortedScores.slice(0, floorSampleCount));
  const referenceLevel = Math.max(average(blockScores), 0.001);

  return clamp(floorMean / referenceLevel, 0, 1);
}

function calculateCueMomentumScore(blockScores: readonly number[]) {
  if (blockScores.length === 0) {
    return 0;
  }

  const openingScores = blockScores.slice(0, Math.min(4, blockScores.length));

  if (openingScores.length === 0) {
    return 0;
  }

  return clamp(average(openingScores) * 0.78 + Math.min(...openingScores) * 0.22, 0, 1);
}

function qualifiesAsDrumSection(metrics: {
  sustainedRhythm: number;
  beatRegularity: number;
  transientMean: number;
  transientCoverage: number;
  onset: number;
  grooveFloor: number;
  cueMomentum: number;
  hasBeatGrid: boolean;
}) {
  const baseQualified =
    metrics.transientMean >= 0.17 &&
    metrics.transientCoverage >= 0.22 &&
    metrics.onset >= 0.02 &&
    metrics.sustainedRhythm >= 0.28 &&
    metrics.grooveFloor >= 0.54 &&
    metrics.cueMomentum >= 0.12;

  if (!baseQualified) {
    return false;
  }

  if (!metrics.hasBeatGrid) {
    return true;
  }

  return metrics.beatRegularity >= 0.52;
}

function qualifiesAsGrooveSection(metrics: {
  sustainedRhythm: number;
  beatRegularity: number;
  transientMean: number;
  transientCoverage: number;
  onset: number;
  grooveFloor: number;
  cueMomentum: number;
  hasBeatGrid: boolean;
}) {
  const baseQualified =
    metrics.sustainedRhythm >= 0.3 &&
    metrics.grooveFloor >= 0.62 &&
    metrics.cueMomentum >= 0.15 &&
    metrics.transientMean >= 0.11 &&
    metrics.transientCoverage >= 0.14 &&
    metrics.onset >= 0.01;

  if (!baseQualified) {
    return false;
  }

  if (!metrics.hasBeatGrid) {
    return true;
  }

  return metrics.beatRegularity >= 0.36;
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
    grooveFloor: 0,
    cueMomentum: 0,
    strategy: "fallback",
  };
  let bestDrumCandidate: CandidateMetrics | null = null;
  let bestGrooveCandidate: CandidateMetrics | null = null;

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
    const rhythmBlockScores = buildRhythmBlockScores(onsetSlice, transientSlice, energySlice, frameDurationSeconds);
    const grooveFloor = calculateGrooveFloorScore(rhythmBlockScores);
    const cueMomentum = calculateCueMomentumScore(rhythmBlockScores);
    const candidateSecond = frameIndex * frameDurationSeconds;
    const earlyBias = 1 - candidateSecond / Math.max(searchEndSeconds, 1);
    const transientCoverage = transientSlice.filter((value) => value >= 0.16).length / transientSlice.length;
    const qualifiesDrum = qualifiesAsDrumSection({
      sustainedRhythm,
      beatRegularity,
      transientMean: avgTransient,
      transientCoverage,
      onset: avgOnset,
      grooveFloor,
      cueMomentum,
      hasBeatGrid: beatFrameSpan != null,
    });
    const qualifiesGroove = qualifiesAsGrooveSection({
      sustainedRhythm,
      beatRegularity,
      transientMean: avgTransient,
      transientCoverage,
      onset: avgOnset,
      grooveFloor,
      cueMomentum,
      hasBeatGrid: beatFrameSpan != null,
    });
    const drumScore =
      sustainedRhythm * 0.26 +
      beatRegularity * 0.24 +
      avgTransient * 0.18 +
      transientCoverage * 0.12 +
      grooveFloor * 0.1 +
      cueMomentum * 0.06 +
      avgOnset * 0.02 +
      avgEnergy * 0.01 +
      earlyBias * 0.01;
    const grooveScore =
      grooveFloor * 0.28 +
      cueMomentum * 0.24 +
      sustainedRhythm * 0.18 +
      beatRegularity * 0.12 +
      transientCoverage * 0.08 +
      avgTransient * 0.05 +
      avgEnergy * 0.03 +
      earlyBias * 0.02;
    const fallbackScore =
      grooveFloor * 0.32 +
      cueMomentum * 0.26 +
      sustainedRhythm * 0.18 +
      beatRegularity * 0.08 +
      avgTransient * 0.06 +
      transientCoverage * 0.05 +
      avgEnergy * 0.03 +
      earlyBias * 0.02;

    const candidate: CandidateMetrics = {
      second: candidateSecond,
      score: fallbackScore,
      energy: avgEnergy,
      onset: avgOnset,
      sustainedRhythm,
      beatRegularity,
      transientMean: avgTransient,
      transientCoverage,
      grooveFloor,
      cueMomentum,
      strategy: "fallback",
    };

    if (
      qualifiesDrum &&
      (!bestDrumCandidate ||
        drumScore > bestDrumCandidate.score ||
        (Math.abs(drumScore - bestDrumCandidate.score) < 0.025 && candidateSecond < bestDrumCandidate.second))
    ) {
      bestDrumCandidate = {
        ...candidate,
        score: drumScore,
        strategy: "drum",
      };
    }

    if (
      qualifiesGroove &&
      (!bestGrooveCandidate ||
        grooveScore > bestGrooveCandidate.score ||
        (Math.abs(grooveScore - bestGrooveCandidate.score) < 0.025 && candidateSecond < bestGrooveCandidate.second))
    ) {
      bestGrooveCandidate = {
        ...candidate,
        score: grooveScore,
        strategy: "groove",
      };
    }

    if (fallbackScore > bestCandidate.score) {
      bestCandidate = candidate;
    }
  }

  if (bestDrumCandidate) {
    bestCandidate = bestDrumCandidate;
  } else if (bestGrooveCandidate) {
    bestCandidate = bestGrooveCandidate;
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
      const rhythmBlockScores = buildRhythmBlockScores(onsetSlice, transientSlice, energySlice, frameDurationSeconds);
      const grooveFloor = calculateGrooveFloorScore(rhythmBlockScores);
      const cueMomentum = calculateCueMomentumScore(rhythmBlockScores);
      const transientCoverage = transientSlice.filter((value) => value >= 0.16).length / transientSlice.length;
      const qualifies =
        bestCandidate.strategy === "drum"
          ? qualifiesAsDrumSection({
              sustainedRhythm,
              beatRegularity,
              transientMean: avgTransient,
              transientCoverage,
              onset: avgOnset,
              grooveFloor,
              cueMomentum,
              hasBeatGrid: true,
            })
          : qualifiesAsGrooveSection({
              sustainedRhythm,
              beatRegularity,
              transientMean: avgTransient,
              transientCoverage,
              onset: avgOnset,
              grooveFloor,
              cueMomentum,
              hasBeatGrid: true,
            });

      if (
        qualifies &&
        sustainedRhythm >= bestCandidate.sustainedRhythm * 0.9 &&
        beatRegularity >= Math.max(bestCandidate.beatRegularity * 0.88, 0.32) &&
        transientCoverage >= Math.max(bestCandidate.transientCoverage * 0.82, 0.12) &&
        grooveFloor >= Math.max(bestCandidate.grooveFloor * 0.9, 0.5)
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
    bestCandidate.grooveFloor * 0.3 +
      bestCandidate.cueMomentum * 0.28 +
      bestCandidate.sustainedRhythm * 0.22 +
      bestCandidate.beatRegularity * 0.12 +
      bestCandidate.score * 0.08,
    0.2,
    0.98,
  );
  const summary =
    bestCandidate.strategy === "drum"
      ? "已優先鎖定連續穩定且鼓點明確的區段，可作為建議進點。"
      : bestCandidate.strategy === "groove"
        ? "已改用弱鼓 groove fallback，優先維持節奏連續感。"
        : "前段沒有找到明確鼓點段，已退回最穩定的節奏核心位置。";

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
