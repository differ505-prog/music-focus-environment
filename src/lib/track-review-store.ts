import { themePrograms, tracks as baseTracks } from "@/data/music-assets";
import type { ThemeProgram, Track } from "@/types/music";

export type StoredTrackBpmDetection = {
  trackId: string;
  audioUrl: string;
  detectedBpm: number;
  rawDetectedBpm?: number;
  confidence: number;
  laneSuggestion: number;
  peakCount: number;
  sampleDurationSeconds: number;
  detectedAt: string;
  resolvedByReference?: boolean;
};

export type StoredTrackMixInSuggestion = {
  trackId: string;
  audioUrl: string;
  suggestedMixInSeconds: number;
  confidence: number;
  analysisWindowSeconds: number;
  beatAligned: boolean;
  summary: string;
  analyzedAt: string;
};

export type TrackReviewOverride = {
  bpm?: number;
  themeProgramId?: string;
  ignoreBpmMismatch?: boolean;
  mixInPointSeconds?: number;
  reviewedAt?: string;
};

export type TrackBpmReviewItem = {
  track: Track;
  baseTrack: Track;
  detection: StoredTrackBpmDetection;
  effectiveBpm: number;
  effectiveThemeProgramId: string;
  effectiveProgramTitle: string;
  allowedBpms: number[];
  bpmDiff: number;
  routeMismatch: boolean;
  ignored: boolean;
  suggestedThemeProgramId: string | null;
  suggestedProgramTitle: string | null;
  canReturnToSuggestedRoute: boolean;
  /** true when the override BPM came from a manual Tap correction (override BPM differs from detected BPM). */
  isTapCorrected: boolean;
};

export type TrackTransitionReviewItem = {
  track: Track;
  baseTrack: Track;
  effectiveMixInPointSeconds: number;
  baseMixInPointSeconds: number;
  suggestion: StoredTrackMixInSuggestion;
  diffSeconds: number;
};

export type TrackOverrideHistoryItem = {
  track: Track;
  baseTrack: Track;
  override: TrackReviewOverride;
  effectiveBpm: number;
  baseBpm: number;
  effectiveThemeProgramId: string;
  baseThemeProgramId: string | null;
  effectiveProgramTitle: string;
  baseProgramTitle: string;
  mixInChanged: boolean;
  baseMixInPointSeconds: number;
  effectiveMixInPointSeconds: number;
  reviewedAt: string | null;
};

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

export function hasTrackReviewOverride(trackId: string): boolean {
  const overrides = readTrackReviewOverrides();
  return Boolean(overrides[trackId]);
}

export function buildTrackOverrideHistoryItems(
  trackList: readonly Track[] = baseTracks,
  programs: readonly ThemeProgram[] = themePrograms,
  overrides: Record<string, TrackReviewOverride> = readTrackReviewOverrides(),
) {
  const programMap = new Map(programs.map((program) => [program.id, program] as const));
  const baseTrackMap = new Map(baseTracks.map((track) => [track.id, track] as const));

  return trackList
    .map((track): TrackOverrideHistoryItem | null => {
      const override = overrides[track.id];

      if (!override) {
        return null;
      }

      const baseTrack = baseTrackMap.get(track.id) ?? track;
      const baseThemeProgramId = baseTrack.themeProgramId ?? null;
      const effectiveThemeProgramId = override.themeProgramId ?? baseThemeProgramId ?? "";
      const effectiveProgram = programMap.get(effectiveThemeProgramId) ?? null;
      const baseProgram = baseThemeProgramId ? programMap.get(baseThemeProgramId) ?? null : null;

      return {
        track,
        baseTrack,
        override,
        effectiveBpm: override.bpm ?? track.bpm,
        baseBpm: baseTrack.bpm,
        effectiveThemeProgramId,
        baseThemeProgramId,
        effectiveProgramTitle: effectiveProgram?.title ?? "未指定路線",
        baseProgramTitle: baseProgram?.title ?? "未指定路線",
        mixInChanged: override.mixInPointSeconds != null && override.mixInPointSeconds !== baseTrack.transition.mixInPointSeconds,
        baseMixInPointSeconds: baseTrack.transition.mixInPointSeconds,
        effectiveMixInPointSeconds: override.mixInPointSeconds ?? track.transition.mixInPointSeconds,
        reviewedAt: override.reviewedAt ?? null,
      };
    })
    .filter(isPresent)
    .sort((left, right) => {
      const leftTime = left.reviewedAt ? Date.parse(left.reviewedAt) : 0;
      const rightTime = right.reviewedAt ? Date.parse(right.reviewedAt) : 0;

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return left.track.title.localeCompare(right.track.title);
    });
}

