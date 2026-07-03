import { getBpmCompatibility } from "@/lib/bpm-lanes";
import type { AutoDjPhase, AutoDjSessionPlan, AutoDjTrackPlan, Track } from "@/types/music";

const phaseCurve = [0.18, 0.42, 0.68, 0.36] as const;

function getPhaseMeta(index: number, total: number): Pick<AutoDjTrackPlan, "phase" | "phaseLabel" | "phaseDescription"> {
  if (total <= 1) {
    return {
      phase: "lock",
      phaseLabel: "主車道鎖定",
      phaseDescription: "單曲 session，直接維持穩定車道與專注密度。",
    };
  }

  const ratio = total === 1 ? 0 : index / (total - 1);

  if (ratio <= 0.2) {
    return {
      phase: "opening",
      phaseLabel: "開場鋪墊",
      phaseDescription: "先用最平穩的切入點打開 session，讓注意力自然沉下去。",
    };
  }

  if (ratio <= 0.55) {
    return {
      phase: "lock",
      phaseLabel: "主車道鎖定",
      phaseDescription: "把 BPM 與能量鎖在主車道，讓工作狀態維持長時間穩定。",
    };
  }

  if (ratio <= 0.82) {
    return {
      phase: "lift",
      phaseLabel: "細幅推進",
      phaseDescription: "只做小幅抬升，維持 DJ 感但不打斷心流。",
    };
  }

  return {
    phase: "glide",
    phaseLabel: "收尾滑行",
    phaseDescription: "保留尾韻與空間感，讓 session 能平順收束或銜接下一輪。",
  };
}

function getCompatibilityScore(previousTrack: Track, candidate: Track, phase: AutoDjPhase, targetEnergy: number) {
  const compatibility = getBpmCompatibility(previousTrack.bpm, candidate.bpm);
  const bpmDiff = Math.abs(previousTrack.bpm - candidate.bpm);
  const energyDiffFromPrevious = Math.abs(previousTrack.energyLevel - candidate.energyLevel);
  const energyDiffFromTarget = Math.abs(candidate.energyLevel - targetEnergy);
  const sharedMoodCount = candidate.moodTags.filter((tag) => previousTrack.moodTags.includes(tag)).length;

  let score =
    (compatibility.status === "exact" ? 120 : compatibility.status === "adjacent" ? 82 : 24) -
    bpmDiff * 4 -
    energyDiffFromPrevious * 7 -
    energyDiffFromTarget * 11 +
    sharedMoodCount * 6;

  if (phase === "lock" && compatibility.status === "exact") {
    score += 18;
  }

  if (phase === "lift" && candidate.energyLevel >= previousTrack.energyLevel) {
    score += 12;
  }

  if (phase === "glide" && candidate.energyLevel <= previousTrack.energyLevel) {
    score += 12;
  }

  return score;
}

function pickOpener(tracks: Track[]) {
  const minEnergy = Math.min(...tracks.map((track) => track.energyLevel));
  const maxEnergy = Math.max(...tracks.map((track) => track.energyLevel));
  const targetEnergy = minEnergy + (maxEnergy - minEnergy) * phaseCurve[0];

  return [...tracks].sort((left, right) => {
    const leftEnergyScore = Math.abs(left.energyLevel - targetEnergy);
    const rightEnergyScore = Math.abs(right.energyLevel - targetEnergy);

    if (leftEnergyScore !== rightEnergyScore) {
      return leftEnergyScore - rightEnergyScore;
    }

    if (left.bpm !== right.bpm) {
      return left.bpm - right.bpm;
    }

    return left.title.localeCompare(right.title);
  })[0];
}

