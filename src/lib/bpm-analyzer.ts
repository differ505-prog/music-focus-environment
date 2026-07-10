const MIN_NORMALIZED_BPM = 70;
const MAX_NORMALIZED_BPM = 180;
const ENVELOPE_FPS = 200;
const MAX_ANALYSIS_SECONDS = 120;
const MIN_PEAK_SPACING_SECONDS = 0.18;
const ANALYSIS_SEGMENT_SECONDS = 32;
const ANALYSIS_SEGMENT_COUNT = 3;
const REFERENCE_MATCH_TOLERANCE_BPM = 5;

export type BpmCandidate = {
  bpm: number;
  score: number;
};

export type BpmAnalysisOptions = {
  metadataBpm?: number;
  allowedBpms?: readonly number[];
};

export type BpmAnalysis = {
  estimatedBpm: number;
  rawDetectedBpm: number;
  normalizedBpm: number;
  confidence: number;
  laneSuggestion: number;
  candidates: BpmCandidate[];
  sampleDurationSeconds: number;
  peakCount: number;
  resolvedByReference: boolean;
};

function mixToMono(channelData: Float32Array[]) {
  const length = channelData[0]?.length ?? 0;
  const mono = new Float32Array(length);

  for (let channelIndex = 0; channelIndex < channelData.length; channelIndex += 1) {
    const channel = channelData[channelIndex];

    for (let index = 0; index < length; index += 1) {
      mono[index] += channel[index] / channelData.length;
    }
  }

  return mono;
}

function buildEnvelope(samples: Float32Array, sampleRate: number) {
  const windowSize = Math.max(128, Math.floor(sampleRate / ENVELOPE_FPS));
  const frameCount = Math.floor(samples.length / windowSize);
  const envelope = new Float32Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * windowSize;
    let energy = 0;

    for (let sampleIndex = 0; sampleIndex < windowSize; sampleIndex += 1) {
      const value = samples[start + sampleIndex] ?? 0;
      energy += value * value;
    }

    envelope[frameIndex] = Math.sqrt(energy / windowSize);
  }

  return {
    envelope,
    frameDurationSeconds: windowSize / sampleRate,
  };
}

function createSampleSegments(samples: Float32Array, sampleRate: number) {
  const maxAnalysisLength = Math.floor(sampleRate * MAX_ANALYSIS_SECONDS);
  const trimmedSamples = samples.slice(0, Math.min(samples.length, maxAnalysisLength));
  const segmentLength = Math.min(trimmedSamples.length, Math.floor(sampleRate * ANALYSIS_SEGMENT_SECONDS));

  if (segmentLength <= 0 || trimmedSamples.length <= segmentLength) {
    return [trimmedSamples];
  }

  const maxStart = Math.max(trimmedSamples.length - segmentLength, 0);
  const starts = new Set<number>([0, maxStart]);

  for (let index = 1; index < ANALYSIS_SEGMENT_COUNT - 1; index += 1) {
    starts.add(Math.floor((maxStart * index) / (ANALYSIS_SEGMENT_COUNT - 1)));
  }

  return Array.from(starts)
    .sort((left, right) => left - right)
    .map((start) => trimmedSamples.slice(start, start + segmentLength));
}

function detectPeaks(envelope: Float32Array, frameDurationSeconds: number) {
  const values = Array.from(envelope);
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
  const threshold = mean + Math.sqrt(variance) * 0.9;
  const minSpacingFrames = Math.max(1, Math.floor(MIN_PEAK_SPACING_SECONDS / frameDurationSeconds));
  const peaks: Array<{ timeSeconds: number; strength: number }> = [];
  let lastPeakFrame = -minSpacingFrames;

  for (let frameIndex = 1; frameIndex < envelope.length - 1; frameIndex += 1) {
    const current = envelope[frameIndex];

    if (
      current < threshold ||
      current <= envelope[frameIndex - 1] ||
      current < envelope[frameIndex + 1] ||
      frameIndex - lastPeakFrame < minSpacingFrames
    ) {
      continue;
    }

    peaks.push({
      timeSeconds: frameIndex * frameDurationSeconds,
      strength: current,
    });
    lastPeakFrame = frameIndex;
  }

  return peaks;
}

