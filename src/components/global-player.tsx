'use client';

import { useEffect, useMemo, useState } from "react";
import { Waves } from "lucide-react";

import { bpmOptions, themePrograms } from "@/data/music-assets";
import { PlayerArtworkStage } from "@/components/player-artwork-stage";
import { PlayerHeaderBar } from "@/components/player-header-bar";
import { PlayerPlaylistStrip } from "@/components/player-playlist-strip";
import { PlayerProgressBar } from "@/components/player-progress-bar";
import { PlayerTransportControls } from "@/components/player-transport-controls";
import { useArtworkProjection } from "@/hooks/use-artwork-projection";
import type { BpmAnalysis } from "@/lib/bpm-analyzer";
import { detectTrackBpmFromUrl } from "@/lib/track-bpm-detection";
import { getBpmCompatibility } from "@/lib/bpm-lanes";
import { extractAllowedBpms, saveTrackBpmDetection } from "@/lib/track-review-store";
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

const detectedBpmCache = new Map<string, BpmAnalysis>();

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
}: GlobalPlayerProps) {
  const showAdminDetails = mode === "admin";
  const [detectedBpmState, setDetectedBpmState] = useState<TrackBpmDetectionState>({ status: "idle" });
  const themeProgramMap = useMemo(() => new Map(themePrograms.map((program) => [program.id, program] as const)), []);
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
      const cached = detectedBpmCache.get(cacheKey);

      if (cached) {
        setDetectedBpmState({ status: "ready", result: cached });
        return;
      }

      setDetectedBpmState({ status: "loading" });

      try {
        const allowedBpms = extractAllowedBpms(
          track.themeProgramId ? (themeProgramMap.get(track.themeProgramId) ?? null) : null,
        );
        const result = await detectTrackBpmFromUrl(track.media.audioUrl, bpmOptions, {
          metadataBpm: track.bpm,
          allowedBpms,
        });

        detectedBpmCache.set(cacheKey, result);
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
          setDetectedBpmState({ status: "ready", result });
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
      return () => {
        cancelled = true;
      };
    }

    void detectTrackBpm(currentTrack);

    return () => {
      cancelled = true;
    };
  }, [currentTrack, themeProgramMap]);

  const detectedBpmMeta = useMemo(() => {
    if (!currentTrack || detectedBpmState.status !== "ready") {
      return null;
    }

    const detectedBpm = detectedBpmState.result.estimatedBpm;
    const rawDetectedBpm = detectedBpmState.result.rawDetectedBpm;
    const diff = Math.abs(currentTrack.bpm - detectedBpm);
    const compatibility = getBpmCompatibility(currentTrack.bpm, detectedBpm);

    return {
      detectedBpm,
      rawDetectedBpm,
      diff,
      confidencePercent: Math.round(detectedBpmState.result.confidence * 100),
      compatibility,
      resolvedByReference: detectedBpmState.result.resolvedByReference,
    };
  }, [currentTrack, detectedBpmState]);
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
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,22rem)] rounded-[28px] border border-fuchsia-400/25 bg-[#080510]/88 p-4 shadow-[0_18px_70px_rgba(84,12,112,0.45)] backdrop-blur-3xl">
          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(192,38,211,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_38%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/65">
                <Waves className="h-4 w-4" />
                播放器
              </p>
              <h3 className="mt-2 truncate font-serif text-lg text-white">
                {currentTrack?.title ?? "尚未播放"}
              </h3>
              <p className="mt-1 truncate text-xs text-white/55">
                {detectedBpmMeta
                  ? `偵測 ${detectedBpmMeta.detectedBpm} BPM${detectedBpmMeta.rawDetectedBpm !== detectedBpmMeta.detectedBpm ? ` · 原始 ${detectedBpmMeta.rawDetectedBpm}` : detectedBpmMeta.diff > 0 ? ` · 差 ${detectedBpmMeta.diff} BPM` : ""}`
                  : detectedBpmState.status === "loading"
                    ? "BPM 偵測中..."
                    : nextTrack
                      ? `下一首 ${nextTrack.title}`
                      : "加入曲目即可播放"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
            </div>
          </div>
        </div>
        {isArtworkOpen ? artworkStage : null}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-h-[calc(100vh-2rem)] max-w-6xl overflow-y-auto overflow-x-hidden rounded-[32px] border border-fuchsia-400/20 bg-[#050612]/86 p-4 shadow-[0_34px_110px_rgba(15,23,42,0.62)] backdrop-blur-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_25%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.14),transparent_38%)]" />
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
              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
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
                <div className="text-sm text-white/64">
                  {playlist.length} 首
                  {playback.isCrossfading ? ` · 連續播放` : ""}
                  {playback.repeatEnabled ? " · 循環" : ""}
                </div>
              </div>
              {currentTrack ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
                      ? `${currentTrack.bpm} BPM · ${currentTrack.musicalKey} · Energy ${currentTrack.energyLevel.toFixed(1)}`
                      : publicTrackSummary}
                  </span>
                  {detectedBpmState.status === "loading" ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      BPM 偵測中...
                    </span>
                  ) : null}
                  {detectedBpmMeta ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      偵測 {detectedBpmMeta.detectedBpm} BPM · {detectedBpmMeta.confidencePercent}%
                    </span>
                  ) : null}
                  {detectedBpmMeta && detectedBpmMeta.rawDetectedBpm !== detectedBpmMeta.detectedBpm ? (
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/72">
                      原始脈衝 {detectedBpmMeta.rawDetectedBpm} BPM
                    </span>
                  ) : null}
                  {detectedBpmMeta && detectedBpmMeta.diff > 0 ? (
                    <span
                      className={`rounded-full border px-3 py-1 ${
                        detectedBpmMeta.compatibility.status === "adjacent"
                          ? "border-amber-300/20 bg-amber-300/10 text-amber-100/85"
                          : "border-rose-300/20 bg-rose-300/10 text-rose-100/85"
                      }`}
                    >
                      Metadata {currentTrack.bpm} / 偵測 {detectedBpmMeta.detectedBpm}
                    </span>
                  ) : null}
                  {detectedBpmState.status === "error" ? (
                    <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-rose-100/85">
                      {detectedBpmState.message}
                    </span>
                  ) : null}
                  {showAdminDetails ? (
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100/85">
                      {currentTrack.transition.sourceLufs.toFixed(1)} → {currentTrack.transition.targetLufs.toFixed(1)} LUFS
                    </span>
                  ) : null}
                  {showAdminDetails ? (
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/72">
                      Norm {currentTrack.transition.normalizationGainDb > 0 ? "+" : ""}
                      {currentTrack.transition.normalizationGainDb.toFixed(2)} dB
                    </span>
                  ) : null}
                  {showAdminDetails ? (
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100/85">
                      {playback.prefersBackgroundPlayback ? "背景播放" : "平滑轉場"}
                    </span>
                  ) : null}
                  {showAdminDetails && transitionMeta ? (
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/72">
                      Mix Out {transitionMeta.outStartLabel ?? "--:--"} · Fade {transitionMeta.fadeWindowLabel}
                    </span>
                  ) : null}
                  {showAdminDetails && transitionMeta ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      Next In {transitionMeta.inStartLabel ?? "--:--"} → Mix In {transitionMeta.targetMixInLabel ?? "--:--"}
                    </span>
                  ) : null}
                  {showAdminDetails && playback.transitionStrategyLabel ? (
                    <span className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-3 py-1 text-fuchsia-50">
                      {playback.transitionStrategyLabel}
                    </span>
                  ) : null}
                  {showAdminDetails && transitionDeltaToneClass && playback.transitionBpmDelta != null ? (
                    <span className={`rounded-full border px-3 py-1 ${transitionDeltaToneClass}`}>
                      Δ BPM {playback.transitionBpmDelta}
                    </span>
                  ) : null}
                  {showAdminDetails && playback.prefersBackgroundPlayback ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      背景模式
                    </span>
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
            currentTime={playback.currentTime}
            duration={playback.duration}
            onSeek={onSeek}
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
