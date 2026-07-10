'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, Crosshair, Loader2, X } from "lucide-react";

import type { BpmAnalysis } from "@/lib/bpm-analyzer";
import {
  analyzePlayheadBpmFromUrl,
  clearPlayheadBpmCache,
  getAudioBuffer,
  type PlayheadBpmResult,
} from "@/lib/playhead-bpm";
import { saveTrackBpmDetection, updateTrackReviewOverride } from "@/lib/track-review-store";
import type { Track } from "@/types/music";

type Phase =
  | "idle"
  | "fetching"
  | "analyzing"
  | "result"
  | "applying";

type ConfidenceTier = "high" | "medium" | "low";

type BpmSample = {
  bpm: number;
  confidence: number;
  laneSuggestion: number;
  count: number;
};

function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.40) return "medium";
  return "low";
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

function formatRelativeTime(): string {
  return new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Client-only time. Renders nothing on server, actual time on client after hydration. */
function ClientTime({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    setTime(formatRelativeTime());
  }, []);

  if (!mounted) return null;
  return <span className={className}>{time}</span>;
}

type PlayheadBpmDetectorProps = {
  track: Track | null;
  /** Current playback position in seconds (driven from parent for auto-analysis) */
  playheadSeconds: number;
  /** Fires on every input/drag event — use to detect when user is actively dragging the seekbar */
  onSeekChange?: (seconds: number) => void;
  /** Whether the track is currently playing — drives the auto-sample interval */
  isPlaying: boolean;
  /** Current playback speed — rate change triggers history reset to avoid mixing pre/post-rate samples */
  playbackRate: number;
  /** BPM lanes for the current track's theme program */
  allowedBpms: number[];
  /** "high" = confident, "medium" = less confident, "low" = unstable */
  onConfidenceTier?: (tier: ConfidenceTier, analysis: BpmAnalysis) => void;
  /** Lifted activation state — stays alive across track changes (controlled by global-player) */
  detectorActive: boolean;
  onDetectorActiveChange: (active: boolean) => void;
};

