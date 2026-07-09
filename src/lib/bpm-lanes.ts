import type { Track } from "@/types/music";

export const bpmLaneOptions = [85, 100, 105, 115, 120] as const;

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

export type MergedBpmGroup = {
  type: "single" | "range";
  /** For single: the BPM value; for range: the representative (middle-ish) BPM. */
  representative: number;
  /** Display label shown on the chip. */
  label: string;
  /** Original BPM values contained in this group. */
  values: number[];
  /** Whether this group is currently selected (all member values are in activeBpms). */
  isSelected: boolean;
  /** Whether some but not all member values are active. */
  isPartial: boolean;
};

/**
 * Groups BPM values into range chips when adjacent values differ by ≤ MERGE_THRESHOLD.
 * For active-filter purposes each group carries the full value set — the parent
 * `onToggleBpm` receives a `number[]` so the entire group (or all members)
 * gets activated/deactivated in one gesture.
 */
export function buildMergedBpmOptions(
  rawBpms: number[],
  activeBpms: number[],
): MergedBpmGroup[] {
  if (rawBpms.length === 0) return [];

  const sorted = [...new Set(rawBpms)].sort((a, b) => a - b);
  const MERGE_THRESHOLD = 5;

  const groups: MergedBpmGroup[] = [];
  let i = 0;

  while (i < sorted.length) {
    const rangeValues: number[] = [sorted[i]];

    while (
      i + rangeValues.length < sorted.length &&
      sorted[i + rangeValues.length] - rangeValues[rangeValues.length - 1] <= MERGE_THRESHOLD
    ) {
      rangeValues.push(sorted[i + rangeValues.length]);
    }

    const isSingle = rangeValues.length === 1;
    const label = isSingle
      ? String(rangeValues[0])
      : `${rangeValues[0]}–${rangeValues[rangeValues.length - 1]}`;

    const representative = isSingle
      ? rangeValues[0]
      : Math.round(rangeValues.reduce((s, v) => s + v, 0) / rangeValues.length);

    const activeSet = new Set(activeBpms);
    const isSelected = rangeValues.every((v) => activeSet.has(v));
    const isPartial = rangeValues.some((v) => activeSet.has(v)) && !isSelected;

    groups.push({ type: isSingle ? "single" : "range", representative, label, values: rangeValues, isSelected, isPartial });

    i += rangeValues.length;
  }

  return groups;
}
