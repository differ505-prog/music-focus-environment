'use client';

import { useCallback, useEffect, useRef, useState } from "react";

import { Activity } from "lucide-react";

/** Shared flag: true when any TapBpmButton has activated spacebar capture. */
export const tapBpmActiveRef = { current: false };

type UseTapBpmOptions = {
  /** Max number of recent taps to keep in the rolling window. */
  windowSize?: number;
  /** Reset window if no tap arrives within this many ms. */
  resetMs?: number;
  /** Minimum taps required before a BPM number is exposed. */
  minTaps?: number;
};

type TapStats = {
  bpm: number | null;
  sampleCount: number;
  intervalStdDevMs: number | null;
  intervalMeanMs: number | null;
};

const DEFAULT_OPTIONS: Required<UseTapBpmOptions> = {
  windowSize: 8,
  resetMs: 3000,
  minTaps: 2,
};

function computeStats(intervals: number[], minTaps: number): TapStats {
  if (intervals.length < minTaps) {
    return { bpm: null, sampleCount: intervals.length, intervalStdDevMs: null, intervalMeanMs: null };
  }

  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const bpm = 60000 / mean;

  return {
    bpm,
    sampleCount: intervals.length,
    intervalStdDevMs: stdDev,
    intervalMeanMs: mean,
  };
}

export function useTapBpm(options: UseTapBpmOptions = {}) {
  const { windowSize, resetMs, minTaps } = { ...DEFAULT_OPTIONS, ...options };

  const [stats, setStats] = useState<TapStats>({ bpm: null, sampleCount: 0, intervalStdDevMs: null, intervalMeanMs: null });
  const [isActive, setIsActive] = useState(false);
  const tapTimestampsRef = useRef<number[]>([]);
  const lastTapAtRef = useRef<number>(0);

  const reset = useCallback(() => {
    tapTimestampsRef.current = [];
    lastTapAtRef.current = 0;
    setStats({ bpm: null, sampleCount: 0, intervalStdDevMs: null, intervalMeanMs: null });
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    reset();
  }, [reset]);

  const recordTap = useCallback(() => {
    const now = performance.now();
    const last = lastTapAtRef.current;

    if (last > 0 && now - last > resetMs) {
      tapTimestampsRef.current = [now];
    } else {
      tapTimestampsRef.current.push(now);
      if (tapTimestampsRef.current.length > windowSize) {
        tapTimestampsRef.current = tapTimestampsRef.current.slice(-windowSize);
      }
    }

    lastTapAtRef.current = now;

    const intervals: number[] = [];
    for (let i = 1; i < tapTimestampsRef.current.length; i += 1) {
      const prev = tapTimestampsRef.current[i - 1];
      const curr = tapTimestampsRef.current[i];
      if (typeof prev === "number" && typeof curr === "number") {
        intervals.push(curr - prev);
      }
    }

    setStats(computeStats(intervals, minTaps));
  }, [minTaps, resetMs, windowSize]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    tapBpmActiveRef.current = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      recordTap();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      tapBpmActiveRef.current = false;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, recordTap]);

  return { stats, isActive, start: () => setIsActive(true), stop, reset, recordTap };
}

type TapBpmButtonProps = {
  onResult: (bpm: number) => void;
  currentBpm: number;
  allowedBpms: number[];
  disabled?: boolean;
};

export function TapBpmButton({ onResult, currentBpm, allowedBpms, disabled }: TapBpmButtonProps) {
  const { stats, isActive, start, stop, reset } = useTapBpm();
  const nearestLane = allowedBpms.length > 0 && stats.bpm !== null
    ? allowedBpms.reduce((closest, candidate) =>
        Math.abs(candidate - stats.bpm!) < Math.abs(closest - stats.bpm!) ? candidate : closest,
      allowedBpms[0])
    : null;
  const isWithinLane = nearestLane !== null && stats.bpm !== null && Math.abs(nearestLane - stats.bpm) <= 0.5;
  const stabilityLabel = stats.intervalStdDevMs === null
    ? null
    : stats.intervalStdDevMs <= 25
      ? "穩定"
      : stats.intervalStdDevMs <= 60
        ? "略飄"
        : "不穩定";
  const stabilityTone = stats.intervalStdDevMs === null
    ? "text-white/40"
    : stats.intervalStdDevMs <= 25
      ? "text-emerald-200/84"
      : stats.intervalStdDevMs <= 60
        ? "text-amber-200/84"
        : "text-rose-200/84";

  const handleToggle = () => {
    if (isActive) {
      stop();
    } else {
      reset();
      start();
    }
  };

  const handleApply = () => {
    if (stats.bpm === null) {
      return;
    }
    const snapped = nearestLane !== null && isWithinLane ? nearestLane : stats.bpm;
    onResult(Math.round(snapped * 10) / 10);
    stop();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${
          isActive
            ? "border-cyan-300/40 bg-cyan-300/16 text-cyan-50 hover:bg-cyan-300/22"
            : "border-white/10 bg-white/8 text-white/74 hover:border-white/18 hover:text-white"
        } disabled:cursor-not-allowed disabled:opacity-45`}
        aria-pressed={isActive}
        title="空白鍵對拍"
      >
        <Activity className="h-3.5 w-3.5" />
        {isActive ? "Tap 中" : "Tap BPM"}
      </button>

      {isActive ? (
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/78">
          <span className="text-white/56">{stats.sampleCount} taps</span>
          {stats.bpm !== null ? (
            <>
              <span className="text-white/36">·</span>
              <span className="text-base font-semibold text-white">{nearestLane !== null && isWithinLane ? nearestLane : stats.bpm.toFixed(1)}</span>
              {nearestLane !== null && isWithinLane && Math.abs(stats.bpm - nearestLane) >= 0.3 ? (
                <span className="text-xs text-white/30">{stats.bpm.toFixed(1)}</span>
              ) : null}
              <span className="text-white/52">BPM</span>
              {stabilityLabel ? (
                <span className={`text-[10px] uppercase tracking-[0.18em] ${stabilityTone}`}>
                  ±{Math.round(stats.intervalStdDevMs ?? 0)}ms {stabilityLabel}
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleApply}
                className={`ml-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  isWithinLane
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/84 hover:bg-emerald-300/16"
                    : "border-amber-300/20 bg-amber-300/10 text-amber-100/84 hover:bg-amber-300/16"
                }`}
              >
                {              isWithinLane
                  ? `套用 ${nearestLane}`
                  : nearestLane !== null
                    ? `套用 → ${nearestLane}`
                    : `套用 ${stats.bpm.toFixed(1)}`}
              </button>
            </>
          ) : (
            <span className="text-white/40">2 taps min</span>
          )}
          <button
            type="button"
            onClick={reset}
            className="ml-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/62 transition hover:border-white/18 hover:text-white"
          >
            重置
          </button>
        </div>
      ) : null}

      {Math.abs(currentBpm) > 0 ? null : null}
    </div>
  );
}
