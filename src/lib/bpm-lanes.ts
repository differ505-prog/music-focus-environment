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
