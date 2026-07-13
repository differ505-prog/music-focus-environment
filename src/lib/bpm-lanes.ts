import type { Track } from "@/types/music";

/** Canonical BPM lane pivots. */
export const bpmLaneOptions = [85, 90, 95, 100, 105, 115, 120, 125, 180] as const;

/** ±5 BPM tolerance around each pivot defines a lane. */
export const LANE_TOLERANCE = 5;

/** All canonical BPM lane pivots. */
export const ALL_LANES: readonly number[] = bpmLaneOptions;

export type BpmCompatibility = {
  status: "exact" | "adjacent" | "distant";
  label: string;
  description: string;
  isRecommended: boolean;
};

export function getBpmCompatibility(currentBpm: number, targetBpm: number): BpmCompatibility {
  const diff = Math.abs(currentBpm - targetBpm);

  if (diff === 0) {
    return {
      status: "exact",
      label: "同 BPM 最佳",
      description: "同車道最適合直接接歌。",
      isRecommended: true,
    };
  }

  if (diff <= 5) {
    return {
      status: "adjacent",
      label: "鄰近車道",
      description: "可接，但建議人工檢查進場與尾段。",
      isRecommended: true,
    };
  }

  return {
    status: "distant",
    label: "不建議直接接",
    description: "BPM 差距過大，容易破壞無痕感。",
    isRecommended: false,
  };
}

export function rankTracksForMixing(currentTrack: Track | null, tracks: Track[]) {
  if (!currentTrack) {
    return [];
  }

  return tracks
    .filter((track) => track.id !== currentTrack.id)
    .map((track) => {
      const compatibility = getBpmCompatibility(currentTrack.bpm, track.bpm);
      const bpmDiff = Math.abs(currentTrack.bpm - track.bpm);
      const energyDiff = Math.abs(currentTrack.energyLevel - track.energyLevel);
      const score =
        (compatibility.status === "exact" ? 100 : compatibility.status === "adjacent" ? 70 : 20) -
        bpmDiff * 4 -
        energyDiff * 6;

      return {
        track,
        compatibility,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
}

/**
 * Returns the canonical lane BPM for a given raw BPM, or null if it falls
 * outside every lane's ± LANE_TOLERANCE range.
 */
export function classifyLane(bpm: number): number | null {
  const rounded = Math.round(bpm);
  for (const pivot of bpmLaneOptions) {
    if (Math.abs(rounded - pivot) <= LANE_TOLERANCE) {
      return pivot;
    }
  }
  return null;
}

/**
 * Returns the label shown on a lane chip: "85 BPM" or "± 5 BPM" for uncategorised.
 */
export function labelForLane(lane: number | null): string {
  if (lane === null) return "± 5 BPM";
  return `${lane} BPM`;
}

export type MergedBpmGroup = {
  /** Canonical lane BPM, or null for uncategorised tracks. */
  lane: number | null;
  /** Display label shown on the chip. */
  label: string;
  /** BPM values contained in this lane (for filtering). */
  values: number[];
  isSelected: boolean;
  isPartial: boolean;
  /** True when the lane has no songs at all (useful for showing a placeholder framework). */
  isEmpty: boolean;
};

/**
 * Groups raw BPM values by canonical lane (±2).
 * Lanes are ordered by pivot value; lanes with no songs are marked isEmpty=true.
 * Tracks outside every lane appear as a single "± 2 BPM" group at the end.
 */
export function buildMergedBpmOptions(
  rawBpms: number[],
  activeBpms: number[],
): MergedBpmGroup[] {
  const activeSet = new Set(activeBpms.map(Math.round));

  // Group by lane — classifyLane returns null for uncategorised
  const laneMap = new Map<number | null, number[]>();
  for (const bpm of rawBpms) {
    const lane = classifyLane(bpm);
    const bucket = laneMap.get(lane) ?? [];
    bucket.push(bpm);
    laneMap.set(lane, bucket);
  }

  const groups: MergedBpmGroup[] = [];

  for (const pivot of bpmLaneOptions) {
    const values = laneMap.get(pivot) ?? [];
    const roundedValues = values.map(Math.round);
    const isSelected = roundedValues.length > 0 && roundedValues.every((v) => activeSet.has(v));
    const isPartial = roundedValues.some((v) => activeSet.has(v)) && !isSelected;
    const isEmpty = roundedValues.length === 0;
    groups.push({ lane: pivot, label: labelForLane(pivot), values: roundedValues, isSelected, isPartial, isEmpty });
  }

  // Append uncategorised group only when there are tracks outside every lane
  const uncategorised = laneMap.get(null) ?? [];
  if (uncategorised.length > 0) {
    const roundedValues = uncategorised.map(Math.round);
    const isSelected = roundedValues.every((v) => activeSet.has(v));
    const isPartial = roundedValues.some((v) => activeSet.has(v)) && !isSelected;
    groups.push({ lane: null, label: labelForLane(null), values: roundedValues, isSelected, isPartial, isEmpty: false });
  }

  return groups;
}
