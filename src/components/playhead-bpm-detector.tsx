'use client';

import { useCallback, useEffect, useRef, useState } from "react";
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

type PlayheadBpmDetectorProps = {
  track: Track | null;
  /** Current playback position in seconds (driven from parent for auto-analysis) */
  playheadSeconds: number;
  /** BPM lanes for the current track's theme program */
  allowedBpms: number[];
  /** "high" = confident, "medium" = less confident, "low" = unstable */
  onConfidenceTier?: (tier: ConfidenceTier, analysis: BpmAnalysis) => void;
};

export function PlayheadBpmDetector({ track, playheadSeconds, allowedBpms, onConfidenceTier }: PlayheadBpmDetectorProps) {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PlayheadBpmResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adoptedBpm, setAdoptedBpm] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);

  // Reset when track changes
  useEffect(() => {
    if (track?.id !== activeTrackIdRef.current) {
      setIsActive(false);
      setPhase("idle");
      setResult(null);
      setErrorMsg(null);
      setAdoptedBpm(null);
      if (activeTrackIdRef.current && activeTrackIdRef.current !== track?.id) {
        clearPlayheadBpmCache();
      }
      activeTrackIdRef.current = track?.id ?? null;
    }
  }, [track?.id]);

  // Auto-dismiss result popover after 8s
  useEffect(() => {
    if (phase !== "result") return;
    const timer = setTimeout(() => {
      if (phase === "result") {
        setPhase("idle");
        setResult(null);
        setIsActive(false);
      }
    }, 8_000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Auto-trigger analysis when playhead changes and detector is active
  useEffect(() => {
    if (!isActive || phase !== "idle") return;
    // Debounce: only fire after user settles (300ms no further movement)
    const timer = setTimeout(() => {
      void handleAnalyze(playheadSeconds);
    }, 300);
    return () => clearTimeout(timer);
  }, [isActive, playheadSeconds, phase]);

  const handleActivate = useCallback(() => {
    if (!track) return;
    setIsActive((v) => !v);
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setAdoptedBpm(null);
  }, [track]);

  const handleAnalyze = useCallback(async (seekedPlayhead?: number) => {
    if (!track || !track.media.audioUrl) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setPhase("fetching");
    setResult(null);
    setErrorMsg(null);

    try {
      setPhase("analyzing");
      const analysisOffset = typeof seekedPlayhead === "number" ? seekedPlayhead : playheadSeconds;
      const playheadResult = await analyzePlayheadBpmFromUrl(
        track.media.audioUrl,
        allowedBpms,
        { metadataBpm: track.bpm, allowedBpms },
        analysisOffset,
      );

      setResult(playheadResult);
      setPhase("result");

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
      setIsActive(false);
    }
  }, [track, allowedBpms, onConfidenceTier, playheadSeconds]);

  const handleApply = useCallback(() => {
    if (!track || !result) return;
    const bpm = result.analysis.estimatedBpm;
    updateTrackReviewOverride(track.id, { bpm, ignoreBpmMismatch: false });
    setAdoptedBpm(bpm);
    setPhase("applying");
    setTimeout(() => {
      setPhase("idle");
      setResult(null);
      setIsActive(false);
    }, 1_500);
  }, [track, result]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setIsActive(false);
  }, []);

  const isWorking = phase === "fetching" || phase === "analyzing";
  const isResult = phase === "result";
  const tier = result ? confidenceTier(result.analysis.confidence) : null;

  if (!track) return null;

  return (
    <div className="relative flex items-center gap-2">
      {/* Main trigger button */}
      <button
        type="button"
        onClick={handleActivate}
        disabled={isWorking}
        title={isActive ? "結束節奏偵測" : "節奏偵測：拖曳播放點後鬆開，分析 BPM"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
          isActive
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
        {phase === "fetching" ? "下載" : phase === "analyzing" ? "分析" : isActive ? "離開" : "節奏"}
      </button>

      {/* Drag hint — shown when active but not yet triggered */}
      {isActive && phase === "idle" && (
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

      {/* Result popover */}
      {isResult && result && tier && (
        <div
          className="pointer-events-auto absolute bottom-full right-0 mb-2 w-72 rounded-[20px] border border-white/14 bg-[#0a0814]/95 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          role="dialog"
          aria-label="BPM 偵測結果"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{formatRelativeTime()}</p>
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
            <span className="font-serif text-4xl font-semibold text-white">{result.analysis.estimatedBpm}</span>
            <span className="text-sm text-white/52">BPM</span>
            {result.analysis.resolvedByReference && (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">
                參考值
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <span className="text-xs text-white/52">可信度 </span>
              <span className="text-xs font-medium text-white">{formatConfidence(result.analysis.confidence)}</span>
            </div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <span className="text-xs text-white/52">原始 </span>
              <span className="text-xs text-white">{result.analysis.rawDetectedBpm} BPM</span>
            </div>
            {allowedBpms.length > 0 && (
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                <span className="text-xs text-white/52">建議 </span>
                <span className="text-xs font-medium text-cyan-200">{result.analysis.laneSuggestion} BPM</span>
              </div>
            )}
          </div>

          {/* Confidence-tier message */}
          <div
            className={`mt-3 rounded-[14px] border px-3 py-2.5 text-xs leading-5 ${
              tier === "high"
                ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-100/84"
                : tier === "medium"
                  ? "border-amber-300/20 bg-amber-300/8 text-amber-100/84"
                  : "border-rose-300/20 bg-rose-300/8 text-rose-100/84"
            }`}
          >
            {tier === "high"
              ? "偵測穩定，建議直接套用。"
              : tier === "medium"
                ? `候選 ${result.analysis.laneSuggestion} BPM，請確認後套用。`
                : "偵測不穩定，建議使用 Tap BPM 人工確認。"}
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {tier !== "low" ? (
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/14 px-3 py-2 text-xs font-medium text-emerald-100/92 transition hover:bg-emerald-300/22"
              >
                <Check className="h-3.5 w-3.5" />
                套用 {result.analysis.estimatedBpm} BPM
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/72 transition hover:border-white/18 hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