export function PlayheadBpmDetector({ track, playheadSeconds, onSeekChange, isPlaying, playbackRate, allowedBpms, onConfidenceTier, detectorActive, onDetectorActiveChange }: PlayheadBpmDetectorProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PlayheadBpmResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adoptedBpm, setAdoptedBpm] = useState<number | null>(null);
  /** Accumulated samples for rolling weighted average (confidence-weighted) */
  const [samples, setSamples] = useState<BpmSample[]>([]);
  /** Show the detailed popover when user clicks the live estimate row */
  const [showDetail, setShowDetail] = useState(false);

  /** Weighted rolling average: confidence * count as weight, weighted by confidence */
  const rollingEstimate = useMemo(() => {
    if (samples.length === 0) return null;
    const totalWeight = samples.reduce((sum, s) => sum + s.confidence * s.count, 0);
    if (totalWeight === 0) return null;
    const weightedBpm = samples.reduce((sum, s) => sum + s.bpm * s.confidence * s.count, 0) / totalWeight;
    const avgConfidence = samples.reduce((sum, s) => sum + s.confidence * s.count, 0) / totalWeight;
    const totalCount = samples.reduce((sum, s) => sum + s.count, 0);
    return {
      bpm: Math.round(weightedBpm),
      confidence: avgConfidence,
      count: totalCount,
      // carry the most recent lane suggestion from the last sample
      laneSuggestion: samples[samples.length - 1]?.laneSuggestion ?? null,
    };
  }, [samples]);

  const abortRef = useRef<AbortController | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);
  /** Timestamp of last track change — used to skip auto-samples during the brief window before analysis resumes */
  const trackChangeMsRef = useRef<number>(0);
  /** Consecutive sample count where BPM deviates > 15% from the rolling dominant — triggers auto-reset on beat change */
  const consecutiveShiftRef = useRef(0);
  /** Mirror of detectorActive for use inside closures (avoids stale closure in auto-sample interval) */
  const detectorActiveRef = useRef(detectorActive);
  useEffect(() => { detectorActiveRef.current = detectorActive; }, [detectorActive]);
  /** Tracks whether an analysis is currently in-flight — ref to avoid stale closure vs phase state */
  const isAnalyzingRef = useRef(false);
  /** Always reads the live playheadSeconds value inside setInterval callbacks */
  const playheadSecondsRef = useRef(playheadSeconds);
  useEffect(() => { playheadSecondsRef.current = playheadSeconds; }, [playheadSeconds]);
  /** Previous playback rate — used to detect genuine rate changes vs initial mount */
  const prevPlaybackRateRef = useRef(playbackRate);
  useEffect(() => {
    if (prevPlaybackRateRef.current !== playbackRate) {
      console.log(`[PlayheadBpm] playbackRate changed ${prevPlaybackRateRef.current} → ${playbackRate} → clearing samples`);
      setSamples([]);
      consecutiveShiftRef.current = 0;
      prevPlaybackRateRef.current = playbackRate;
    }
  }, [playbackRate]);

  // Reset analysis state when track changes — but keep detectorActive (button stays lit)
  useEffect(() => {
    if (track?.id !== activeTrackIdRef.current) {
      setPhase("idle");
      setResult(null);
      setErrorMsg(null);
      setAdoptedBpm(null);
      setSamples([]);
      setShowDetail(false);
      trackChangeMsRef.current = Date.now();
      consecutiveShiftRef.current = 0;
      if (activeTrackIdRef.current && activeTrackIdRef.current !== track?.id) {
        clearPlayheadBpmCache();
      }
      activeTrackIdRef.current = track?.id ?? null;
    }
  }, [track?.id]);

  // Auto-dismiss after 8s when nothing happened
  useEffect(() => {
    if (phase !== "idle") return;
    const timer = setTimeout(() => {
      if (phase === "idle") {
        // keep state — only dismiss if still idle
      }
    }, 8_000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Track drag state and fire analysis when user stops dragging (settle trigger)
  useEffect(() => {
    if (!onSeekChange) return;
    onSeekChange(playheadSeconds);
  }, [playheadSeconds, onSeekChange]);

  // Detect drag end: fire analysis after 350ms of no movement
  const prevSecondsRef = useRef(playheadSeconds);
  useEffect(() => {
    if (!detectorActive || isAnalyzingRef.current) return;
    if (playheadSeconds === prevSecondsRef.current) return;
    prevSecondsRef.current = playheadSeconds;
    const timer = setTimeout(() => {
      if (playheadSeconds === prevSecondsRef.current) {
        void handleAnalyzeRef.current(playheadSeconds);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [detectorActive, playheadSeconds, playbackRate]);

  // Auto-sample while playing: fire analysis every 4 seconds.
  // NOTE: intentionally omit playheadSeconds from deps — we read it via ref inside the interval.
  // Adding it would restart the interval on every tick, defeating the 4-second cadence.
  useEffect(() => {
    if (!detectorActive || !isPlaying) return;
    if (isAnalyzingRef.current) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - trackChangeMsRef.current;
      if (elapsed < 500) {
        console.log(`[PlayheadBpm] interval → skipped (${elapsed}ms since track change)`);
        return;
      }
      if (isAnalyzingRef.current) {
        console.log(`[PlayheadBpm] interval → skipped (already analyzing)`);
        return;
      }
      const currentPlayhead = playheadSecondsRef.current;
      console.log(`[PlayheadBpm] interval → analyzing at ${currentPlayhead.toFixed(2)}s`);
      void handleAnalyzeRef.current(currentPlayhead);
    }, 4_000);
    return () => clearInterval(interval);
  }, [detectorActive, isPlaying, isAnalyzingRef]);

  const handleActivate = useCallback(() => {
    if (!track) return;
    onDetectorActiveChange(!detectorActive);
    isAnalyzingRef.current = false; // cancel any in-flight analysis
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setAdoptedBpm(null);
    setSamples([]);
    setShowDetail(false);
  }, [track, detectorActive, onDetectorActiveChange]);

  const handleAnalyze = useCallback(async (seekedPlayhead?: number) => {
    if (!track || !track.media.audioUrl) return;

    // Guard: skip if already analyzing (use ref to avoid stale phase closure)
    if (isAnalyzingRef.current) {
      console.log(`[PlayheadBpm] handleAnalyze skipped (already analyzing)`);
      return;
    }
    isAnalyzingRef.current = true;

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setPhase("fetching");
    setResult(null);
    setErrorMsg(null);

    try {
      setPhase("analyzing");
      // Convert playback-time to audio-file-time (playbackRate 1.2x → playhead 80s = audio 66.7s)
      const audioFileSeconds = (typeof seekedPlayhead === "number" ? seekedPlayhead : playheadSeconds) / playbackRate;
      console.log(`[PlayheadBpm] handleAnalyze → phase=analyzing, playbackTime=${(typeof seekedPlayhead === "number" ? seekedPlayhead : playheadSeconds).toFixed(2)}s, audioFileSeconds=${audioFileSeconds.toFixed(2)}s, playbackRate=${playbackRate}, url=${track.media.audioUrl.slice(0, 40)}…`);
      const playheadResult = await analyzePlayheadBpmFromUrl(
        track.media.audioUrl,
        allowedBpms,
        { metadataBpm: track.bpm, allowedBpms },
        audioFileSeconds,
      );
      console.log(`[PlayheadBpm] analysis complete → bpm=${playheadResult.analysis.estimatedBpm}, confidence=${(playheadResult.analysis.confidence * 100).toFixed(0)}%, audioFileSeconds=${audioFileSeconds.toFixed(2)}s`);

      const newSample: BpmSample = {
        bpm: playheadResult.analysis.estimatedBpm,
        confidence: playheadResult.analysis.confidence,
        laneSuggestion: playheadResult.analysis.laneSuggestion,
        count: 1,
      };
      // Shift check must run inside the functional updater so `prev` is the state
      // *before* the new sample is appended — otherwise it always sees the previous
      // batch and never sees the dominant-vs-new deviation at the right moment.
      setSamples((prev) => {
        console.log(`[PlayheadBpm] shift check → prevSamples=${prev.length}, newBpm=${playheadResult.analysis.estimatedBpm}, detectorActiveRef=${detectorActiveRef.current}`);
        if (prev.length >= 2 && detectorActiveRef.current) {
          const dominantBpm = prev.reduce((best, s) =>
            s.confidence * s.count > best.confidence * best.count ? s : best
          ).bpm;
          const deviation = Math.abs(playheadResult.analysis.estimatedBpm - dominantBpm) / dominantBpm;
          console.log(`[PlayheadBpm] shift calc → dominant=${dominantBpm}, deviation=${(deviation * 100).toFixed(1)}%, consecutive=${consecutiveShiftRef.current}`);
          if (deviation > 0.15) {
            consecutiveShiftRef.current++;
            console.log(`[PlayheadBpm] BPM shift candidate: new=${playheadResult.analysis.estimatedBpm}, dominant=${dominantBpm}, deviation=${(deviation * 100).toFixed(0)}%, consecutive=${consecutiveShiftRef.current}/3`);
            if (consecutiveShiftRef.current >= 3) {
              console.log(`[PlayheadBpm] BPM shift confirmed → auto-resetting detector`);
              consecutiveShiftRef.current = 0;
              // Defer the reset so setState can flush first
              setTimeout(() => {
                setSamples([]);
                void handleActivate();
              }, 0);
              return prev; // don't add the anomalous sample to history
            }
          } else {
            consecutiveShiftRef.current = 0;
          }
        } else {
          console.log(`[PlayheadBpm] shift check skipped → prevSamples.length=${prev.length}, detectorActiveRef=${detectorActiveRef.current}`);
        }
        return [...prev.slice(-9), newSample]; // keep last 10
      });

      const tier = confidenceTier(playheadResult.analysis.confidence);
      onConfidenceTier?.(tier, playheadResult.analysis);

      // Also persist the detection so it shows in other admin panels
      saveTrackBpmDetection({
        trackId: track.id,
        audioUrl: track.media.audioUrl,
        detectedBpm: playheadResult.analysis.estimatedBpm,
        rawDetectedBpm: playheadResult.analysis.rawDetectedBpm,
        confidence: playheadResult.analysis.confidence,
        laneSuggestion: playheadResult.analysis.laneSuggestion,
        peakCount: playheadResult.analysis.peakCount,
        sampleDurationSeconds: playheadResult.analysis.sampleDurationSeconds,
        detectedAt: new Date().toISOString(),
        resolvedByReference: playheadResult.analysis.resolvedByReference,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "分析失敗");
      setPhase("idle");
      onDetectorActiveChange(false);
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [track, allowedBpms, onConfidenceTier, playheadSeconds, playbackRate]);

  const handleAnalyzeRef = useRef(handleAnalyze);
  handleAnalyzeRef.current = handleAnalyze;

  const handleApply = useCallback(() => {
    if (!track) return;
    // Prefer rolling average over single result; fall back to current result
    const bpm = rollingEstimate?.bpm ?? result?.analysis.estimatedBpm;
    if (bpm == null) return;
    updateTrackReviewOverride(track.id, { bpm, ignoreBpmMismatch: false });
    setAdoptedBpm(bpm);
    setPhase("applying");
    setTimeout(() => {
      setPhase("idle");
      setResult(null);
      onDetectorActiveChange(false);
      setSamples([]);
      setShowDetail(false);
    }, 1_500);
  }, [track, result, rollingEstimate, onDetectorActiveChange]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    onDetectorActiveChange(false);
    setSamples([]);
    setShowDetail(false);
  }, [onDetectorActiveChange]);

  const isWorking = phase === "fetching" || phase === "analyzing";
  const rollingTier = rollingEstimate ? confidenceTier(rollingEstimate.confidence) : null;

  if (!track) return null;

  return (
    <div className="relative flex items-center gap-2">
      {/* Main trigger button */}
      <button
        type="button"
        onClick={handleActivate}
        disabled={isWorking}
        title={detectorActive ? "結束節奏偵測" : "節奏偵測：拖曳播放點後鬆開，分析 BPM"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
          detectorActive
            ? "border-fuchsia-300/50 bg-fuchsia-300/20 text-fuchsia-100 shadow-[0_0_16px_rgba(217,70,239,0.22)]"
            : isWorking
              ? "border-white/10 bg-white/6 text-white/40 cursor-not-allowed"
              : "border-white/10 bg-white/8 text-white/72 hover:border-fuchsia-300/30 hover:bg-fuchsia-300/10 hover:text-fuchsia-100"
        }`}
      >
        {isWorking ? (
          phase === "fetching" ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )
        ) : (
          <Crosshair className="h-3.5 w-3.5" />
        )}
        {phase === "fetching" ? "下載" : phase === "analyzing" ? "分析" : detectorActive ? "離開" : "節奏"}
      </button>

      {/* Drag hint — shown when active but not yet triggered */}
      {detectorActive && phase === "idle" && samples.length === 0 && (
        <span className="hidden text-[11px] text-white/36 md:block">
          拖曳進度條後放開，以分析 BPM
        </span>
      )}

      {/* Error */}
      {errorMsg && (
        <span className="text-xs text-rose-300">{errorMsg}</span>
      )}

      {/* Adopted feedback */}
      {phase === "applying" && adoptedBpm !== null && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/14 px-3 py-1.5 text-xs text-emerald-100">
          <Check className="h-3 w-3" />
          已套用 {adoptedBpm} BPM
        </span>
      )}

      {/* Live rolling estimate — click to open detail popover */}
      {rollingEstimate && phase !== "applying" && (
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="group inline-flex items-center gap-2 rounded-full border bg-black/40 px-3 py-1.5 text-xs backdrop-blur-sm transition hover:border-white/20"
          title="點我看偵測詳情"
        >
          <Activity className="h-3 w-3 text-fuchsia-300/70" />
          {isWorking ? (
            <>
              <span className="text-white/52">
                {Math.round(rollingEstimate.bpm * playbackRate)}
              </span>
              <span className="text-white/32">BPM</span>
              <span className="text-white/24 animate-pulse">·</span>
            </>
          ) : (
            <>
              <span className={`font-serif text-base font-semibold ${
                rollingTier === "high"
                  ? "text-emerald-200"
                  : rollingTier === "medium"
                    ? "text-amber-200"
                    : "text-rose-200"
              }`}>
                {Math.round(rollingEstimate.bpm * playbackRate)}
              </span>
              <span className="text-white/32">BPM</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 text-[10px] text-white/40">
                {rollingEstimate.count}次
              </span>
              <span className="text-white/20 text-[10px]">
                {formatConfidence(rollingEstimate.confidence)}
              </span>
            </>
          )}
        </button>
      )}

      {/* Detail popover — left-anchored so it never clips off-screen */}
      {showDetail && (
        <div
          className="pointer-events-auto absolute bottom-full left-0 mb-2 w-72 rounded-[20px] border border-white/14 bg-[#0a0814]/95 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          role="dialog"
          aria-label="BPM 偵測結果"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/42"><ClientTime /></p>
              <p className="mt-1 text-sm font-medium text-white/78">節奏偵測結果</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-white/10 p-1 text-white/42 transition hover:border-white/22 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* BPM display */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-4xl font-semibold text-white">
              {Math.round((result?.analysis.estimatedBpm ?? rollingEstimate?.bpm ?? 0) * playbackRate)}
            </span>
            <span className="text-sm text-white/52">BPM</span>
            {playbackRate !== 1 && (
              <span className="rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 text-[10px] text-white/40">
                原 {result?.analysis.estimatedBpm ?? rollingEstimate?.bpm ?? "—"} · {playbackRate}×
              </span>
            )}
            {result?.analysis.resolvedByReference && (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">
                參考值
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <span className="text-xs text-white/52">可信度 </span>
              <span className="text-xs font-medium text-white">{formatConfidence(result?.analysis.confidence ?? rollingEstimate?.confidence ?? 0)}</span>
            </div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <span className="text-xs text-white/52">原始 </span>
              <span className="text-xs text-white">{result?.analysis.rawDetectedBpm ?? "—"} BPM</span>
            </div>
            {allowedBpms.length > 0 && (
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                <span className="text-xs text-white/52">建議 </span>
                <span className="text-xs font-medium text-cyan-200">{result?.analysis.laneSuggestion ?? rollingEstimate?.laneSuggestion ?? "—"} BPM</span>
              </div>
            )}
          </div>

          {/* Confidence-tier message */}
          {rollingTier && (
            <div
              className={`mt-3 rounded-[14px] border px-3 py-2.5 text-xs leading-5 ${
                rollingTier === "high"
                  ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-100/84"
                  : rollingTier === "medium"
                    ? "border-amber-300/20 bg-amber-300/8 text-amber-100/84"
                    : "border-rose-300/20 bg-rose-300/8 text-rose-100/84"
              }`}
            >
              {rollingTier === "high"
                ? "偵測穩定，建議直接套用。"
                : rollingTier === "medium"
                  ? `候選 ${rollingEstimate?.laneSuggestion ?? result?.analysis.laneSuggestion ?? "—"} BPM，請確認後套用。`
                  : "偵測不穩定，建議使用 Tap BPM 人工確認。"}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {rollingTier !== "low" ? (
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/14 px-3 py-2 text-xs font-medium text-emerald-100/92 transition hover:bg-emerald-300/22"
              >
                <Check className="h-3.5 w-3.5" />
                套用 {rollingEstimate?.bpm ?? result?.analysis.estimatedBpm} BPM
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/72 transition hover:border-white/18 hover:text-white"
            >
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
