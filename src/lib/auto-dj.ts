import { getBpmCompatibility } from "@/lib/bpm-lanes";
import { buildCrossfadePlan } from "@/lib/transition-planning";
import type { AutoDjPhase, AutoDjSessionPlan, AutoDjTrackPlan, Track } from "@/types/music";

const phaseCurve = [0.18, 0.42, 0.68, 0.36] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCueLeadSeconds(track: Track) {
  return Math.max(track.transition.mixInPointSeconds - track.transition.introCueSeconds, 0);
}

function getCueReadinessScore(track: Track) {
  const cueLeadSeconds = getCueLeadSeconds(track);
  const grooveReadiness = 1 - clamp(cueLeadSeconds / 18, 0, 1);
  const fadeCoverage = clamp(
    track.transition.crossfadeSeconds / Math.max(cueLeadSeconds, track.transition.beatDurationSeconds, 0.25),
    0,
    1,
  );

  return grooveReadiness * 0.68 + fadeCoverage * 0.32;
}

function getPairTransitionMetrics(previousTrack: Track, candidate: Track) {
  const crossfadePlan = buildCrossfadePlan(previousTrack, candidate, previousTrack.durationSeconds);
  const requestedFadeSeconds = Math.max(
    Math.min(previousTrack.transition.outroMixWindowSeconds, candidate.transition.crossfadeSeconds),
    0.25,
  );
  const incomingRunwaySeconds = Math.max(candidate.transition.mixInPointSeconds - crossfadePlan.incomingStartSeconds, 0);
  const outgoingRunwaySeconds = Math.max(previousTrack.durationSeconds - crossfadePlan.outgoingStartSeconds, 0);
  const fadeCompressionScore = clamp(crossfadePlan.fadeDurationSeconds / requestedFadeSeconds, 0, 1);
  const incomingRunwayScore = clamp(incomingRunwaySeconds / Math.max(crossfadePlan.fadeDurationSeconds, 0.25), 0, 1);
  const outgoingRunwayScore = clamp(outgoingRunwaySeconds / Math.max(crossfadePlan.fadeDurationSeconds, 0.25), 0, 1);
  const transitionStability = incomingRunwayScore * 0.5 + fadeCompressionScore * 0.35 + outgoingRunwayScore * 0.15;
  const abruptnessPenalty =
    (1 - transitionStability) * (previousTrack.bpm === candidate.bpm ? 14 : previousTrack.bpm === 85 && candidate.bpm === 85 ? 18 : 22);

  return {
    crossfadePlan,
    fadeCompressionScore,
    incomingRunwayScore,
    outgoingRunwayScore,
    transitionStability,
    abruptnessPenalty,
  };
}

function getContinuityScore(previousTrack: Track, candidate: Track, phase: AutoDjPhase) {
  const cueReadiness = getCueReadinessScore(candidate);
  const energyDrop = Math.max(previousTrack.energyLevel - candidate.energyLevel, 0);
  const energyLift = Math.max(candidate.energyLevel - previousTrack.energyLevel, 0);
  const sameLane = previousTrack.bpm === candidate.bpm;
  const is85Lane = previousTrack.bpm === 85 && candidate.bpm === 85;
  const continuityBias = sameLane ? (is85Lane ? 18 : 11) : 4;
  const { fadeCompressionScore, incomingRunwayScore, transitionStability, abruptnessPenalty } = getPairTransitionMetrics(
    previousTrack,
    candidate,
  );
  const downshiftPenalty = energyDrop * (cueReadiness < 0.55 ? 20 : cueReadiness < 0.68 ? 13 : 7);
  const liftBonus =
    phase === "lift" ? energyLift * (cueReadiness >= 0.62 ? 7 : 3) : phase === "lock" ? energyLift * 1.5 : 0;

  return (
    continuityBias +
    cueReadiness * 18 +
    transitionStability * 24 +
    fadeCompressionScore * 12 +
    incomingRunwayScore * 10 +
    liftBonus -
    downshiftPenalty -
    abruptnessPenalty
  );
}

function getContinuityLabel(previousTrack: Track, candidate: Track) {
  const cueReadiness = getCueReadinessScore(candidate);
  const energyDrop = previousTrack.energyLevel - candidate.energyLevel;
  const { fadeCompressionScore, incomingRunwayScore, transitionStability, crossfadePlan } = getPairTransitionMetrics(
    previousTrack,
    candidate,
  );

  if (cueReadiness >= 0.72 && energyDrop <= 0.3 && transitionStability >= 0.78) {
    return `心流延續強 · ${crossfadePlan.strategyLabel}`;
  }

  if (cueReadiness >= 0.58 && energyDrop <= 0.8 && transitionStability >= 0.62) {
    return `延續穩定 · ${crossfadePlan.strategyLabel}`;
  }

  if (fadeCompressionScore < 0.68 || incomingRunwayScore < 0.72) {
    return `轉場偏急 · ${crossfadePlan.strategyLabel}`;
  }

  return `可能 downshift · ${crossfadePlan.strategyLabel}`;
}

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

