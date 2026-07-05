import { getBpmCompatibility } from "@/lib/bpm-lanes";
import { buildCrossfadePlan } from "@/lib/transition-planning";
import type { AutoDjPhase, AutoDjSessionPlan, AutoDjTrackPlan, Track } from "@/types/music";

const phaseCurve = [0.18, 0.42, 0.68, 0.36] as const;
const routeLookaheadDepth = 3;

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

function getTrackEnduranceMetrics(track: Track) {
  const mixOutBoundarySeconds = Math.min(track.transition.mixOutPointSeconds, track.durationSeconds);
  const postMixWindowSeconds = Math.max(mixOutBoundarySeconds - track.transition.mixInPointSeconds, 0);
  const introWindowSeconds = Math.max(mixOutBoundarySeconds - track.transition.introCueSeconds, 0);
  const tempoLockSeconds = Math.max(
    track.transition.tempoLockBars * track.transition.beatDurationSeconds,
    track.transition.crossfadeSeconds * 2.2,
    10,
  );
  const postMixWindowScore = clamp(postMixWindowSeconds / tempoLockSeconds, 0, 1);
  const introWindowScore = clamp(
    introWindowSeconds / Math.max(tempoLockSeconds + track.transition.crossfadeSeconds, 10),
    0,
    1,
  );
  const enduranceScore = postMixWindowScore * 0.72 + introWindowScore * 0.28;

  return {
    postMixWindowSeconds,
    introWindowSeconds,
    tempoLockSeconds,
    postMixWindowScore,
    introWindowScore,
    enduranceScore,
  };
}

function getDownshiftRiskMetrics(previousTrack: Track, candidate: Track, phase: AutoDjPhase) {
  const cueReadiness = getCueReadinessScore(candidate);
  const energyDrop = Math.max(previousTrack.energyLevel - candidate.energyLevel, 0);
  const sameLane = previousTrack.bpm === candidate.bpm;
  const is85Lane = previousTrack.bpm === 85 && candidate.bpm === 85;
  const bpmDelta = Math.abs(previousTrack.bpm - candidate.bpm);
  const { enduranceScore } = getTrackEnduranceMetrics(candidate);
  const { fadeCompressionScore, incomingRunwayScore, transitionStability } = getPairTransitionMetrics(
    previousTrack,
    candidate,
  );
  const phaseEnergyTolerance = phase === "lift" ? 0.45 : phase === "lock" ? 0.68 : phase === "glide" ? 1.05 : 0.82;
  const energyDropRisk = clamp(energyDrop / phaseEnergyTolerance, 0, 1);
  const cueRisk = 1 - cueReadiness;
  const stabilityRisk = 1 - transitionStability;
  const runwayRisk = 1 - incomingRunwayScore;
  const compressionRisk = 1 - fadeCompressionScore;
  const enduranceRisk = 1 - enduranceScore;
  const laneBreakRisk = sameLane ? 0 : clamp(bpmDelta / 6, 0, 1);
  const riskScore = clamp(
    energyDropRisk * 0.34 +
      cueRisk * 0.18 +
      stabilityRisk * 0.16 +
      runwayRisk * 0.08 +
      compressionRisk * 0.05 +
      enduranceRisk * 0.14 +
      laneBreakRisk * 0.05,
    0,
    1,
  );
  const penaltyBase = is85Lane ? 34 : sameLane ? 27 : 21;
  const hardBlockPenalty = riskScore >= 0.8 ? (is85Lane ? 18 : 13) : riskScore >= 0.66 ? 8 : 0;
  const endurancePenaltyBase = phase === "opening" || phase === "lock" ? (is85Lane ? 14 : 9) : phase === "lift" ? 7 : 4;
  const routeContinuationWeightBase = riskScore >= 0.8 ? 0.12 : riskScore >= 0.66 ? 0.22 : riskScore >= 0.5 ? 0.3 : 0.38;
  const routeContinuationWeight = clamp(routeContinuationWeightBase * (0.72 + enduranceScore * 0.38), 0.08, 0.42);
  const label =
    riskScore >= 0.8
      ? "高 downshift 風險"
      : riskScore >= 0.66
        ? "中高 downshift 風險"
        : riskScore >= 0.5
          ? "可控風險"
          : "低風險";

  return {
    cueReadiness,
    energyDrop,
    sameLane,
    is85Lane,
    enduranceScore,
    riskScore,
    penalty: riskScore * penaltyBase + hardBlockPenalty + enduranceRisk * endurancePenaltyBase,
    routeContinuationWeight,
    label,
  };
}

