const MIN_NORMALIZED_BPM = 70;
const MAX_NORMALIZED_BPM = 180;
const ENVELOPE_FPS = 200;
const MAX_ANALYSIS_SECONDS = 120;
const MIN_PEAK_SPACING_SECONDS = 0.18;

export type BpmCandidate = {
  bpm: number;
  score: number;
};

export type BpmAnalysis = {
  estimatedBpm: number;
  normalizedBpm: number;
  confidence: number;
  laneSuggestion: number;
  candidates: BpmCandidate[];
  sampleDurationSeconds: number;
  peakCount: number;
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
      const normalizedTempo = Math.round(normalizeTempo(rawTempo));
      const weight = peaks[index].strength + peaks[index + offset].strength;

      histogram.set(normalizedTempo, (histogram.get(normalizedTempo) ?? 0) + weight);
    }
  }

  return Array.from(histogram.entries())
    .map(([bpm, score]) => ({ bpm, score }))
    .sort((left, right) => right.score - left.score);
}

function getNearestLane(bpm: number, laneOptions: readonly number[]) {
  return laneOptions.reduce((closest, candidate) => {
    return Math.abs(candidate - bpm) < Math.abs(closest - bpm) ? candidate : closest;
  }, laneOptions[0] ?? bpm);
}

export function analyzeAudioBufferForBpm(audioBuffer: AudioBuffer, laneOptions: readonly number[]): BpmAnalysis {
  const targetLength = Math.min(
    audioBuffer.length,
    Math.floor(audioBuffer.sampleRate * MAX_ANALYSIS_SECONDS),
  );
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex).slice(0, targetLength),
  );
  const mono = mixToMono(channelData);
  const { envelope, frameDurationSeconds } = buildEnvelope(mono, audioBuffer.sampleRate);
  const peaks = detectPeaks(envelope, frameDurationSeconds);
  const candidates = buildTempoHistogram(peaks).slice(0, 5);
  const primary = candidates[0] ?? { bpm: 0, score: 0 };
  const scoreTotal = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  const confidence = scoreTotal > 0 ? primary.score / scoreTotal : 0;

  return {
    estimatedBpm: primary.bpm,
    normalizedBpm: primary.bpm,
    confidence,
    laneSuggestion: getNearestLane(primary.bpm, laneOptions),
    candidates,
    sampleDurationSeconds: Number((targetLength / audioBuffer.sampleRate).toFixed(1)),
    peakCount: peaks.length,
  };
}