function normalizeTempo(tempo: number) {
  let normalized = tempo;

  while (normalized < MIN_NORMALIZED_BPM) {
    normalized *= 2;
  }

  while (normalized > MAX_NORMALIZED_BPM) {
    normalized /= 2;
  }

  return normalized;
}

function buildTempoHistogram(peaks: Array<{ timeSeconds: number; strength: number }>) {
  const histogram = new Map<number, number>();

  for (let index = 0; index < peaks.length; index += 1) {
    for (let offset = 1; offset <= 10 && index + offset < peaks.length; offset += 1) {
      const intervalSeconds = peaks[index + offset].timeSeconds - peaks[index].timeSeconds;

      if (intervalSeconds <= 0.25 || intervalSeconds >= 2.5) {
        continue;
      }

      const rawTempo = 60 / intervalSeconds;
      const weight = peaks[index].strength + peaks[index + offset].strength;

      // Track both the raw tempo and its relationship to common BPM lanes
      const normalizedTempo = Math.round(normalizeTempo(rawTempo));

      histogram.set(normalizedTempo, (histogram.get(normalizedTempo) ?? 0) + weight);

      // Also track half-beat and double-beat versions for better precision
      const halfBeat = Math.round(normalizeTempo(rawTempo / 2));
      const doubleBeat = Math.round(normalizeTempo(rawTempo * 2));

      // Only add if they represent distinct BPM values
      if (halfBeat !== normalizedTempo) {
        histogram.set(halfBeat, (histogram.get(halfBeat) ?? 0) + weight * 0.7);
      }
      if (doubleBeat !== normalizedTempo && doubleBeat !== halfBeat) {
        histogram.set(doubleBeat, (histogram.get(doubleBeat) ?? 0) + weight * 0.6);
      }
    }
  }

  return Array.from(histogram.entries())
    .map(([bpm, score]) => ({ bpm, score }))
    .sort((left, right) => right.score - left.score);
}

function buildEquivalentTempoCandidates(bpm: number) {
  const equivalents = new Set<number>([Math.round(bpm)]);
  let slower = bpm / 2;

  while (slower >= MIN_NORMALIZED_BPM / 2) {
    equivalents.add(Math.round(slower));
    slower /= 2;
  }

  let faster = bpm * 2;

  while (faster <= MAX_NORMALIZED_BPM * 2) {
    equivalents.add(Math.round(faster));
    faster *= 2;
  }

  return Array.from(equivalents);
}

