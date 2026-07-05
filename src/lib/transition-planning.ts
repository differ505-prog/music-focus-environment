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

function quantizeFadeDurationSeconds(
  maxFadeDurationSeconds: number,
  beatDurationSeconds: number,
  bpmDelta: number,
) {
  const safeMaxFadeDurationSeconds = Math.max(maxFadeDurationSeconds, 0.25);
  const safeBeatDurationSeconds = Math.max(beatDurationSeconds, 0.25);
  const preferredBeatBlock =
    bpmDelta <= 2 ? 4 : bpmDelta <= 4 ? 2 : 1;
  const preferredStepSeconds = safeBeatDurationSeconds * preferredBeatBlock;
  const beatStepSeconds = safeBeatDurationSeconds;
  const quantizeDown = (value: number, step: number) => Math.floor(value / step) * step;
  const preferredQuantizedSeconds = quantizeDown(safeMaxFadeDurationSeconds, preferredStepSeconds);

  if (preferredQuantizedSeconds >= Math.max(safeMaxFadeDurationSeconds * 0.78, 0.25)) {
    return {
      fadeDurationSeconds: preferredQuantizedSeconds,
      alignmentLabel: preferredBeatBlock >= 4 ? "整 Bar 對齊" : preferredBeatBlock === 2 ? "雙拍對齊" : "單拍對齊",
    };
  }

  const beatQuantizedSeconds = quantizeDown(safeMaxFadeDurationSeconds, beatStepSeconds);

  if (beatQuantizedSeconds >= 0.25) {
    return {
      fadeDurationSeconds: beatQuantizedSeconds,
      alignmentLabel: "單拍對齊",
    };
  }

  return {
    fadeDurationSeconds: safeMaxFadeDurationSeconds,
    alignmentLabel: "自由對齊",
  };
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
  const availableIncomingFadeSeconds = Math.max(
    nextTrack.transition.mixInPointSeconds - nextTrack.transition.introCueSeconds,
    0.25,
  );
  const maxStructuredFadeDurationSeconds = Math.max(
    Math.min(
      requestedFadeDurationSeconds,
      adaptiveFadeCapSeconds,
      availableIncomingFadeSeconds,
    ),
    0.25,
  );
  const { fadeDurationSeconds, alignmentLabel } = quantizeFadeDurationSeconds(
    maxStructuredFadeDurationSeconds,
    sharedBeatDurationSeconds,
    bpmDelta,
  );
  const preferredOutgoingStartSeconds = clamp(
    safeCurrentDuration - fadeDurationSeconds,
    currentTrack.transition.introCueSeconds,
    Math.max(safeCurrentDuration - 0.25, currentTrack.transition.introCueSeconds),
  );
  const outgoingStartSeconds = clamp(
    Math.min(configuredOutgoingStartSeconds, preferredOutgoingStartSeconds),
    currentTrack.transition.introCueSeconds,
    Math.max(safeCurrentDuration - 0.25, currentTrack.transition.introCueSeconds),
  );
  const configuredIncomingStartSeconds = nextTrack.transition.mixInPointSeconds - fadeDurationSeconds;
  const incomingStartSeconds = Math.max(
    nextTrack.transition.introCueSeconds,
    Number.isFinite(configuredIncomingStartSeconds) ? configuredIncomingStartSeconds : nextTrack.transition.introCueSeconds,
  );
  const outgoingAnchorLabel =
    outgoingStartSeconds < configuredOutgoingStartSeconds - 0.01 ? "回推 Mix Out" : "沿用 Mix Out";

  return {
    fadeDurationSeconds,
    outgoingStartSeconds,
    incomingStartSeconds,
    targetMixInSeconds: nextTrack.transition.mixInPointSeconds,
    strategyLabel: `${fadeDurationPolicyLabel} · ${alignmentLabel} · ${outgoingAnchorLabel} · Δ${bpmDelta} BPM`,
    bpmDelta,
  };
}
