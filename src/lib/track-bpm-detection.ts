'use client';

import { analyzeAudioBufferForBpm } from "@/lib/bpm-analyzer";
import type { BpmAnalysis } from "@/lib/bpm-analyzer";

type TrackBpmDetectionOptions = {
  metadataBpm?: number;
  allowedBpms?: readonly number[];
};

type SegmentConfig = {
  /** Audio position in seconds to start analysis from */
  startSeconds: number;
};

type SegmentProgressCallback = (segmentIndex: number, totalSegments: number, result: BpmSegmentResult) => void;

const DEFAULT_SEGMENTS: SegmentConfig[] = [
  { startSeconds: 0 },
  { startSeconds: 60 },
  { startSeconds: 120 },
];

export type BpmSegmentResult = {
  /** The `playheadSeconds` this segment started at */
  startSeconds: number;
  /** Nearest allowed lane BPM, or raw if no lanes defined */
  estimatedBpm: number;
  /** Unmodified algorithm output before lane snapping */
  rawDetectedBpm: number;
  confidence: number;
  laneSuggestion: number;
};

export type MultiSegmentBpmResult = {
  /** Final adopted BPM — consensus lane or highest-confidence single result */
  estimatedBpm: number;
  rawDetectedBpm: number;
  normalizedBpm: number;
  confidence: number;
  laneSuggestion: number;
  /** All segment results, even when consensus failed */
  segments: BpmSegmentResult[];
  /** true when ≥ 2 segments agreed on the same lane */
  consensusReached: boolean;
  /** Number of segments that agreed on the final estimatedBpm */
  agreeingSegments: number;
  /** Individual candidate lists from each segment */
  candidates: BpmAnalysis["candidates"];
  sampleDurationSeconds: number;
  peakCount: number;
  resolvedByReference: boolean;
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

export async function detectTrackBpmFromUrl(
  audioUrl: string,
  laneOptions: readonly number[],
  options: TrackBpmDetectionOptions = {},
  playheadSeconds: number = 0,
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

    return analyzeAudioBufferForBpm(audioBuffer, laneOptions, options, playheadSeconds);
  } finally {
    void audioContext.close().catch(() => {});
  }
}

const LANE_TOLERANCE_BPM = 3;

function bpmToLaneGroup(bpm: number, allowedBpms: readonly number[]): number {
  if (allowedBpms.length === 0) return Math.round(bpm);
  return (
    allowedBpms.find((lane) => Math.abs(lane - bpm) <= LANE_TOLERANCE_BPM) ??
    allowedBpms.reduce((closest, lane) =>
      Math.abs(lane - bpm) < Math.abs(closest - bpm) ? lane : closest,
    )
  );
}

function mergeCandidates(allSegmentCandidates: BpmAnalysis["candidates"][]): BpmAnalysis["candidates"] {
  const merged = new Map<number, number>();
  for (const segmentCandidates of allSegmentCandidates) {
    for (const candidate of segmentCandidates) {
      const rounded = Math.round(candidate.bpm * 10) / 10;
      merged.set(rounded, (merged.get(rounded) ?? 0) + candidate.score);
    }
  }
  return Array.from(merged.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([bpm, score]) => ({ bpm, score }));
}

export async function detectTrackBpmMultiSegment(
  audioUrl: string,
  laneOptions: readonly number[],
  options: TrackBpmDetectionOptions = {},
  segments: SegmentConfig[] = DEFAULT_SEGMENTS,
  onSegment?: SegmentProgressCallback,
): Promise<MultiSegmentBpmResult> {
  const segmentResults: BpmSegmentResult[] = [];
  const allCandidates: BpmAnalysis["candidates"][] = [];
  let totalSampleSeconds = 0;
  let totalPeakCount = 0;
  let resolvedByReference = false;

  let segmentIndex = 0;
  for (const segment of segments) {
    const result = await detectTrackBpmFromUrl(audioUrl, laneOptions, options, segment.startSeconds);
    onSegment?.(segmentIndex, segments.length, {
      startSeconds: segment.startSeconds,
      estimatedBpm: result.estimatedBpm,
      rawDetectedBpm: result.rawDetectedBpm,
      confidence: result.confidence,
      laneSuggestion: result.laneSuggestion,
    });
    segmentResults.push({
      startSeconds: segment.startSeconds,
      estimatedBpm: result.estimatedBpm,
      rawDetectedBpm: result.rawDetectedBpm,
      confidence: result.confidence,
      laneSuggestion: result.laneSuggestion,
    });
    allCandidates.push(result.candidates);
    totalSampleSeconds += result.sampleDurationSeconds;
    totalPeakCount += result.peakCount;
    if (result.resolvedByReference) resolvedByReference = true;
    segmentIndex++;
  }

  // Count how many segments land in the same lane group as the dominant result
  const dominantResult = segmentResults[0];
  const laneGroups = segmentResults.map((r) => bpmToLaneGroup(r.estimatedBpm, laneOptions));

  const dominantLaneGroup = laneGroups[0];
  const agreeingSegments = laneGroups.filter((g) => g === dominantLaneGroup).length;
  const consensusReached = agreeingSegments >= 2;

  const finalBpm = consensusReached
    ? dominantLaneGroup
    : dominantResult.estimatedBpm;

  const mergedCandidates = mergeCandidates(allCandidates);
  const primaryCandidate = mergedCandidates[0];

  const aggregateConfidence = consensusReached
    ? agreeingSegments / segments.length
    : (primaryCandidate?.score ?? 0) / (segmentResults[0].confidence + 1);

  return {
    estimatedBpm: finalBpm,
    rawDetectedBpm: dominantResult.rawDetectedBpm,
    normalizedBpm: dominantResult.estimatedBpm,
    confidence: Math.min(aggregateConfidence, 1),
    laneSuggestion: dominantResult.laneSuggestion,
    segments: segmentResults,
    consensusReached,
    agreeingSegments,
    candidates: mergedCandidates,
    sampleDurationSeconds: totalSampleSeconds,
    peakCount: totalPeakCount,
    resolvedByReference,
  };
}
