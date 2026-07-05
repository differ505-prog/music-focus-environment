import type { Track } from "@/types/music";

export type CrossfadePlan = {
  fadeDurationSeconds: number;
  outgoingStartSeconds: number;
  incomingStartSeconds: number;
  targetMixInSeconds: number;
  strategyLabel: string;
  bpmDelta: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function buildCrossfadePlan(
  currentTrack: Track,
  nextTrack: Track,
  currentDurationSeconds: number,
): CrossfadePlan {
  const safeCurrentDuration = Number.isFinite(currentDurationSeconds)
    ? currentDurationSeconds
    : currentTrack.durationSeconds;
  const bpmDelta = Math.abs(currentTrack.bpm - nextTrack.bpm);
  const sharedBeatDurationSeconds = Math.max(
    currentTrack.transition.beatDurationSeconds,
    nextTrack.transition.beatDurationSeconds,
  );
  const requestedFadeDurationSeconds = Math.min(
    currentTrack.transition.outroMixWindowSeconds,
    nextTrack.transition.crossfadeSeconds,
  );
  const adaptiveFadeCapSeconds =
    bpmDelta <= 2
      ? requestedFadeDurationSeconds
      : bpmDelta <= 4
        ? sharedBeatDurationSeconds * 4
        : sharedBeatDurationSeconds * 2;
  const fadeDurationPolicyLabel =
    bpmDelta <= 2
      ? "綠燈同車道"
      : bpmDelta <= 4
        ? "黃燈縮短 1 Bar"
        : "紅燈縮短 2 Beats";
  const fallbackOutgoingStartSeconds = Math.max(
    safeCurrentDuration - Math.min(requestedFadeDurationSeconds, adaptiveFadeCapSeconds),
    currentTrack.transition.introCueSeconds,
  );
  const configuredOutgoingStartSeconds = Number.isFinite(currentTrack.transition.mixOutPointSeconds)
    ? currentTrack.transition.mixOutPointSeconds
    : fallbackOutgoingStartSeconds;
  const outgoingStartSeconds = clamp(
    configuredOutgoingStartSeconds,
    currentTrack.transition.introCueSeconds,
    Math.max(safeCurrentDuration - 0.25, currentTrack.transition.introCueSeconds),
  );
  const availableOutgoingFadeSeconds = Math.max(safeCurrentDuration - outgoingStartSeconds, 0.25);
  const fadeDurationSeconds = Math.max(
    Math.min(requestedFadeDurationSeconds, adaptiveFadeCapSeconds, availableOutgoingFadeSeconds),
    0.25,
  );
  const configuredIncomingStartSeconds = nextTrack.transition.mixInPointSeconds - fadeDurationSeconds;
  const incomingStartSeconds = Math.max(
    nextTrack.transition.introCueSeconds,
    Number.isFinite(configuredIncomingStartSeconds) ? configuredIncomingStartSeconds : nextTrack.transition.introCueSeconds,
  );

  return {
    fadeDurationSeconds,
    outgoingStartSeconds,
    incomingStartSeconds,
    targetMixInSeconds: nextTrack.transition.mixInPointSeconds,
    strategyLabel: `${fadeDurationPolicyLabel} · Δ${bpmDelta} BPM`,
    bpmDelta,
  };
}
