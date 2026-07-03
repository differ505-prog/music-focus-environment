'use client';

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronUp,
  Expand,
  ListMusic,
  Minimize2,
  Pause,
  Play,
  Redo2,
  Repeat,
  SkipBack,
  SkipForward,
  Undo2,
  Waves,
  X,
} from "lucide-react";

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
  const [isArtworkOpen, setIsArtworkOpen] = useState(false);
  const [isProjectionMode, setIsProjectionMode] = useState(false);
  const [isArtworkFullscreen, setIsArtworkFullscreen] = useState(false);
  const artworkContainerRef = useRef<HTMLDivElement | null>(null);
  const hudHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isProjectionHudVisible, setIsProjectionHudVisible] = useState(true);
  const [isProjectionCursorHidden, setIsProjectionCursorHidden] = useState(false);
  const artworkSrc = useMemo(() => currentTrack?.media.coverImageUrl ?? "", [currentTrack?.media.coverImageUrl]);
  const isPureProjection = isProjectionMode && isArtworkFullscreen;
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
  const publicTrackSummary = currentTrack
    ? `${currentTrack.bpm} BPM · 約 ${Math.round(currentTrack.durationSeconds / 60)} 分鐘`
    : null;

  useEffect(() => {
    if (!currentTrack) {
      setIsArtworkOpen(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    return () => {
      if (hudHideTimerRef.current) {
        clearTimeout(hudHideTimerRef.current);
      }
      if (cursorHideTimerRef.current) {
        clearTimeout(cursorHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === artworkContainerRef.current;
      setIsArtworkFullscreen(isFullscreen);

      if (isFullscreen) {
        setIsProjectionHudVisible(false);
        setIsProjectionCursorHidden(isProjectionMode);
      } else if (isArtworkOpen) {
        setIsProjectionCursorHidden(false);
        revealProjectionHud();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement !== artworkContainerRef.current) {
        setIsArtworkOpen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isArtworkOpen, isProjectionMode]);

  const handleOpenArtwork = (projectionMode = false) => {
    if (!currentTrack || !artworkSrc) {
      return;
    }

    setIsProjectionMode(projectionMode);
    setIsArtworkOpen(true);
    setIsProjectionHudVisible(true);
    setIsProjectionCursorHidden(false);
    setIsArtworkFullscreen(false);
  };

  const handleCloseArtwork = async () => {
    if (typeof document !== "undefined" && document.fullscreenElement === artworkContainerRef.current) {
      await document.exitFullscreen();
    }

    setIsArtworkOpen(false);
    setIsProjectionMode(false);
    setIsProjectionCursorHidden(false);
    setIsArtworkFullscreen(false);
  };

  const handleToggleArtworkFullscreen = async () => {
    if (!artworkContainerRef.current || typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement === artworkContainerRef.current) {
      await document.exitFullscreen();
      return;
    }

    await artworkContainerRef.current.requestFullscreen();
  };

  const revealProjectionHud = () => {
    if (isArtworkFullscreen) {
      setIsProjectionHudVisible(false);
      return;
    }

    setIsProjectionHudVisible(true);
    setIsProjectionCursorHidden(false);

    if (hudHideTimerRef.current) {
      clearTimeout(hudHideTimerRef.current);
    }
    if (cursorHideTimerRef.current) {
      clearTimeout(cursorHideTimerRef.current);
    }

    hudHideTimerRef.current = setTimeout(() => {
      setIsProjectionHudVisible(false);
    }, isProjectionMode ? 1600 : 2200);

    if (isProjectionMode) {
      cursorHideTimerRef.current = setTimeout(() => {
        setIsProjectionCursorHidden(true);
      }, 1400);
    }
  };

  useEffect(() => {
    if (!isArtworkOpen) {
      setIsProjectionHudVisible(true);
      setIsProjectionCursorHidden(false);
      if (hudHideTimerRef.current) {
        clearTimeout(hudHideTimerRef.current);
      }
      if (cursorHideTimerRef.current) {
        clearTimeout(cursorHideTimerRef.current);
      }
      return;
    }

    revealProjectionHud();
  }, [isArtworkOpen, isProjectionMode, isArtworkFullscreen]);

  const artworkStage = currentTrack && artworkSrc ? (
    <div
      ref={artworkContainerRef}
      onClick={!isProjectionMode && !isArtworkFullscreen ? () => void handleCloseArtwork() : undefined}
      onMouseMove={revealProjectionHud}
      onTouchStart={revealProjectionHud}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#02040a]/96 p-4 md:p-8 ${isProjectionMode && isProjectionCursorHidden ? "cursor-none" : ""}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.16),transparent_26%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_32%)] animate-projection-breathe" />
      <Image
        src={artworkSrc}
        alt={currentTrack.title}
        fill
        className="projection-artwork-glow object-cover opacity-22 blur-2xl"
        unoptimized
      />
      <div
        className={`pointer-events-none absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/22 px-4 py-3 text-[11px] uppercase tracking-[0.26em] text-white/52 backdrop-blur-xl transition duration-500 md:left-8 md:right-8 ${
          isProjectionHudVisible && !isArtworkFullscreen
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 -translate-y-3"
        }`}
      >
        <span>{isProjectionMode ? "全螢幕封面" : "封面檢視"}</span>
        <span>{isProjectionMode ? "Esc 關閉 / 雙擊切換全螢幕" : "雙擊切換全螢幕"}</span>
      </div>
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <div
          className={`projection-stage relative aspect-[16/9] w-full max-w-[min(92vw,180vh)] overflow-hidden bg-black/28 ${
            isPureProjection
              ? "h-full w-full max-w-none rounded-none border-none shadow-none"
              : "rounded-[32px] border border-white/10 shadow-[0_34px_110px_rgba(0,0,0,0.45)]"
          } ${isProjectionMode ? "projection-stage-drift" : ""}`}
          onDoubleClick={() => void handleToggleArtworkFullscreen()}
        >
          {!isPureProjection ? (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_28%,transparent_72%,rgba(255,255,255,0.03))]" />
          ) : null}
          <Image
            src={artworkSrc}
            alt={currentTrack.title}
            fill
            className={isPureProjection ? "object-contain projection-pure-drift" : "object-contain"}
            unoptimized
            priority
          />
        </div>
      </div>
      <div
        className={`pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex justify-center transition duration-500 md:bottom-8 ${
          isProjectionHudVisible && !isArtworkFullscreen
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 translate-y-3"
        }`}
      >
        <div className="max-w-4xl rounded-[28px] border border-white/10 bg-black/26 px-5 py-4 text-center backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/52">
            {isProjectionMode ? "全螢幕封面" : "正在播放"}
          </p>
          <h3 className="mt-3 font-serif text-2xl text-white md:text-4xl">{currentTrack.title}</h3>
          <p className="mt-2 text-sm text-white/56 md:text-base">
            {showAdminDetails
              ? `${currentTrack.bpm} BPM · ${currentTrack.musicalKey} · Energy ${currentTrack.energyLevel.toFixed(1)}`
              : publicTrackSummary}
            {playback.repeatEnabled ? " · 循環播放" : ""}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/38">
            {showAdminDetails && sessionPlan
              ? `${sessionPlan.currentPhaseLabel} · ${sessionPlan.laneLabel}`
              : nextTrack
                ? `下一首 ${nextTrack.title}`
                : isProjectionMode
                  ? "封面"
                  : "雙擊全螢幕"}
          </p>
        </div>
      </div>
    </div>
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
                {nextTrack ? `下一首 ${nextTrack.title}` : "加入曲目即可播放"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {currentTrack && artworkSrc ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenArtwork(false)}
                        className="rounded-full border border-white/10 bg-white/8 p-3 text-white/75 transition hover:bg-white/12 hover:text-white"
                        aria-label="展開封面圖"
                      >
                        <Expand className="h-4 w-4" />
                      </button>
                      {showAdminDetails ? (
                        <button
                          type="button"
                          onClick={() => handleOpenArtwork(true)}
                          className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/12 px-3 py-3 text-[11px] uppercase tracking-[0.24em] text-fuchsia-50 transition hover:bg-fuchsia-400/18"
                          aria-label="開啟投影模式"
                        >
                          投影
                        </button>
                      ) : null}
                    </>
                  ) : null}
              <button
                type="button"
                onClick={onPlayPause}
                disabled={playlist.length === 0}
                className="rounded-full border border-cyan-300/25 bg-cyan-300/14 p-3 text-cyan-50 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={playback.isPlaying ? "暫停播放" : "開始播放"}
              >
                {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onToggleRepeat}
                disabled={playlist.length === 0}
                className={`rounded-full border p-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  playback.repeatEnabled
                    ? "border-fuchsia-300/35 bg-fuchsia-400/16 text-fuchsia-50"
                    : "border-white/10 bg-white/8 text-white/75 hover:bg-white/12 hover:text-white"
                }`}
                aria-label={playback.repeatEnabled ? "關閉循環播放" : "開啟循環播放"}
              >
                <Repeat className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleMinimize}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white/75 transition hover:bg-white/12 hover:text-white"
                aria-label="展開播放器"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white/75 transition hover:bg-white/12 hover:text-white"
                aria-label="關閉播放器"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {isArtworkOpen ? artworkStage : null}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-fuchsia-400/20 bg-[#050612]/86 p-4 shadow-[0_34px_110px_rgba(15,23,42,0.62)] backdrop-blur-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_25%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.14),transparent_38%)]" />
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-fuchsia-100/60">
                  <Waves className="h-4 w-4" />
                  {showAdminDetails ? "Neon Focus Auto DJ" : "正在播放"}
                </div>
                <div className="flex items-center gap-2">
                  {currentTrack && artworkSrc ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenArtwork(false)}
                        className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/70 transition hover:bg-white/12 hover:text-white"
                        aria-label="展開封面圖"
                      >
                        封面
                      </button>
                      {showAdminDetails ? (
                        <button
                          type="button"
                          onClick={() => handleOpenArtwork(true)}
                          className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/12 px-4 py-2 text-xs uppercase tracking-[0.24em] text-fuchsia-50 transition hover:bg-fuchsia-400/18"
                          aria-label="開啟投影模式"
                        >
                          投影
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={onToggleMinimize}
                    className="rounded-full border border-white/10 bg-white/8 p-2 text-white/70 transition hover:bg-white/12 hover:text-white"
                    aria-label="縮小播放器"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/10 bg-white/8 p-2 text-white/70 transition hover:bg-white/12 hover:text-white"
                    aria-label="關閉播放器"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
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
                  {showAdminDetails && playback.prefersBackgroundPlayback ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      背景模式
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSeekBy(-10)}
                disabled={playlist.length === 0}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="倒退十秒"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onPrevious}
                disabled={playlist.length === 0}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="播放上一首"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onPlayPause}
                disabled={playlist.length === 0}
                className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/18 p-4 text-fuchsia-50 transition hover:bg-fuchsia-400/26 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={playback.isPlaying ? "暫停播放" : "開始播放"}
              >
                {playback.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={onToggleRepeat}
                disabled={playlist.length === 0}
                className={`rounded-full border p-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  playback.repeatEnabled
                    ? "border-fuchsia-300/35 bg-fuchsia-400/16 text-fuchsia-50"
                    : "border-white/10 bg-white/8 text-white hover:bg-white/12"
                }`}
                aria-label={playback.repeatEnabled ? "關閉循環播放" : "開啟循環播放"}
              >
                <Repeat className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={playlist.length === 0}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="播放下一首"
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onSeekBy(10)}
                disabled={playlist.length === 0}
                className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="快轉十秒"
              >
                <Redo2 className="h-4 w-4" />
              </button>
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

          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={playback.duration || 0}
              step={0.1}
              value={Math.min(playback.currentTime, playback.duration || 0)}
              onInput={(event) => onSeek(Number((event.target as HTMLInputElement).value))}
              onChange={(event) => onSeek(Number(event.target.value))}
              disabled={playback.duration <= 0}
              className="h-2 w-full cursor-pointer accent-fuchsia-400 disabled:cursor-not-allowed"
              aria-label="快轉播放進度"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span>{formatTime(playback.currentTime)}</span>
              <span>{formatTime(playback.duration)}</span>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-3">
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/58">
              <ListMusic className="h-4 w-4" />
              播放清單
            </div>
            {playlist.length === 0 ? (
              <p className="text-sm text-white/48">播放後會顯示清單。</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {playlist.map((track, index) => {
                  const isCurrent = playback.currentTrackId === track.id;
                  const isNext = playback.nextTrackId === track.id;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => onPlayTrack(track.id)}
                      className={`min-w-[180px] rounded-[20px] border px-4 py-3 text-left transition ${
                        isCurrent
                          ? "border-cyan-300/40 bg-cyan-300/14 text-cyan-50"
                          : isNext
                            ? "border-amber-300/30 bg-amber-300/10 text-amber-50"
                            : "border-white/10 bg-black/18 text-white/72 hover:border-white/20 hover:bg-white/8"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">
                        {showAdminDetails
                          ? sessionPlan?.trackPlans[index]?.phaseLabel ?? `Track ${index + 1}`
                          : `第 ${index + 1} 首`}
                      </p>
                      <p className="mt-2 truncate text-sm font-medium">{track.title}</p>
                      <p className="mt-1 text-xs opacity-70">
                        {isCurrent
                          ? "目前播放"
                          : isNext
                            ? "下一首"
                            : showAdminDetails
                              ? sessionPlan?.trackPlans[index]?.transitionSummary ?? `${track.bpm} BPM`
                              : `${track.bpm} BPM`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {isArtworkOpen ? artworkStage : null}
    </>
  );
}