function getContinuityScore(previousTrack: Track, candidate: Track, phase: AutoDjPhase) {
  const { cueReadiness, sameLane, is85Lane, enduranceScore, penalty: downshiftPenalty } = getDownshiftRiskMetrics(
    previousTrack,
    candidate,
    phase,
  );
  const energyLift = Math.max(candidate.energyLevel - previousTrack.energyLevel, 0);
  const continuityBias = sameLane ? (is85Lane ? 18 : 11) : 4;
  const { fadeCompressionScore, incomingRunwayScore, transitionStability, abruptnessPenalty } = getPairTransitionMetrics(
    previousTrack,
    candidate,
  );
  const liftBonus =
    phase === "lift" ? energyLift * (cueReadiness >= 0.62 ? 7 : 3) : phase === "lock" ? energyLift * 1.5 : 0;

  return (
    continuityBias +
    cueReadiness * 18 +
    transitionStability * 24 +
    enduranceScore * 16 +
    fadeCompressionScore * 12 +
    incomingRunwayScore * 10 +
    liftBonus -
    downshiftPenalty -
    abruptnessPenalty
  );
}

function getContinuityLabel(previousTrack: Track, candidate: Track) {
  const { cueReadiness, energyDrop, enduranceScore, riskScore, label: riskLabel } = getDownshiftRiskMetrics(
    previousTrack,
    candidate,
    "lock",
  );
  const { fadeCompressionScore, incomingRunwayScore, transitionStability, crossfadePlan } = getPairTransitionMetrics(
    previousTrack,
    candidate,
  );

  if (riskScore < 0.42 && cueReadiness >= 0.72 && energyDrop <= 0.3 && transitionStability >= 0.78) {
    return `心流延續強 · ${crossfadePlan.strategyLabel}`;
  }

  if (riskScore < 0.58 && cueReadiness >= 0.58 && energyDrop <= 0.8 && transitionStability >= 0.62) {
    return `延續穩定 · ${crossfadePlan.strategyLabel}`;
  }

  if (fadeCompressionScore < 0.68 || incomingRunwayScore < 0.72) {
    return `轉場偏急 · ${crossfadePlan.strategyLabel}`;
  }

  if (enduranceScore < 0.52) {
    return `續航偏短 · ${crossfadePlan.strategyLabel}`;
  }

  return `${riskLabel} · ${crossfadePlan.strategyLabel}`;
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

function getLaneStreak(tracks: Track[]) {
  const latestTrack = tracks[tracks.length - 1];

  if (!latestTrack) {
    return 0;
  }

  let streak = 0;

  for (let index = tracks.length - 1; index >= 0; index -= 1) {
    if (tracks[index].bpm !== latestTrack.bpm) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function getRouteGuardrailPenalty(previousTrack: Track, candidate: Track, pool: Track[], phase: AutoDjPhase) {
  const compatibility = getBpmCompatibility(previousTrack.bpm, candidate.bpm);
  const hasSameLaneAlternative = pool.some((track) => track.id !== candidate.id && track.bpm === previousTrack.bpm);
  const hasAdjacentAlternative = pool.some(
    (track) => track.id !== candidate.id && getBpmCompatibility(previousTrack.bpm, track.bpm).status !== "distant",
  );
  const is85Lane = previousTrack.bpm === 85;
  let penalty = 0;

  if (hasSameLaneAlternative && candidate.bpm !== previousTrack.bpm) {
    penalty += is85Lane ? 26 : 16;
  }

  if (phase === "lock" && hasSameLaneAlternative && compatibility.status !== "exact") {
    penalty += is85Lane ? 16 : 10;
  }

  if ((phase === "opening" || phase === "lock") && hasAdjacentAlternative && compatibility.status === "distant") {
    penalty += is85Lane ? 34 : 22;
  }

  if (phase === "lift" && compatibility.status === "distant") {
    penalty += 8;
  }

  return penalty;
}

function getDominantBpm(tracks: Track[]) {
  const bpmCounts = new Map<number, number>();

  for (const track of tracks) {
    bpmCounts.set(track.bpm, (bpmCounts.get(track.bpm) ?? 0) + 1);
  }

  return [...bpmCounts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return Math.abs(left[0] - 85) - Math.abs(right[0] - 85);
  })[0]?.[0] ?? null;
}

function getLaneMomentumAdjustment(
  previousTrack: Track,
  candidate: Track,
  phase: AutoDjPhase,
  pool: Track[],
  ordered: Track[],
  dominantBpm: number | null,
) {
  const currentLaneStreak = getLaneStreak(ordered);
  const candidateStaysOnCurrentLane = candidate.bpm === previousTrack.bpm;
  const currentLaneRemainingCount = pool.filter((track) => track.id !== candidate.id && track.bpm === previousTrack.bpm).length;
  const dominantLaneRemainingCount =
    dominantBpm == null ? 0 : pool.filter((track) => track.id !== candidate.id && track.bpm === dominantBpm).length;
  const currentLaneIsDominant = dominantBpm != null && previousTrack.bpm === dominantBpm;
  const candidateOnDominantLane = dominantBpm != null && candidate.bpm === dominantBpm;
  const is85DominantLane = dominantBpm === 85;
  let adjustment = 0;

  if (candidateStaysOnCurrentLane) {
    adjustment += currentLaneStreak >= 2 ? (is85DominantLane ? 16 : 11) : is85DominantLane ? 10 : 6;
    adjustment += Math.min(currentLaneRemainingCount, 3) * (currentLaneIsDominant ? 4 : 2.5);
  }

  if (!candidateStaysOnCurrentLane && currentLaneStreak >= 2 && currentLaneRemainingCount > 0) {
    adjustment -= (is85DominantLane ? 22 : 14) + Math.min(currentLaneRemainingCount, 3) * 3;
  }

  if ((phase === "opening" || phase === "lock") && currentLaneIsDominant && !candidateStaysOnCurrentLane) {
    adjustment -= is85DominantLane ? 18 : 10;
  }

  if ((phase === "opening" || phase === "lock") && candidateOnDominantLane) {
    adjustment += is85DominantLane ? 12 : 7;
  }

  if (phase === "lift" && currentLaneIsDominant && !candidateOnDominantLane && dominantLaneRemainingCount > 0) {
    adjustment -= is85DominantLane ? 14 : 8;
  }

  if (phase === "glide" && candidateStaysOnCurrentLane) {
    adjustment += currentLaneIsDominant ? (is85DominantLane ? 9 : 5) : 3;
  }

  if (phase === "glide" && candidateOnDominantLane && dominantLaneRemainingCount > 0) {
    adjustment += is85DominantLane ? 6 : 3;
  }

  return adjustment;
}

function getCompatibilityScore(
  previousTrack: Track,
  candidate: Track,
  phase: AutoDjPhase,
  targetEnergy: number,
  pool: Track[],
  ordered: Track[],
  dominantBpm: number | null,
) {
  const compatibility = getBpmCompatibility(previousTrack.bpm, candidate.bpm);
  const bpmDiff = Math.abs(previousTrack.bpm - candidate.bpm);
  const energyDiffFromPrevious = Math.abs(previousTrack.energyLevel - candidate.energyLevel);
  const energyDiffFromTarget = Math.abs(candidate.energyLevel - targetEnergy);
  const sharedMoodCount = candidate.moodTags.filter((tag) => previousTrack.moodTags.includes(tag)).length;
  const continuityScore = getContinuityScore(previousTrack, candidate, phase);
  const routeGuardrailPenalty = getRouteGuardrailPenalty(previousTrack, candidate, pool, phase);
  const laneMomentumAdjustment = getLaneMomentumAdjustment(previousTrack, candidate, phase, pool, ordered, dominantBpm);

  let score =
    (compatibility.status === "exact" ? 120 : compatibility.status === "adjacent" ? 82 : 24) -
    bpmDiff * 4 -
    energyDiffFromPrevious * 7 -
    energyDiffFromTarget * 11 +
    sharedMoodCount * 6 +
    continuityScore -
    routeGuardrailPenalty +
    laneMomentumAdjustment;

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

function getRouteContinuationScore(
  previousTrack: Track,
  pool: Track[],
  nextIndex: number,
  total: number,
  minEnergy: number,
  maxEnergy: number,
  depth: number,
  ordered: Track[],
  dominantBpm: number | null,
): number {
  if (pool.length === 0 || depth <= 0 || nextIndex >= total) {
    return 0;
  }

  const phase = getPhaseMeta(nextIndex, total).phase;
  const targetEnergy = getTargetEnergyForPhase(minEnergy, maxEnergy, phase);
  const rankedScores = pool
    .map((candidate) => {
      const directScore = getCompatibilityScore(previousTrack, candidate, phase, targetEnergy, pool, ordered, dominantBpm);
      const { routeContinuationWeight, riskScore } = getDownshiftRiskMetrics(previousTrack, candidate, phase);
      const remainingPool = pool.filter((track) => track.id !== candidate.id);
      const futureScore = getRouteContinuationScore(
        candidate,
        remainingPool,
        nextIndex + 1,
        total,
        minEnergy,
        maxEnergy,
        depth - 1,
        [...ordered, candidate],
        dominantBpm,
      );

      return directScore + futureScore * routeContinuationWeight - riskScore * 6;
    })
    .sort((left, right) => right - left);
  const bestScore = rankedScores[0] ?? 0;
  const secondScore = rankedScores[1] ?? bestScore;
  const thirdScore = rankedScores[2] ?? secondScore;
  const stabilityFloor = Math.min(bestScore, secondScore);

  return bestScore * 0.22 + stabilityFloor * 0.12 + thirdScore * 0.05;
}

function pickOpener(tracks: Track[], minEnergy: number, maxEnergy: number) {
  const targetEnergy = getTargetEnergyForPhase(minEnergy, maxEnergy, "opening");
  const dominantBpm = getDominantBpm(tracks);

  return [...tracks].sort((left, right) => {
    const leftEnergyScore = Math.abs(left.energyLevel - targetEnergy);
    const rightEnergyScore = Math.abs(right.energyLevel - targetEnergy);
    const leftRouteScore = getRouteContinuationScore(
      left,
      tracks.filter((track) => track.id !== left.id),
      1,
      tracks.length,
      minEnergy,
      maxEnergy,
      routeLookaheadDepth,
      [left],
      dominantBpm,
    );
    const rightRouteScore = getRouteContinuationScore(
      right,
      tracks.filter((track) => track.id !== right.id),
      1,
      tracks.length,
      minEnergy,
      maxEnergy,
      routeLookaheadDepth,
      [right],
      dominantBpm,
    );
    const leftLaneBonus = left.bpm === dominantBpm ? 18 : 0;
    const rightLaneBonus = right.bpm === dominantBpm ? 18 : 0;
    const leftScore = leftRouteScore + leftLaneBonus - leftEnergyScore * 24;
    const rightScore = rightRouteScore + rightLaneBonus - rightEnergyScore * 24;

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
  const dominantBpm = getDominantBpm(pool);
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

    const bestCandidate = [...pool].sort((left, right) => {
      const leftDirectScore = getCompatibilityScore(previousTrack, left, phaseMeta.phase, targetEnergy, pool, ordered, dominantBpm);
      const rightDirectScore = getCompatibilityScore(previousTrack, right, phaseMeta.phase, targetEnergy, pool, ordered, dominantBpm);
      const leftRouteScore = getRouteContinuationScore(
        left,
        pool.filter((track) => track.id !== left.id),
        nextIndex + 1,
        playlist.length,
        minEnergy,
        maxEnergy,
        routeLookaheadDepth,
        [...ordered, left],
        dominantBpm,
      );
      const rightRouteScore = getRouteContinuationScore(
        right,
        pool.filter((track) => track.id !== right.id),
        nextIndex + 1,
        playlist.length,
        minEnergy,
        maxEnergy,
        routeLookaheadDepth,
        [...ordered, right],
        dominantBpm,
      );

      return rightDirectScore + rightRouteScore - (leftDirectScore + leftRouteScore);
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
