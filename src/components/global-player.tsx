'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, Volume2, VolumeX, Waves } from "lucide-react";

import { bpmOptions, themePrograms } from "@/data/music-assets";
import { PlayerArtworkStage } from "@/components/player-artwork-stage";
import { PlayerHeaderBar } from "@/components/player-header-bar";
import { PlayerPlaylistStrip } from "@/components/player-playlist-strip";
import { PlayerProgressBar } from "@/components/player-progress-bar";
import { PlayerTransportControls } from "@/components/player-transport-controls";
import { PlayheadBpmDetector } from "@/components/playhead-bpm-detector";
import { TapBpmButton } from "@/components/tap-bpm-button";
import { useArtworkProjection } from "@/hooks/use-artwork-projection";
import type { BpmAnalysis } from "@/lib/bpm-analyzer";
import { detectTrackBpmFromUrl, detectTrackBpmMultiSegment } from "@/lib/track-bpm-detection";
import type { BpmSegmentResult } from "@/lib/track-bpm-detection";
import { getBpmCompatibility } from "@/lib/bpm-lanes";
import { extractAllowedBpms, updateTrackReviewOverride, saveTrackBpmDetection } from "@/lib/track-review-store";
import { getUserBpmMapping } from "@/lib/bpm-user-mappings";
import type { AutoDjSessionPlan, PlaybackSnapshot, Track } from "@/types/music";

type GlobalPlayerProps = {
  playlist: Track[];
  currentTrack: Track | null;
  nextTrack: Track | null;
  sessionPlan: AutoDjSessionPlan | null;
  playback: PlaybackSnapshot;
  isMinimized: boolean;
  mode?: "public" | "admin";
  onPlayPause: () => void;
  onToggleRepeat: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onSeekBy: (deltaSeconds: number) => void;
  onPlayTrack: (assetId: string) => void;
  onToggleMinimize: () => void;
  onClose: () => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
};

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "00:00";
  }

  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

type TrackBpmDetectionState =
  | { status: "idle" | "loading" }
  | { status: "ready"; result: BpmAnalysis }
  | { status: "error"; message: string };

const confidenceFloor = 0.6;
const detectedBpmCache = new Map<string, BpmAnalysis>();
const inspectionLog = new Map<string, "passed" | "rejected">();