function resolveReferenceBpm(
  candidates: BpmCandidate[],
  options: BpmAnalysisOptions,
) {
  const metadataBpm = options.metadataBpm;
  const allowedBpms = Array.from(new Set(options.allowedBpms ?? [])).sort((left, right) => left - right);
  const scoreTotal = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  const topScore = candidates[0]?.score ?? 0;
  const topBpm = candidates[0]?.bpm ?? 0;
  const confidence = scoreTotal > 0 ? topScore / scoreTotal : 0;

  // Build candidate bpm pool (raw + half/double for every candidate).
  const allCandidateBpms = new Set<number>();
  for (const candidate of candidates) {
    for (const equivalent of buildEquivalentTempoCandidates(candidate.bpm)) {
      allCandidateBpms.add(equivalent);
    }
  }

  // Strategy A: metadataBpm match. We use a wider tolerance (REFERENCE_MATCH_TOLERANCE_BPM = 5)
  // to absorb half/double BPM quantization errors.
  if (typeof metadataBpm === "number") {
    const candidatesNearMetadata = Array.from(allCandidateBpms).filter(
      (bpm) => Math.abs(bpm - metadataBpm) <= REFERENCE_MATCH_TOLERANCE_BPM,
    );

    if (candidatesNearMetadata.length > 0) {
      return metadataBpm;
    }

    // Low-confidence fallback: when the detector is unsure (< 0.4) AND a metadataBpm is provided
    // AND that metadataBpm is one of the allowed lanes, trust the metadata over the noisy raw
    // candidate. This handles tracks where the detector picks up ghost tempo multiples (e.g. 105
    // for an 85 BPM track whose detected envelope happens to peak at 4/5 the true tempo).
    if (
      confidence < 0.4 &&
      allowedBpms.length > 0 &&
      allowedBpms.includes(metadataBpm)
    ) {
      return metadataBpm;
    }
  }

  // Strategy B: allowedBpms match. Only override the raw candidate if it is actually near a lane.
  if (allowedBpms.length > 0) {
    for (const allowedBpm of allowedBpms) {
      const nearAllowed = Array.from(allCandidateBpms).filter(
        (bpm) => Math.abs(bpm - allowedBpm) <= REFERENCE_MATCH_TOLERANCE_BPM,
      );

      if (nearAllowed.length === 0) {
        continue;
      }

      // If the raw top candidate itself is already near the allowed lane, return it (no need to
      // distort); otherwise pick the nearest allowed lane as the resolved value.
      if (Math.abs(topBpm - allowedBpm) <= REFERENCE_MATCH_TOLERANCE_BPM) {
        return topBpm;
      }

      return allowedBpm;
    }
  }

  return null;
}

function getNearestLane(bpm: number, laneOptions: readonly number[]) {
  return laneOptions.reduce((closest, candidate) => {
    return Math.abs(candidate - bpm) < Math.abs(closest - bpm) ? candidate : closest;
  }, laneOptions[0] ?? bpm);
}

export function analyzeAudioBufferForBpm(
  audioBuffer: AudioBuffer,
  laneOptions: readonly number[],
  options: BpmAnalysisOptions = {},
  playheadSeconds: number = 0,
): BpmAnalysis {
  const sampleRate = audioBuffer.sampleRate;
  const totalLength = Math.floor(audioBuffer.length);

  // Clamp playhead to valid range
  const safePlayheadSeconds = Math.max(0, Math.min(playheadSeconds, totalLength / sampleRate));
  const startSample = Math.floor(safePlayheadSeconds * sampleRate);
  const targetLength = Math.min(totalLength - startSample, Math.floor(sampleRate * MAX_ANALYSIS_SECONDS));
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex).slice(startSample, startSample + targetLength),
  );
  const mono = mixToMono(channelData);
  const histogram = new Map<number, number>();
  let peakCount = 0;

  for (const segment of createSampleSegments(mono, audioBuffer.sampleRate)) {
    const { envelope, frameDurationSeconds } = buildEnvelope(segment, audioBuffer.sampleRate);
    const peaks = detectPeaks(envelope, frameDurationSeconds);
    peakCount += peaks.length;

    for (const candidate of buildTempoHistogram(peaks)) {
      histogram.set(candidate.bpm, (histogram.get(candidate.bpm) ?? 0) + candidate.score);
    }
  }

  const candidates = Array.from(histogram.entries())
    .map(([bpm, score]) => ({ bpm, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
  const primary = candidates[0] ?? { bpm: 0, score: 0 };
  const scoreTotal = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  const confidence = scoreTotal > 0 ? primary.score / scoreTotal : 0;
  const resolvedBpm = resolveReferenceBpm(candidates, options) ?? primary.bpm;

  return {
    estimatedBpm: resolvedBpm,
    rawDetectedBpm: primary.bpm,
    normalizedBpm: primary.bpm,
    confidence,
    laneSuggestion: getNearestLane(resolvedBpm, laneOptions),
    candidates,
    sampleDurationSeconds: Number((targetLength / sampleRate).toFixed(1)),
    peakCount,
    resolvedByReference: resolvedBpm !== primary.bpm,
  };
}