export function buildAutoDjQueue(playlist: Track[], initialTrackId?: string) {
  if (playlist.length <= 1) {
    return playlist.map((track) => track.id);
  }

  const pool = [...playlist];
  const ordered: Track[] = [];
  const minEnergy = Math.min(...pool.map((track) => track.energyLevel));
  const maxEnergy = Math.max(...pool.map((track) => track.energyLevel));
  const initialTrack = initialTrackId ? pool.find((track) => track.id === initialTrackId) ?? null : null;
  const opener = initialTrack ?? pickOpener(pool);

  ordered.push(opener);
  pool.splice(
    pool.findIndex((track) => track.id === opener.id),
    1,
  );

  while (pool.length > 0) {
    const previousTrack = ordered[ordered.length - 1];
    const nextIndex = ordered.length;
    const phaseMeta = getPhaseMeta(nextIndex, playlist.length);
    const phaseIndex =
      phaseMeta.phase === "opening" ? 0 : phaseMeta.phase === "lock" ? 1 : phaseMeta.phase === "lift" ? 2 : 3;
    const targetEnergy = minEnergy + (maxEnergy - minEnergy) * phaseCurve[phaseIndex];

    const bestCandidate = [...pool].sort((left, right) => {
      return (
        getCompatibilityScore(previousTrack, right, phaseMeta.phase, targetEnergy) -
        getCompatibilityScore(previousTrack, left, phaseMeta.phase, targetEnergy)
      );
    })[0];

    ordered.push(bestCandidate);
    pool.splice(
      pool.findIndex((track) => track.id === bestCandidate.id),
      1,
    );
  }

  return ordered.map((track) => track.id);
}

export function createAutoDjSessionPlan(
  playlist: Track[],
  currentTrackId: string | null,
  nextTrackId: string | null,
): AutoDjSessionPlan | null {
  if (playlist.length === 0) {
    return null;
  }

  const laneSet = Array.from(new Set(playlist.map((track) => track.bpm))).sort((left, right) => left - right);
  const laneLabel =
    laneSet.length === 1 ? `${laneSet[0]} BPM 主車道` : `${laneSet[0]}-${laneSet[laneSet.length - 1]} BPM 鄰近車道`;
  const currentTrackIndex = currentTrackId ? playlist.findIndex((track) => track.id === currentTrackId) : -1;
  const activeIndex = currentTrackIndex >= 0 ? currentTrackIndex : 0;
  const trackPlans = playlist.map((track, index) => {
    const phaseMeta = getPhaseMeta(index, playlist.length);
    const previousTrack = index > 0 ? playlist[index - 1] : null;
    const transitionSummary = previousTrack
      ? `${previousTrack.bpm} -> ${track.bpm} BPM，Energy ${previousTrack.energyLevel.toFixed(1)} -> ${track.energyLevel.toFixed(1)}`
      : `以 ${track.bpm} BPM 與 Energy ${track.energyLevel.toFixed(1)} 穩定開場`;

    return {
      trackId: track.id,
      order: index + 1,
      phase: phaseMeta.phase,
      phaseLabel: phaseMeta.phaseLabel,
      phaseDescription: phaseMeta.phaseDescription,
      transitionSummary,
    };
  });

  const currentPlan = trackPlans[activeIndex] ?? null;
  const nextPlan =
    (nextTrackId ? trackPlans.find((plan) => plan.trackId === nextTrackId) : null) ??
    (activeIndex >= 0 ? trackPlans[activeIndex + 1] ?? null : trackPlans[0] ?? null);
  const mixBrief = currentPlan
    ? `${currentPlan.phaseLabel}中，系統維持 ${laneLabel}，把曲目順序壓成更像真人 DJ 的連續流。`
    : `系統已預排 ${playlist.length} 首曲目，維持 ${laneLabel} 的低摩擦 session。`;
  const nextTransitionSummary = nextPlan
    ? `${nextPlan.phaseLabel} · ${nextPlan.transitionSummary}`
    : "本輪已到清單尾端，可直接循環或換下一條內容線。";

  return {
    orderedTrackIds: playlist.map((track) => track.id),
    laneLabel,
    strategySummary:
      laneSet.length === 1
        ? "以同 BPM 穩定接歌為主，只在能量與質地上做細幅推進。"
        : "以鄰近 BPM 車道銜接為主，避免遠距跳速破壞沉浸感。",
    currentTrackIndex: activeIndex,
    currentPhase: currentPlan?.phase ?? null,
    currentPhaseLabel: currentPlan?.phaseLabel ?? "待機中",
    currentPhaseDescription: currentPlan?.phaseDescription ?? "尚未開始播放，系統已先排好 session 走向。",
    mixBrief,
    nextTransitionSummary,
    trackPlans,
  };
}