export function GlobalPlayer({
  playlist,
  currentTrack,
  nextTrack,
  sessionPlan,
  playback,
  isMinimized,
  mode = "public",
  onPlayPause,
  onToggleRepeat,
  onPrevious,
  onNext,
  onSeek,
  onSeekBy,
  onPlayTrack,
  onToggleMinimize,
  onClose,
  onVolumeChange,
  onPlaybackRateChange,
}: GlobalPlayerProps) {
  const showAdminDetails = mode === "admin";
  const [detectedBpmState, setDetectedBpmState] = useState<TrackBpmDetectionState>({ status: "idle" });
  /** Controls PlayheadBpmDetector activation across track changes (avoids local state reset on unmount) */
  const [detectorActive, setDetectorActive] = useState(false);
  /** Manual continuous BPM analysis toggle (admin only, off by default) */
  const [continuousAnalysisEnabled, setContinuousAnalysisEnabled] = useState(false);
  const continuousAnalysisRef = useRef(false);
  /** Non-reactive snapshot for use inside async loops (avoids effect restart on every tick) */
  const playheadRef = useRef(playback.currentTime);
  const durationRef = useRef(playback.duration);
  const [manualOverrideCount, setManualOverrideCount] = useState(0);
  const lastResultRef = useRef<BpmAnalysis | null>(null);
  const prevTrackRef = useRef<Track | null>(null);
  /** Best result from continuous analysis (high-confidence only, for one-click apply) */
  const [continuousBestResult, setContinuousBestResult] = useState<{
    bpm: number;
    confidence: number;
    startSeconds: number;
  } | null>(null);
  const [liveSeekSeconds, setLiveSeekSeconds] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(playback.playbackRate);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Sync local playbackRate state with the controller's value from playback prop
  useEffect(() => {
    setPlaybackRate(playback.playbackRate);
  }, [playback.playbackRate]);

  // When playback rate changes while the detector is active, auto-extinguish and re-ignite
  // so the detector clears its state and starts sampling fresh at the new rate.
  useEffect(() => {
    console.log(`[Player] playbackRate effect → rate=${playbackRate}, detectorActive=${detectorActive}`);
    if (!detectorActive) return;
    const timer = setTimeout(() => {
      console.log(`[Player] playbackRate effect → re-igniting detector`);
      setDetectorActive(true);
    }, 600);
    setDetectorActive(false);
    return () => clearTimeout(timer);
  }, [playbackRate]);

  const playbackRateOptions = [0.75, 1, 1.25, 1.5] as const;
  const themeProgramMap = useMemo(() => new Map(themePrograms.map((program) => [program.id, program] as const)), []);
  const currentProgram = currentTrack?.themeProgramId ? (themeProgramMap.get(currentTrack.themeProgramId) ?? null) : null;
  const allowedBpms = useMemo(() => extractAllowedBpms(currentProgram), [currentProgram]);
  const artworkSrc = useMemo(() => currentTrack?.media.coverImageUrl ?? "", [currentTrack?.media.coverImageUrl]);
  const {
    artworkContainerRef,
    isArtworkOpen,
    isProjectionMode,
    isArtworkFullscreen,
    isProjectionHudVisible,
    isProjectionCursorHidden,
    isPureProjection,
    openArtwork,
    closeArtwork,
    revealProjectionHud,
    toggleArtworkFullscreen,
  } = useArtworkProjection({
    enabled: Boolean(currentTrack && artworkSrc),
  });
  const currentTrackPlan = useMemo(() => {
    if (!sessionPlan || !currentTrack) {
      return null;
    }

    return sessionPlan.trackPlans.find((plan) => plan.trackId === currentTrack.id) ?? null;
  }, [currentTrack, sessionPlan]);
  const nextTrackPlan = useMemo(() => {
    if (!sessionPlan || !nextTrack) {
      return null;
    }

    return sessionPlan.trackPlans.find((plan) => plan.trackId === nextTrack.id) ?? null;
  }, [nextTrack, sessionPlan]);
  useEffect(() => {
    let cancelled = false;

    async function detectTrackBpm(track: Track) {
      if (typeof window === "undefined" || !window.AudioContext) {
        setDetectedBpmState({ status: "error", message: "目前環境不支援 BPM 偵測" });
        return;
      }

      const cacheKey = `${track.id}:${track.media.audioUrl}`;

      // ── Feedback Loop ──
      // User-confirmed BPM has highest priority: skip analysis and use it directly.
      const userMapping = getUserBpmMapping(track.id, track.media.audioUrl);
      if (userMapping) {
        // Cast: user-confirmed BPM bypasses system analysis, segments/candidates are not applicable.
        const confirmedResult = {
          estimatedBpm: userMapping.confirmedBpm,
          rawDetectedBpm: userMapping.confirmedBpm,
          normalizedBpm: userMapping.confirmedBpm,
          confidence: 1,
          laneSuggestion: 0,
          peakCount: 0,
          candidates: [],
          sampleDurationSeconds: 0,
          resolvedByReference: true,
        } as BpmAnalysis;
        detectedBpmCache.set(cacheKey, confirmedResult);
        lastResultRef.current = confirmedResult;
        setDetectedBpmState({ status: "ready", result: confirmedResult });
        return;
      }

      const cached = detectedBpmCache.get(cacheKey);

      if (cached) {
        lastResultRef.current = cached;
        setDetectedBpmState({ status: "ready", result: cached });
        return;
      }

      setDetectedBpmState({ status: "loading" });

      try {
        const allowedBpms = extractAllowedBpms(
          track.themeProgramId ? (themeProgramMap.get(track.themeProgramId) ?? null) : null,
        );
        const result = await detectTrackBpmMultiSegment(track.media.audioUrl, bpmOptions, {
          metadataBpm: track.bpm,
          allowedBpms,
        });

        if (result.confidence >= confidenceFloor) {
          detectedBpmCache.set(cacheKey, result);
          inspectionLog.set(cacheKey, "passed");
        } else {
          inspectionLog.set(cacheKey, "rejected");
          console.warn(
            `[Player] BPM multi-segment detection rejected (confidence ${result.confidence.toFixed(2)} < ${confidenceFloor}) for "${track.title}" → ${result.estimatedBpm} BPM (${result.agreeingSegments}/${result.segments.length} segments agreed)`,
          );
        }
        saveTrackBpmDetection({
          trackId: track.id,
          audioUrl: track.media.audioUrl,
          detectedBpm: result.estimatedBpm,
          rawDetectedBpm: result.rawDetectedBpm,
          confidence: result.confidence,
          laneSuggestion: result.laneSuggestion,
          peakCount: result.peakCount,
          sampleDurationSeconds: result.sampleDurationSeconds,
          detectedAt: new Date().toISOString(),
          resolvedByReference: result.resolvedByReference,
        });

        if (!cancelled) {
          lastResultRef.current = result;
          setDetectedBpmState(
            result.confidence >= confidenceFloor
              ? { status: "ready", result }
              : {
                  status: "error",
                  message: `共識失敗 ${result.agreeingSegments}/${result.segments.length} 段`,
                },
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDetectedBpmState({
            status: "error",
            message: error instanceof Error ? error.message : "BPM 偵測失敗",
          });
        }
      }
    }

    if (!currentTrack?.media.audioUrl) {
      setDetectedBpmState({ status: "idle" });
      lastResultRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    const prevTrackId = prevTrackRef.current?.id ?? null;
    const prevAudioUrl = prevTrackRef.current?.media?.audioUrl ?? null;
    const cacheKey = `${currentTrack.id}:${currentTrack.media.audioUrl}`;

    // Same track (e.g., navigated back) — show last known result immediately, but
    // only when the cached result has passed the confidence gate. Rejected detections
    // are re-run so the next sample (e.g., after the listener's audio engine warms up)
    // can still produce a usable answer.
    if (prevTrackId === currentTrack.id && prevAudioUrl === currentTrack.media.audioUrl) {
      const cached = detectedBpmCache.get(cacheKey);
      const inspection = inspectionLog.get(cacheKey);
      if (cached && inspection === "passed") {
        lastResultRef.current = cached;
        setDetectedBpmState({ status: "ready", result: cached });
        setContinuousBestResult(null);
      } else if (lastResultRef.current && lastResultRef.current.confidence >= confidenceFloor) {
        setDetectedBpmState({ status: "ready", result: lastResultRef.current });
        setContinuousBestResult(null);
      }
      prevTrackRef.current = currentTrack;
      return () => {
        cancelled = true;
      };
    }

    prevTrackRef.current = currentTrack;
    setContinuousBestResult(null);
    void detectTrackBpm(currentTrack);

    return () => {
      cancelled = true;
    };
  }, [currentTrack, themeProgramMap]);

  // Keep playhead/duration refs in sync with playback state (no re-renders for the async loop)
  useEffect(() => {
    playheadRef.current = playback.currentTime;
    durationRef.current = playback.duration;
  }, [playback.currentTime, playback.duration]);

  // ── Continuous BPM Analysis (admin, manual toggle) ──
  useEffect(() => {
    if (!continuousAnalysisEnabled || !currentTrack) return;

    const runAnalysis = async () => {
      const allowedBpms = extractAllowedBpms(
        currentTrack.themeProgramId ? (themeProgramMap.get(currentTrack.themeProgramId) ?? null) : null,
      );

      const SEGMENT_WINDOW = 30; // seconds before/after playhead
      const SEGMENT_DURATION = 32; // seconds per analysis slice (from bpm-analyzer.ts)
      const AUDIO_BUFFER_SECONDS = 120; // how many seconds analyzeAudioBufferForBpm reads from startSeconds

      const buildSegments = (playheadSeconds: number): { startSeconds: number }[] => {
        const half = SEGMENT_WINDOW / 2;
        const raw = [
          playheadSeconds - half,
          playheadSeconds,
          playheadSeconds + half,
        ];
        return raw.map((s) => ({ startSeconds: Math.max(0, s) }));
      };

      while (continuousAnalysisRef.current) {
        const playheadSeconds = playheadRef.current;
        const segments = buildSegments(playheadSeconds);
        let bestSegment: { startSeconds: number; estimatedBpm: number; confidence: number } | null = null;

        await detectTrackBpmMultiSegment(currentTrack.media.audioUrl, bpmOptions, {
          metadataBpm: currentTrack.bpm,
          allowedBpms,
        }, segments, (_segmentIndex, _totalSegments, segResult) => {
          if (!continuousAnalysisRef.current) return;
          if (!bestSegment || segResult.confidence > bestSegment.confidence) {
            bestSegment = {
              startSeconds: segResult.startSeconds,
              estimatedBpm: segResult.estimatedBpm,
              confidence: segResult.confidence,
            };
          }
        });

        if (bestSegment) {
          setContinuousBestResult(bestSegment);
        }
      }
    };

    continuousAnalysisRef.current = true;
    void runAnalysis();

    return () => {
      continuousAnalysisRef.current = false;
    };
  }, [continuousAnalysisEnabled, currentTrack, themeProgramMap]);

  const detectedBpmMeta = useMemo(() => {
    if (!currentTrack || detectedBpmState.status !== "ready") {
      return null;
    }

    const detectedBpm = detectedBpmState.result.estimatedBpm;
    const rawDetectedBpm = detectedBpmState.result.rawDetectedBpm;
    const perceivedBpm = Math.round(detectedBpm * playbackRate);
    const diff = Math.abs(currentTrack.bpm - detectedBpm);
    const compatibility = getBpmCompatibility(currentTrack.bpm, detectedBpm);

    return {
      detectedBpm,
      rawDetectedBpm,
      perceivedBpm,
      diff,
      confidencePercent: Math.round(detectedBpmState.result.confidence * 100),
      compatibility,
      resolvedByReference: detectedBpmState.result.resolvedByReference,
    };
  }, [currentTrack, detectedBpmState, playbackRate]);
  const transitionMeta = useMemo(() => {
    if (!currentTrack || !nextTrack) {
      return null;
    }

    return {
      outStartLabel: playback.crossfadeOutStartSeconds != null ? formatTime(playback.crossfadeOutStartSeconds) : null,
      inStartLabel: playback.crossfadeInStartSeconds != null ? formatTime(playback.crossfadeInStartSeconds) : null,
      targetMixInLabel:
        playback.crossfadeTargetMixInSeconds != null ? formatTime(playback.crossfadeTargetMixInSeconds) : null,
      fadeWindowLabel: `${playback.crossfadeWindowSeconds.toFixed(2)}s`,
    };
  }, [currentTrack, nextTrack, playback]);
  const progressMarkers = useMemo(() => {
    if (!showAdminDetails || !transitionMeta || playback.crossfadeOutStartSeconds == null) {
      return [];
    }

    return [
      {
        seconds: playback.crossfadeOutStartSeconds,
        label: "Mix Out",
        tone: "fuchsia" as const,
      },
    ];
  }, [showAdminDetails, transitionMeta, playback.crossfadeOutStartSeconds]);
  const progressRanges = useMemo(() => {
    if (
      !showAdminDetails ||
      !transitionMeta ||
      playback.crossfadeOutStartSeconds == null ||
      playback.duration <= 0
    ) {
      return [];
    }

    return [
      {
        startSeconds: playback.crossfadeOutStartSeconds,
        endSeconds: playback.duration,
        label: playback.isCrossfading ? "進行中 Crossfade" : "預定 Crossfade",
        tone: "fuchsia" as const,
      },
    ];
  }, [showAdminDetails, transitionMeta, playback.crossfadeOutStartSeconds, playback.duration, playback.isCrossfading]);
  const nextTrackProgressMarkers = useMemo(() => {
    if (
      !showAdminDetails ||
      !transitionMeta ||
      nextTrack == null ||
      playback.crossfadeInStartSeconds == null ||
      playback.crossfadeTargetMixInSeconds == null
    ) {
      return [];
    }

    return [
      {
        seconds: playback.crossfadeInStartSeconds,
        label: "Next In",
        tone: "cyan" as const,
      },
      {
        seconds: playback.crossfadeTargetMixInSeconds,
        label: "Target Mix In",
        tone: "amber" as const,
      },
    ];
  }, [
    showAdminDetails,
    transitionMeta,
    nextTrack,
    playback.crossfadeInStartSeconds,
    playback.crossfadeTargetMixInSeconds,
  ]);
  const nextTrackProgressRanges = useMemo(() => {
    if (
      !showAdminDetails ||
      !transitionMeta ||
      nextTrack == null ||
      playback.crossfadeInStartSeconds == null ||
      playback.crossfadeTargetMixInSeconds == null
    ) {
      return [];
    }

    return [
      {
        startSeconds: playback.crossfadeInStartSeconds,
        endSeconds: playback.crossfadeTargetMixInSeconds,
        label: "Next Crossfade Zone",
        tone: "cyan" as const,
      },
    ];
  }, [
    showAdminDetails,
    transitionMeta,
    nextTrack,
    playback.crossfadeInStartSeconds,
    playback.crossfadeTargetMixInSeconds,
  ]);
  const transitionDeltaToneClass = useMemo(() => {
    const bpmDelta = playback.transitionBpmDelta;

    if (bpmDelta == null) {
      return null;
    }

    if (bpmDelta <= 2) {
      return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/85";
    }

    if (bpmDelta <= 4) {
      return "border-amber-300/20 bg-amber-300/10 text-amber-100/85";
    }

    return "border-rose-300/20 bg-rose-300/10 text-rose-100/85";
  }, [playback.transitionBpmDelta]);

  const publicTrackSummary = currentTrack
    ? `${currentTrack.bpm} BPM · 約 ${Math.round(currentTrack.durationSeconds / 60)} 分鐘`
    : null;
  const artworkDetailLine = currentTrack
    ? `${showAdminDetails
        ? `${currentTrack.bpm} BPM · ${currentTrack.musicalKey} · Energy ${currentTrack.energyLevel.toFixed(1)}`
        : publicTrackSummary}${playback.repeatEnabled ? " · 循環播放" : ""}`
    : "";
  const artworkFooterLabel = showAdminDetails && sessionPlan
    ? `${sessionPlan.currentPhaseLabel} · ${sessionPlan.laneLabel}`
    : nextTrack
      ? `下一首 ${nextTrack.title}`
      : isProjectionMode
        ? "封面"
        : "雙擊全螢幕";
  const playerStateLabel = playback.isCrossfading ? "連續流動" : playback.isPlaying ? "穩定播放" : "待命";
  const engineLabel = playback.prefersBackgroundPlayback ? "背景模式" : "精準轉場";

  const artworkStage = currentTrack && artworkSrc ? (
    <PlayerArtworkStage
      artworkContainerRef={artworkContainerRef}
      artworkSrc={artworkSrc}
      trackTitle={currentTrack.title}
      detailLine={artworkDetailLine}
      footerLabel={artworkFooterLabel}
      isProjectionMode={isProjectionMode}
      isArtworkFullscreen={isArtworkFullscreen}
      isPureProjection={isPureProjection}
      isProjectionHudVisible={isProjectionHudVisible}
      isProjectionCursorHidden={isProjectionCursorHidden}
      onBackgroundClick={
        !isProjectionMode && !isArtworkFullscreen
          ? (event) => {
              if (event.target === event.currentTarget) {
                void closeArtwork();
              }
            }
          : undefined
      }
      onRevealHud={revealProjectionHud}
      onToggleFullscreen={(event) => {
        event.stopPropagation();
        void toggleArtworkFullscreen();
      }}
    />
  ) : null;

  if (isMinimized) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,23rem)] overflow-hidden rounded-[30px] border border-fuchsia-400/24 bg-[linear-gradient(180deg,rgba(8,5,16,0.94),rgba(6,7,18,0.9))] p-3.5 shadow-[0_24px_90px_rgba(84,12,112,0.38)] backdrop-blur-3xl">
          <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top_left,rgba(192,38,211,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.15),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%,rgba(0,0,0,0.18))]" />
          <div className="absolute inset-px rounded-[29px] border border-white/8" />
          <div className="relative space-y-3">
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-white/8 shadow-[0_14px_42px_rgba(15,23,42,0.4)]">
                {artworkSrc ? (
                  <>
                    <Image src={artworkSrc} alt={currentTrack?.title ?? "播放器封面"} fill className="object-cover" sizes="64px" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(2,6,23,0.26))]" />
                    <div className="absolute inset-0 cinematic-vignette opacity-80" />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle,rgba(192,38,211,0.2),transparent_68%)] text-fuchsia-100/72">
                    <Waves className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/65">
                  <Waves className="h-4 w-4" />
                  Auto DJ Player
                </p>
                <h3 className="mt-2 truncate font-serif text-lg text-white">
                  {currentTrack?.title ?? "尚未播放"}
                </h3>
                <p className="mt-1 truncate text-xs text-white/55">
                  {detectedBpmMeta
                    ? `偵測 ${detectedBpmMeta.detectedBpm} BPM`
                    : nextTrack
                      ? `下一首 ${nextTrack.title}`
                      : "加入曲目即可播放"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2.5 py-1 text-fuchsia-50/88">
                    {playerStateLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-white/70">
                    {engineLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <PlayerHeaderBar
                showAdminDetails={showAdminDetails}
                hasArtwork={Boolean(currentTrack && artworkSrc)}
                compact
                hideTitle
                title="播放器"
                onOpenArtwork={() => openArtwork(false)}
                onOpenProjection={() => openArtwork(true)}
                onToggleMinimize={onToggleMinimize}
                onClose={onClose}
              />
              <PlayerTransportControls
                playlistLength={playlist.length}
                playback={playback}
                compact
                onPlayPause={onPlayPause}
                onToggleRepeat={onToggleRepeat}
                onPrevious={onPrevious}
                onNext={onNext}
                onSeekBy={onSeekBy}
              />
              <button
                type="button"
                onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12"
                aria-label={volume === 0 ? "取消靜音" : "靜音"}
              >
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu((current) => !current)}
                  className={`rounded-full border p-3 text-xs font-medium transition ${
                    playbackRate !== 1
                      ? "border-fuchsia-300/35 bg-fuchsia-400/16 text-fuchsia-50"
                      : "border-white/10 bg-white/8 text-white/72 hover:bg-white/12"
                  }`}
                  aria-label={`播放速度 ${playbackRate}x`}
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu ? (
                  <div className="absolute bottom-full right-0 mb-3 flex flex-col items-center gap-1 rounded-[20px] border border-white/10 bg-black/90 p-2 shadow-xl backdrop-blur-xl">
                    {playbackRateOptions.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                          onPlaybackRateChange(rate);
                        }}
                        className={`w-full rounded-[16px] border px-4 py-2 text-xs font-medium transition ${
                          rate === playbackRate
                            ? "border-fuchsia-400/35 bg-fuchsia-400/16 text-fuchsia-50"
                            : "border-transparent bg-transparent text-white/72 hover:border-white/10 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {isArtworkOpen ? artworkStage : null}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-h-[calc(100vh-2rem)] max-w-6xl overflow-y-auto overflow-x-hidden rounded-[34px] border border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(5,6,18,0.94),rgba(5,8,20,0.88))] p-4 shadow-[0_34px_110px_rgba(15,23,42,0.62)] backdrop-blur-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_25%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%,rgba(0,0,0,0.12))]" />
        <div className="absolute inset-px rounded-[33px] border border-white/8" />
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <PlayerHeaderBar
                showAdminDetails={showAdminDetails}
                hasArtwork={Boolean(currentTrack && artworkSrc)}
                title={showAdminDetails ? "Neon Focus Auto DJ" : "正在播放"}
                onOpenArtwork={() => openArtwork(false)}
                onOpenProjection={() => openArtwork(true)}
                onToggleMinimize={onToggleMinimize}
                onClose={onClose}
              />
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/8 shadow-[0_16px_48px_rgba(15,23,42,0.42)]">
                    {artworkSrc ? (
                      <>
                        <Image src={artworkSrc} alt={currentTrack?.title ?? "播放器封面"} fill className="object-cover" sizes="64px" />
                        <div className="absolute inset-0 cinematic-vignette opacity-85" />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle,rgba(192,38,211,0.18),transparent_70%)] text-fuchsia-100/72">
                        <Waves className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-2xl text-white">
                      {currentTrack?.title ?? "尚未播放"}
                    </h3>
                    <p className="mt-1 truncate text-sm text-white/62">
                      {showAdminDetails && sessionPlan
                        ? sessionPlan.nextTransitionSummary
                        : nextTrack
                          ? `下一首 ${nextTrack.title}`
                          : "加入曲目開始播放"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-fuchsia-50">
                    {playerStateLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/72">
                    {playlist.length} 首{playback.repeatEnabled ? " · 循環" : ""}
                  </span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                    {engineLabel}
                  </span>
                </div>
              </div>
              {currentTrack ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {showAdminDetails && sessionPlan ? (
                    <span className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-3 py-1 text-fuchsia-50">
                      {sessionPlan.currentPhaseLabel}
                    </span>
                  ) : null}
                  {showAdminDetails && sessionPlan ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      {sessionPlan.laneLabel}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/72">
                    {showAdminDetails
                      ? `${currentTrack.bpm} BPM · ${currentTrack.musicalKey}`
                      : publicTrackSummary}
                  </span>
                  {detectedBpmMeta ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      {playbackRate !== 1
                        ? `${detectedBpmMeta.perceivedBpm} (${playbackRate}×)`
                        : `${detectedBpmMeta.detectedBpm}`}
                      / {detectedBpmMeta.confidencePercent}%
                    </span>
                  ) : detectedBpmState.status === "loading" ? (
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/52">
                      偵測中
                    </span>
                  ) : detectedBpmState.status === "error" ? (
                    <span
                      className="rounded-full border border-amber-300/24 bg-amber-300/8 px-3 py-1 text-amber-100/84"
                      title="信心低於門檻 60%，結果未寫入 cache"
                    >
                      ⚠ 信心不足 {detectedBpmState.message}
                    </span>
                  ) : null}
                  {showAdminDetails && continuousAnalysisEnabled && continuousBestResult && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentTrack) return;
                        updateTrackReviewOverride(currentTrack.id, { bpm: continuousBestResult.bpm });
                        setContinuousBestResult(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/14 px-3 py-1 text-[11px] text-emerald-100/92 transition hover:bg-emerald-300/22"
                    >
                      <Check className="h-3 w-3" />
                      套用 {continuousBestResult.bpm} BPM
                    </button>
                  )}
                  {showAdminDetails ? (
                    <button
                      onClick={() => setContinuousAnalysisEnabled((v) => !v)}
                      className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                        continuousAnalysisEnabled
                          ? "border-violet-400/48 bg-violet-400/24 text-violet-100"
                          : "border-white/14 bg-white/8 text-white/52 hover:border-white/24 hover:text-white/72"
                      }`}
                    >
                      {continuousAnalysisEnabled ? "■ 持續分析" : "▶ 持續分析"}
                    </button>
                  ) : null}
                  {showAdminDetails ? (
                    <PlayheadBpmDetector
                      track={currentTrack}
                      playheadSeconds={playback.currentTime}
                      onSeekChange={(seconds) => {
                        setLiveSeekSeconds(seconds);
                      }}
                      isPlaying={playback.isPlaying}
                      playbackRate={playback.playbackRate}
                      allowedBpms={allowedBpms}
                      detectorActive={detectorActive}
                      onDetectorActiveChange={setDetectorActive}
                    />
                  ) : null}
                  {showAdminDetails ? (
                    <TapBpmButton
                      onResult={(bpm) => {
                        if (currentTrack) {
                          updateTrackReviewOverride(currentTrack.id, { bpm });
                          setManualOverrideCount((count) => count + 1);
                        }
                      }}
                      currentBpm={currentTrack.bpm}
                      allowedBpms={extractAllowedBpms(
                        currentTrack.themeProgramId ? (themeProgramMap.get(currentTrack.themeProgramId) ?? null) : null,
                      )}
                      disabled={!currentTrack}
                      manualOverrideCount={manualOverrideCount}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <PlayerTransportControls
              playlistLength={playlist.length}
              playback={playback}
              onPlayPause={onPlayPause}
              onToggleRepeat={onToggleRepeat}
              onPrevious={onPrevious}
              onNext={onNext}
              onSeekBy={onSeekBy}
            />

            {/* Volume Control */}
            <div className="relative ml-2">
              <button
                type="button"
                onClick={() => setShowVolumeSlider((current) => !current)}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12"
                aria-label={volume === 0 ? "取消靜音" : "靜音"}
              >
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              {showVolumeSlider ? (
                <div className="absolute bottom-full right-0 mb-3 flex flex-col items-center gap-2 rounded-[20px] border border-white/10 bg-black/90 p-4 shadow-xl backdrop-blur-xl">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      onVolumeChange(v);
                    }}
                    className="h-28 w-6 appearance-none rounded-full border border-white/10 bg-white/8 accent-fuchsia-400"
                    style={{ writingMode: "vertical-lr", direction: "rtl" }}
                    aria-label="音量"
                  />
                  <span className="text-[11px] text-white/52">{Math.round(volume * 100)}%</span>
                </div>
              ) : null}
            </div>

            {/* Speed Control */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((current) => !current)}
                className={`rounded-full border p-3 text-xs font-medium transition ${
                  playbackRate !== 1
                    ? "border-fuchsia-300/35 bg-fuchsia-400/16 text-fuchsia-50"
                    : "border-white/10 bg-white/8 text-white/72 hover:bg-white/12 hover:text-white"
                }`}
                aria-label={`播放速度 ${playbackRate}x`}
              >
                {playbackRate}x
              </button>
              {showSpeedMenu ? (
                <div className="absolute bottom-full right-0 mb-3 flex flex-col items-center gap-1 rounded-[20px] border border-white/10 bg-black/90 p-2 shadow-xl backdrop-blur-xl">
                  {playbackRateOptions.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                        onPlaybackRateChange(rate);
                      }}
                      className={`w-full rounded-[16px] border px-4 py-2 text-xs font-medium transition ${
                        rate === playbackRate
                          ? "border-fuchsia-400/35 bg-fuchsia-400/16 text-fuchsia-50"
                          : "border-transparent bg-transparent text-white/72 hover:border-white/10 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {showAdminDetails && sessionPlan ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-[22px] border border-fuchsia-300/16 bg-fuchsia-300/8 p-4">
                <p className="text-[11px] uppercase tracking-[0.26em] text-fuchsia-100/58">現在階段</p>
                <p className="mt-3 font-serif text-xl text-white">{sessionPlan.currentPhaseLabel}</p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {currentTrackPlan?.phaseDescription ?? sessionPlan.currentPhaseDescription}
                </p>
              </div>
              <div className="rounded-[22px] border border-cyan-300/16 bg-cyan-300/8 p-4">
                <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/58">接歌策略</p>
                <p className="mt-3 font-serif text-xl text-white">{sessionPlan.laneLabel}</p>
                <p className="mt-2 text-sm leading-6 text-white/68">{sessionPlan.strategySummary}</p>
                {playback.transitionStrategyLabel ? (
                  <p className="mt-3 text-sm leading-6 text-cyan-100/82">
                    {playback.transitionStrategyLabel}
                    {transitionMeta
                      ? ` · Mix Out ${transitionMeta.outStartLabel ?? "--:--"} / Next In ${transitionMeta.inStartLabel ?? "--:--"} / Target ${transitionMeta.targetMixInLabel ?? "--:--"}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] uppercase tracking-[0.26em] text-white/42">下一步</p>
                <p className="mt-3 font-serif text-xl text-white">
                  {nextTrackPlan?.phaseLabel ?? (nextTrack ? "下一首待命" : "本輪即將結束")}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {nextTrack
                    ? `${nextTrack.title} · ${nextTrackPlan?.transitionSummary ?? `${nextTrack.bpm} BPM 待命`}`
                    : sessionPlan.nextTransitionSummary}
                </p>
              </div>
            </div>
          ) : null}

          <PlayerProgressBar
            currentTime={liveSeekSeconds ?? playback.currentTime}
            duration={playback.duration}
            onSeek={onSeek}
            onSeekChange={setLiveSeekSeconds}
            formatTime={formatTime}
            markers={progressMarkers}
            ranges={progressRanges}
            secondaryDuration={showAdminDetails && nextTrack ? nextTrack.durationSeconds : undefined}
            secondaryLabel={nextTrack ? `下一首進點 · ${nextTrack.title}` : undefined}
            secondaryMarkers={nextTrackProgressMarkers}
            secondaryRanges={nextTrackProgressRanges}
          />

          <PlayerPlaylistStrip
            playlist={playlist}
            currentTrackId={playback.currentTrackId}
            nextTrackId={playback.nextTrackId}
            showAdminDetails={showAdminDetails}
            sessionPlan={sessionPlan}
            onPlayTrack={onPlayTrack}
          />
        </div>
      </div>
      {isArtworkOpen ? artworkStage : null}
    </>
  );
}