const TRACK_BPM_DETECTIONS_STORAGE_KEY = "track-bpm-detections-v1";
const TRACK_MIX_IN_SUGGESTIONS_STORAGE_KEY = "track-mix-in-suggestions-v1";
const TRACK_REVIEW_OVERRIDES_STORAGE_KEY = "track-review-overrides-v1";
const TRACK_REVIEW_STORAGE_EVENT = "track-review-storage-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitTrackReviewStorageUpdate() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(TRACK_REVIEW_STORAGE_EVENT));
}

function readJsonRecord<T>(storageKey: string): Record<string, T> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

function writeJsonRecord<T>(storageKey: string, value: Record<string, T>) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
  emitTrackReviewStorageUpdate();
}

function normalizeTrackReviewOverride(override: TrackReviewOverride) {
  const nextOverride = { ...override };

  if (nextOverride.bpm == null) {
    delete nextOverride.bpm;
  }

  if (nextOverride.themeProgramId == null) {
    delete nextOverride.themeProgramId;
  }

  if (nextOverride.ignoreBpmMismatch == null) {
    delete nextOverride.ignoreBpmMismatch;
  }

  if (nextOverride.mixInPointSeconds == null) {
    delete nextOverride.mixInPointSeconds;
  }

  return nextOverride;
}

function hasEffectiveTrackReviewOverride(override: TrackReviewOverride) {
  return (
    override.bpm != null ||
    override.themeProgramId != null ||
    override.ignoreBpmMismatch != null ||
    override.mixInPointSeconds != null
  );
}

export function getTrackReviewStorageEventName() {
  return TRACK_REVIEW_STORAGE_EVENT;
}

export function readTrackBpmDetections() {
  return readJsonRecord<StoredTrackBpmDetection>(TRACK_BPM_DETECTIONS_STORAGE_KEY);
}

export function saveTrackBpmDetection(detection: StoredTrackBpmDetection) {
  const nextDetections = {
    ...readTrackBpmDetections(),
    [detection.trackId]: detection,
  };

  writeJsonRecord(TRACK_BPM_DETECTIONS_STORAGE_KEY, nextDetections);
}

export function readTrackMixInSuggestions() {
  return readJsonRecord<StoredTrackMixInSuggestion>(TRACK_MIX_IN_SUGGESTIONS_STORAGE_KEY);
}

export function saveTrackMixInSuggestion(suggestion: StoredTrackMixInSuggestion) {
  const nextSuggestions = {
    ...readTrackMixInSuggestions(),
    [suggestion.trackId]: suggestion,
  };

  writeJsonRecord(TRACK_MIX_IN_SUGGESTIONS_STORAGE_KEY, nextSuggestions);
}

export function readTrackReviewOverrides() {
  return readJsonRecord<TrackReviewOverride>(TRACK_REVIEW_OVERRIDES_STORAGE_KEY);
}

export function updateTrackReviewOverride(trackId: string, patch: Partial<TrackReviewOverride>) {
  const currentOverrides = readTrackReviewOverrides();
  const nextOverride = normalizeTrackReviewOverride({
    ...(currentOverrides[trackId] ?? {}),
    ...patch,
    reviewedAt: new Date().toISOString(),
  });

  if (!hasEffectiveTrackReviewOverride(nextOverride)) {
    const trimmedOverrides = { ...currentOverrides };
    delete trimmedOverrides[trackId];
    writeJsonRecord(TRACK_REVIEW_OVERRIDES_STORAGE_KEY, trimmedOverrides);
    return;
  }

  writeJsonRecord(TRACK_REVIEW_OVERRIDES_STORAGE_KEY, {
    ...currentOverrides,
    [trackId]: nextOverride,
  });
}

export function clearTrackReviewOverride(trackId: string) {
  const currentOverrides = { ...readTrackReviewOverrides() };
  delete currentOverrides[trackId];
  writeJsonRecord(TRACK_REVIEW_OVERRIDES_STORAGE_KEY, currentOverrides);
}

export function updateTrackReviewOverrides(patches: Array<{ trackId: string; patch: Partial<TrackReviewOverride> }>) {
  if (patches.length === 0) {
    return;
  }

  const currentOverrides = { ...readTrackReviewOverrides() };

  for (const { trackId, patch } of patches) {
    const nextOverride = normalizeTrackReviewOverride({
      ...(currentOverrides[trackId] ?? {}),
      ...patch,
      reviewedAt: new Date().toISOString(),
    });

    if (hasEffectiveTrackReviewOverride(nextOverride)) {
      currentOverrides[trackId] = nextOverride;
      continue;
    }

    delete currentOverrides[trackId];
  }

  writeJsonRecord(TRACK_REVIEW_OVERRIDES_STORAGE_KEY, currentOverrides);
}

export function extractAllowedBpms(program: ThemeProgram | null | undefined) {
  return Array.from(new Set((program?.bpmDisplay.match(/\d+/g) ?? []).map(Number))).sort((left, right) => left - right);
}

