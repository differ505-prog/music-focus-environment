'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Crosshair, HandMetal, Megaphone, Play, RotateCcw, Timer } from "lucide-react";

import type { ThemeProgram } from "@/types/music";
import type { Track } from "@/types/music";

import { Chip } from "@/components/ui-system";
import { ReviewItemShell, StatCard, StatGrid } from "@/components/review-panel-shell";
import { MoreMenu } from "@/components/more-menu";
import {
  readTrackBpmDetections,
  readTrackReviewOverrides,
  updateTrackReviewOverride,
} from "@/lib/track-review-store";
import { setUserBpmMapping, removeUserBpmMapping } from "@/lib/bpm-user-mappings";
import { useTrackReviewSync } from "@/hooks/use-track-review-sync";
import { extractAllowedBpms } from "@/lib/track-review-store";

type LiveBpmOverrideCardProps = {
  currentTrack: Track | null;
  programs: ThemeProgram[];
  onPlayTrack?: (assetId: string) => void;
};

type TapBpmSnapshot = {
  taps: number[];
  startedAt: number;
};

const TAP_RESET_MS = 4_000;
const TAP_MIN_SAMPLES = 3;
const TAP_MAX_SAMPLES = 24;

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatRelativeLocalTime(date: Date): string {
  return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

/** Client-only relative time. Renders null on server (no hydration mismatch). */
function ClientRelativeTime({ date, className }: { date: Date; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <span className={className}>{formatRelativeLocalTime(date)}</span>;
}

export function LiveBpmOverrideCard({ currentTrack, programs, onPlayTrack }: LiveBpmOverrideCardProps) {
  const refreshTick = useTrackReviewSync();
  const [showLaneMenu, setShowLaneMenu] = useState(false);
  const [customDraft, setCustomDraft] = useState<string>("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [tapState, setTapState] = useState<TapBpmSnapshot>({ taps: [], startedAt: 0 });
  const tapStateRef = useRef<TapBpmSnapshot>({ taps: [], startedAt: 0 });
  const [pulse, setPulse] = useState(0);
  const pulseRef = useRef(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setCustomDraft("");
    setCustomError(null);
    setTapState({ taps: [], startedAt: 0 });
    tapStateRef.current = { taps: [], startedAt: 0 };
  }, [currentTrack?.id]);

  const detection = useMemo(() => {
    if (!currentTrack || !mounted) {
      return null;
    }

    const allDetections = readTrackBpmDetections();
    return allDetections[currentTrack.id] ?? null;
  }, [currentTrack, refreshTick, mounted]);

  const override = useMemo(() => {
    if (!currentTrack || !mounted) {
      return null;
    }

    const overrides = readTrackReviewOverrides();
    return overrides[currentTrack.id] ?? null;
  }, [currentTrack, refreshTick, mounted]);

  const programMap = useMemo(() => new Map(programs.map((program) => [program.id, program] as const)), [programs]);

  const activeProgram = useMemo(() => {
    if (override?.themeProgramId === "uncategorized-lane") {
      return { id: "uncategorized-lane", title: "未分類路線" };
    }

    const programId = override?.themeProgramId ?? currentTrack?.themeProgramId ?? null;
    return programId ? programMap.get(programId) ?? null : null;
  }, [currentTrack, override, programMap]);

  const allowedBpms = useMemo(
    () => extractAllowedBpms(activeProgram && activeProgram.id !== "uncategorized-lane" ? (activeProgram as ThemeProgram) : null),
    [activeProgram],
  );

  const effectiveBpm = override?.bpm ?? currentTrack?.bpm ?? null;
  const detectedBpm = detection?.detectedBpm ?? null;
  const baseBpm = currentTrack?.bpm ?? null;
  const rawDetectedBpm = detection?.rawDetectedBpm ?? null;
  const confidencePercent = detection ? Math.round(detection.confidence * 100) : null;
  const bpmDelta = effectiveBpm != null && baseBpm != null ? Math.abs(effectiveBpm - baseBpm) : 0;

  const registerTap = useCallback(() => {
    const now = Date.now();
    const previous = tapStateRef.current;
    const recentMs = now - (previous.taps[previous.taps.length - 1] ?? previous.startedAt);
    const staleWindowExceeded = previous.taps.length > 0 && recentMs > TAP_RESET_MS;
    const farApart = previous.taps.length === 0 && previous.startedAt > 0 && now - previous.startedAt > TAP_RESET_MS;

    if (staleWindowExceeded || farApart) {
      tapStateRef.current = { taps: [now], startedAt: now };
      setPulse((current) => {
        pulseRef.current = current + 1;
        return pulseRef.current;
      });
      return;
    }

    const lastTapTime = previous.taps[previous.taps.length - 1] ?? previous.startedAt;
    const startTimestamp = previous.taps.length === 0 ? now : (previous.startedAt || lastTapTime);
    const truncatedTaps = (previous.taps.length >= TAP_MAX_SAMPLES
      ? previous.taps.slice(1)
      : previous.taps
    ).concat(now);

    tapStateRef.current = { taps: truncatedTaps, startedAt: startTimestamp };
    setTapState({ taps: truncatedTaps, startedAt: startTimestamp });
    setPulse((current) => {
      pulseRef.current = current + 1;
      return pulseRef.current;
    });
  }, []);

  const resetTaps = useCallback(() => {
    tapStateRef.current = { taps: [], startedAt: 0 };
    setTapState({ taps: [], startedAt: 0 });
  }, []);

  const tapIntervals = useMemo(() => {
    if (tapState.taps.length < 2) {
      return [];
    }

    return tapState.taps.slice(1).map((current, index) => current - tapState.taps[index]);
  }, [tapState.taps]);

  const tapBpm = useMemo(() => {
    if (tapIntervals.length < TAP_MIN_SAMPLES - 1) {
      return null;
    }

    const medianMs = median(tapIntervals);

    if (medianMs <= 0) {
      return null;
    }

    return Math.round((60_000 / medianMs) * 10) / 10;
  }, [tapIntervals]);

  const handleAdoptDetected = useCallback(() => {
    if (!currentTrack || detectedBpm == null) {
      return;
    }

    updateTrackReviewOverride(currentTrack.id, {
      bpm: detectedBpm,
      ignoreBpmMismatch: false,
    });
    setUserBpmMapping({
      trackId: currentTrack.id,
      audioUrl: currentTrack.media.audioUrl,
      confirmedBpm: detectedBpm,
      matchesDetectedBpm: true,
    });
  }, [currentTrack, detectedBpm]);

  const handleApplyTap = useCallback(() => {
    if (!currentTrack || tapBpm == null) {
      return;
    }

    updateTrackReviewOverride(currentTrack.id, {
      bpm: tapBpm,
      ignoreBpmMismatch: false,
    });
    setUserBpmMapping({
      trackId: currentTrack.id,
      audioUrl: currentTrack.media.audioUrl,
      confirmedBpm: tapBpm,
      matchesDetectedBpm: detectedBpm != null && Math.abs(tapBpm - detectedBpm) < 3,
    });
    resetTaps();
  }, [currentTrack, resetTaps, tapBpm, detectedBpm]);

  const handleApplyCustom = useCallback(() => {
    if (!currentTrack) {
      return;
    }

    const parsed = Number.parseFloat(customDraft);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCustomError("請輸入大於 0 的 BPM");
      return;
    }

    const confirmedBpm = Math.round(parsed * 10) / 10;
    updateTrackReviewOverride(currentTrack.id, {
      bpm: confirmedBpm,
      ignoreBpmMismatch: false,
    });
    setUserBpmMapping({
      trackId: currentTrack.id,
      audioUrl: currentTrack.media.audioUrl,
      confirmedBpm,
      matchesDetectedBpm: detectedBpm != null && Math.abs(confirmedBpm - detectedBpm) < 3,
    });
    setCustomDraft("");
    setCustomError(null);
  }, [currentTrack, customDraft, detectedBpm]);

  const handleIgnore = useCallback(() => {
    if (!currentTrack) {
      return;
    }

    updateTrackReviewOverride(currentTrack.id, {
      ignoreBpmMismatch: true,
    });
  }, [currentTrack]);

  const handleClear = useCallback(() => {
    if (!currentTrack) {
      return;
    }

    updateTrackReviewOverride(currentTrack.id, {
      bpm: undefined,
      ignoreBpmMismatch: false,
    });
    removeUserBpmMapping(currentTrack.id, currentTrack.media.audioUrl);
  }, [currentTrack]);

  const handlePlay = useCallback(() => {
    if (!currentTrack || !onPlayTrack) {
      return;
    }
    onPlayTrack(currentTrack.id);
  }, [currentTrack, onPlayTrack]);

  const handleMoveLane = useCallback(
    (laneId: string) => {
      if (!currentTrack) {
        return;
      }

      updateTrackReviewOverride(currentTrack.id, {
        themeProgramId: laneId,
        ignoreBpmMismatch: false,
      });
      setShowLaneMenu(false);
    },
    [currentTrack],
  );

  const runnableLanes = programs.filter((program) => program.id !== "uncategorized-lane");
  const showTapToolbar = currentTrack != null && tapBpm != null;
  const showAdopt = detectedBpm != null && detectedBpm !== effectiveBpm;
  const hasOverride = override?.bpm != null || override?.ignoreBpmMismatch;

  if (!currentTrack) {
    return (
      <ReviewItemShell accentColor="cyan">
        <p className="text-sm leading-7 text-white/62">
          播放或切歌後，此處即時顯示目前曲目的覆寫狀態。
        </p>
      </ReviewItemShell>
    );
  }

  return (
    <ReviewItemShell accentColor="cyan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/58">
            {activeProgram?.title ?? "未指派路線"}
          </p>
          <h3 className="mt-2 text-lg font-medium text-white">{currentTrack.title}</h3>
          <p className="mt-2 text-xs leading-5 text-white/48">
            覆寫即時寫入 localStorage，下次載入前台即可見。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {override?.ignoreBpmMismatch ? (
            <Chip variant="rose">
              <Megaphone className="h-3.5 w-3.5" />
              已忽略警告
            </Chip>
          ) : hasOverride ? (
            <Chip variant="cyan">
              <Check className="h-3.5 w-3.5" />
              已覆核
            </Chip>
          ) : (
            <Chip variant="emerald">
              <Check className="h-3.5 w-3.5" />
              與 Metadata 一致
            </Chip>
          )}
          {detectedBpm != null ? (
            <Chip variant="cyan">
              <Crosshair className="h-3.5 w-3.5" />
              偵測 {detectedBpm} BPM
            </Chip>
          ) : (
            <Chip variant="cyan">
              <Timer className="h-3.5 w-3.5" />
              偵測中…
            </Chip>
          )}
          <span className="text-[11px] tracking-[0.22em] text-white/32">PULSE {pulse.toString().padStart(3, "0")}</span>
        </div>
      </div>

      <StatGrid>
        <StatCard label="Metadata">
          <p className="text-2xl font-semibold text-white">{baseBpm ?? "—"}</p>
          <p className="mt-1 text-xs text-white/48">原始標記</p>
        </StatCard>
        <StatCard label="目前用">
          <p className="text-2xl font-semibold text-white">{effectiveBpm ?? "—"}</p>
          <p className="mt-1 text-xs text-white/48">
            {override?.bpm != null && override.bpm !== baseBpm ? "已覆寫 BPM" : "沿用 metadata"}
          </p>
        </StatCard>
        <StatCard label="Tap BPM">
          <p className="text-2xl font-semibold text-white">{tapBpm ?? "—"}</p>
          <p className="mt-1 text-xs text-white/48">
            {tapState.taps.length > 0 ? `${tapState.taps.length} 次連打` : "跟節拍重複點按"}
          </p>
        </StatCard>
        <StatCard label="可信度">
          <p className="text-2xl font-semibold text-white">{confidencePercent != null ? `${confidencePercent}%` : "—"}</p>
          {rawDetectedBpm != null && rawDetectedBpm !== detectedBpm ? (
            <p className="mt-1 text-xs text-white/48">原始脈衝 {rawDetectedBpm} BPM</p>
          ) : (
            <p className="mt-1 text-xs text-white/48">分析記錄</p>
          )}
        </StatCard>
      </StatGrid>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={registerTap}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            tapState.taps.length > 0
              ? "border-fuchsia-300/40 bg-fuchsia-300/16 text-fuchsia-50 hover:bg-fuchsia-300/22"
              : "border-cyan-300/30 bg-cyan-300/14 text-cyan-100/84 hover:bg-cyan-300/20"
          }`}
        >
          <HandMetal className="mr-1.5 inline h-4 w-4 align-middle" />
          {tapState.taps.length === 0 ? "點按打拍" : `再點一下 (${tapState.taps.length} 拍)`}
        </button>

        {showTapToolbar ? (
          <button
            type="button"
            onClick={handleApplyTap}
            className="rounded-full border border-cyan-300/40 bg-cyan-300/20 px-3 py-2 text-xs text-cyan-50/92 transition hover:bg-cyan-300/28"
          >
            採用 {tapBpm} BPM
          </button>
        ) : null}

        {onPlayTrack ? (
          <button
            type="button"
            onClick={handlePlay}
            aria-label={`播放 ${currentTrack.title}`}
            className="rounded-full border border-emerald-300/40 bg-emerald-300/14 px-3 py-2 text-xs text-emerald-50/90 transition hover:bg-emerald-300/22"
          >
            <Play className="mr-1.5 inline h-3.5 w-3.5 align-middle" />
            播放
          </button>
        ) : null}

        <MoreMenu
          items={[
            ...(showAdopt && detectedBpm != null
              ? [
                  {
                    label: `採用偵測 ${detectedBpm} BPM`,
                    onClick: handleAdoptDetected,
                    variant: "cyan" as const,
                  },
                ]
              : []),
            ...(tapState.taps.length > 0
              ? [
                  {
                    label: "重置 Tap",
                    onClick: resetTaps,
                  },
                ]
              : []),
            ...(hasOverride
              ? [
                  {
                    label: "取消本次覆寫",
                    onClick: handleClear,
                  },
                ]
              : []),
            {
              label: override?.ignoreBpmMismatch ? "已忽略警告" : "忽略此次差異",
              onClick: handleIgnore,
              variant: override?.ignoreBpmMismatch ? "amber" : "default",
            },
            {
              label: "移到別條路線",
              onClick: () => setShowLaneMenu((current) => !current),
            },
            ...(showLaneMenu
              ? runnableLanes.map((program) => ({
                  label: `  ${program.title}`,
                  onClick: () => handleMoveLane(program.id),
                  variant: (activeProgram?.id === program.id ? "cyan" : "default") as "cyan" | "default",
                }))
              : []),
            ...(showLaneMenu
              ? [
                  {
                    label: "  未分類路線",
                    onClick: () => handleMoveLane("uncategorized-lane"),
                    variant: (activeProgram?.id === "uncategorized-lane" ? "amber" : "default") as "amber" | "default",
                  },
                ]
              : []),
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[18px] border border-white/10 bg-black/24 p-3">
        <label className="text-xs uppercase tracking-[0.24em] text-white/42" htmlFor="custom-bpm-input">
          自訂 BPM
        </label>
        <input
          id="custom-bpm-input"
          type="number"
          min={20}
          max={260}
          step="0.5"
          inputMode="decimal"
          value={customDraft}
          placeholder={effectiveBpm != null ? String(effectiveBpm) : "輸入 BPM"}
          onChange={(event) => {
            setCustomDraft(event.target.value);
            setCustomError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleApplyCustom();
            }
          }}
          className="w-28 rounded-full border border-white/14 bg-black/32 px-3 py-2 text-sm text-white focus:border-cyan-300/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleApplyCustom}
          disabled={customDraft.trim().length === 0}
          className="rounded-full border border-cyan-300/30 bg-cyan-300/14 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          寫入覆寫
        </button>
        {allowedBpms.length > 0 ? (
          <span className="text-[11px] tracking-[0.22em] text-white/38">
            允許 {allowedBpms.join(" / ")} BPM
          </span>
        ) : null}
        {customError ? <span className="text-xs text-rose-200">{customError}</span> : null}
        <span className="ml-auto text-[11px] text-white/32">最近一次覆寫：<ClientRelativeTime date={new Date()} /></span>
      </div>
    </ReviewItemShell>
  );
}