function getPhaseCurveIndex(phase: AutoDjPhase) {
  return phase === "opening" ? 0 : phase === "lock" ? 1 : phase === "lift" ? 2 : 3;
}

function getTargetEnergyForPhase(minEnergy: number, maxEnergy: number, phase: AutoDjPhase) {
  return minEnergy + (maxEnergy - minEnergy) * phaseCurve[getPhaseCurveIndex(phase)];
}

function getCompatibilityScore(previousTrack: Track, candidate: Track, phase: AutoDjPhase, targetEnergy: number) {
  const compatibility = getBpmCompatibility(previousTrack.bpm, candidate.bpm);
  const bpmDiff = Math.abs(previousTrack.bpm - candidate.bpm);
  const energyDiffFromPrevious = Math.abs(previousTrack.energyLevel - candidate.energyLevel);
  const energyDiffFromTarget = Math.abs(candidate.energyLevel - targetEnergy);
  const sharedMoodCount = candidate.moodTags.filter((tag) => previousTrack.moodTags.includes(tag)).length;
  const continuityScore = getContinuityScore(previousTrack, candidate, phase);

  let score =
    (compatibility.status === "exact" ? 120 : compatibility.status === "adjacent" ? 82 : 24) -
    bpmDiff * 4 -
    energyDiffFromPrevious * 7 -
    energyDiffFromTarget * 11 +
    sharedMoodCount * 6 +
    continuityScore;

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

function getLookaheadBonus(previousTrack: Track, pool: Track[], phase: AutoDjPhase, targetEnergy: number) {
  if (pool.length === 0) {
    return 0;
  }

  const rankedScores = pool
    .map((candidate) => getCompatibilityScore(previousTrack, candidate, phase, targetEnergy))
    .sort((left, right) => right - left);
  const bestScore = rankedScores[0] ?? 0;
  const secondScore = rankedScores[1] ?? bestScore;
  const stabilityFloor = Math.min(bestScore, secondScore);

  return bestScore * 0.2 + stabilityFloor * 0.12;
}

function pickOpener(tracks: Track[], minEnergy: number, maxEnergy: number) {
  const targetEnergy = getTargetEnergyForPhase(minEnergy, maxEnergy, "opening");
  const followUpPhase = getPhaseMeta(1, tracks.length).phase;
  const followUpTargetEnergy = getTargetEnergyForPhase(minEnergy, maxEnergy, followUpPhase);

  return [...tracks].sort((left, right) => {
    const leftEnergyScore = Math.abs(left.energyLevel - targetEnergy);
    const rightEnergyScore = Math.abs(right.energyLevel - targetEnergy);
    const leftLookaheadBonus = getLookaheadBonus(
      left,
      tracks.filter((track) => track.id !== left.id),
      followUpPhase,
      followUpTargetEnergy,
    );
    const rightLookaheadBonus = getLookaheadBonus(
      right,
      tracks.filter((track) => track.id !== right.id),
      followUpPhase,
      followUpTargetEnergy,
    );
    const leftScore = leftLookaheadBonus - leftEnergyScore * 24;
    const rightScore = rightLookaheadBonus - rightEnergyScore * 24;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
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
  const opener = initialTrack ?? pickOpener(pool, minEnergy, maxEnergy);

  ordered.push(opener);
  pool.splice(
    pool.findIndex((track) => track.id === opener.id),
    1,
  );

  while (pool.length > 0) {
    const previousTrack = ordered[ordered.length - 1];
    const nextIndex = ordered.length;
    const phaseMeta = getPhaseMeta(nextIndex, playlist.length);
    const targetEnergy = getTargetEnergyForPhase(minEnergy, maxEnergy, phaseMeta.phase);
    const lookaheadPhase = getPhaseMeta(nextIndex + 1, playlist.length).phase;
    const lookaheadTargetEnergy = getTargetEnergyForPhase(minEnergy, maxEnergy, lookaheadPhase);

    const bestCandidate = [...pool].sort((left, right) => {
      const leftDirectScore = getCompatibilityScore(previousTrack, left, phaseMeta.phase, targetEnergy);
      const rightDirectScore = getCompatibilityScore(previousTrack, right, phaseMeta.phase, targetEnergy);
      const leftLookaheadBonus = getLookaheadBonus(
        left,
        pool.filter((track) => track.id !== left.id),
        lookaheadPhase,
        lookaheadTargetEnergy,
      );
      const rightLookaheadBonus = getLookaheadBonus(
        right,
        pool.filter((track) => track.id !== right.id),
        lookaheadPhase,
        lookaheadTargetEnergy,
      );

      return (
        rightDirectScore +
        rightLookaheadBonus -
        (leftDirectScore + leftLookaheadBonus)
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
      ? `${previousTrack.bpm} -> ${track.bpm} BPM，Energy ${previousTrack.energyLevel.toFixed(1)} -> ${track.energyLevel.toFixed(1)}，${getContinuityLabel(previousTrack, track)}`
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