export function buildRuntimeTracks(
  trackList: readonly Track[] = baseTracks,
  overrides: Record<string, TrackReviewOverride> = readTrackReviewOverrides(),
) {
  return trackList.map((track) => {
    const override = overrides[track.id];

    if (!override) {
      return track;
    }

    return {
      ...track,
      bpm: override.bpm ?? track.bpm,
      themeProgramId: override.themeProgramId ?? track.themeProgramId,
      transition: {
        ...track.transition,
        mixInPointSeconds: override.mixInPointSeconds ?? track.transition.mixInPointSeconds,
      },
    };
  });
}

export function buildTrackBpmReviewItems(
  trackList: readonly Track[] = baseTracks,
  programs: readonly ThemeProgram[] = themePrograms,
  overrides: Record<string, TrackReviewOverride> = readTrackReviewOverrides(),
  detections: Record<string, StoredTrackBpmDetection> = readTrackBpmDetections(),
) {
  const programMap = new Map(programs.map((program) => [program.id, program] as const));
  const baseTrackMap = new Map(baseTracks.map((track) => [track.id, track] as const));

  return trackList
    .map((track): TrackBpmReviewItem | null => {
      const detection = detections[track.id];

      if (!detection || detection.audioUrl !== track.media.audioUrl) {
        return null;
      }

      const baseTrack = baseTrackMap.get(track.id) ?? track;
      const override = overrides[track.id];
      const effectiveBpm = override?.bpm ?? track.bpm;
      const effectiveThemeProgramId = override?.themeProgramId ?? track.themeProgramId ?? baseTrack.themeProgramId ?? "";
      const effectiveProgram = programMap.get(effectiveThemeProgramId) ?? null;
      const allowedBpms = extractAllowedBpms(effectiveProgram);
      const bpmDiff = Math.abs(effectiveBpm - detection.detectedBpm);
      const routeMismatch = allowedBpms.length > 0 && !allowedBpms.includes(detection.detectedBpm);
      const ignored = Boolean(override?.ignoreBpmMismatch);
      const baseProgramId = baseTrack.themeProgramId ?? null;
      const baseProgram = baseProgramId ? programMap.get(baseProgramId) ?? null : null;
      const baseAllowedBpms = extractAllowedBpms(baseProgram);
      const suggestedThemeProgramId =
        baseProgramId && baseAllowedBpms.includes(detection.detectedBpm) ? baseProgramId : null;
      const canReturnToSuggestedRoute =
        Boolean(suggestedThemeProgramId) && suggestedThemeProgramId !== effectiveThemeProgramId;

      // Manual override BPM that differs from detected BPM = "Tap校正" item
      const isTapCorrected = override?.bpm != null && override.bpm !== detection.detectedBpm;

      if ((bpmDiff < 3 && !routeMismatch && !canReturnToSuggestedRoute) || ignored) {
        return null;
      }

      return {
        track,
        baseTrack,
        detection,
        effectiveBpm,
        effectiveThemeProgramId,
        effectiveProgramTitle: effectiveProgram?.title ?? "未指定路線",
        allowedBpms,
        bpmDiff,
        routeMismatch,
        ignored,
        suggestedThemeProgramId,
        suggestedProgramTitle: suggestedThemeProgramId ? (baseProgram?.title ?? "原始路線") : null,
        canReturnToSuggestedRoute,
        isTapCorrected,
      };
    })
    .filter(isPresent)
    .sort((left, right) => {
      if (right.bpmDiff !== left.bpmDiff) {
        return right.bpmDiff - left.bpmDiff;
      }

      return left.track.title.localeCompare(right.track.title);
    });
}

export function buildTrackTransitionReviewItems(
  trackList: readonly Track[] = baseTracks,
  overrides: Record<string, TrackReviewOverride> = readTrackReviewOverrides(),
  suggestions: Record<string, StoredTrackMixInSuggestion> = readTrackMixInSuggestions(),
) {
  const baseTrackMap = new Map(baseTracks.map((track) => [track.id, track] as const));

  return trackList
    .map((track): TrackTransitionReviewItem | null => {
      const suggestion = suggestions[track.id];

      if (!suggestion || suggestion.audioUrl !== track.media.audioUrl) {
        return null;
      }

      const baseTrack = baseTrackMap.get(track.id) ?? track;
      const override = overrides[track.id];
      const effectiveMixInPointSeconds = override?.mixInPointSeconds ?? track.transition.mixInPointSeconds;
      const baseMixInPointSeconds = baseTrack.transition.mixInPointSeconds;
      const diffSeconds = Math.abs(effectiveMixInPointSeconds - suggestion.suggestedMixInSeconds);

      return {
        track,
        baseTrack,
        effectiveMixInPointSeconds,
        baseMixInPointSeconds,
        suggestion,
        diffSeconds,
      };
    })
    .filter(isPresent)
    .sort((left, right) => {
      if (right.diffSeconds !== left.diffSeconds) {
        return right.diffSeconds - left.diffSeconds;
      }

      return left.track.title.localeCompare(right.track.title);
    });
}
