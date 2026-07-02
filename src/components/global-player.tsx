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
  SkipBack,
  SkipForward,
  Undo2,
  Waves,
  X,
} from "lucide-react";

import type { PlaybackSnapshot, Track } from "@/types/music";

type GlobalPlayerProps = {
  playlist: Track[];
  currentTrack: Track | null;
  nextTrack: Track | null;
  playback: PlaybackSnapshot;
  isMinimized: boolean;
  mode?: "public" | "admin";
  onPlayPause: () => void;
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
  playback,
  isMinimized,
  mode = "public",
  onPlayPause,
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
  const [isArtworkFullscreen, setIsArtworkFullscreen] = useState(false);
  const artworkContainerRef = useRef<HTMLDivElement | null>(null);
  const artworkSrc = useMemo(() => currentTrack?.media.coverImageUrl ?? "", [currentTrack?.media.coverImageUrl]);

  useEffect(() => {
    if (!currentTrack) {
      setIsArtworkOpen(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      setIsArtworkFullscreen(document.fullscreenElement === artworkContainerRef.current);
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
  }, []);

  const handleOpenArtwork = () => {
    if (!currentTrack || !artworkSrc) {
      return;
    }

    setIsArtworkOpen(true);
  };

  const handleCloseArtwork = async () => {
    if (typeof document !== "undefined" && document.fullscreenElement === artworkContainerRef.current) {
      await document.exitFullscreen();
    }

    setIsArtworkOpen(false);
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

  if (isMinimized) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,22rem)] rounded-[28px] border border-fuchsia-400/25 bg-[#080510]/88 p-4 shadow-[0_18px_70px_rgba(84,12,112,0.45)] backdrop-blur-3xl">
          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(192,38,211,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_38%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/65">
                <Waves className="h-4 w-4" />
                Mini Player
              </p>
              <h3 className="mt-2 truncate font-serif text-lg text-white">
                {currentTrack?.title ?? "尚未選擇播放曲目"}
              </h3>
              <p className="mt-1 truncate text-xs text-white/55">
                {nextTrack ? `下一首：${nextTrack.title}` : "勾選素材後即可建立播放清單"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {currentTrack && artworkSrc ? (
                <button
                  type="button"
                  onClick={handleOpenArtwork}
                  className="rounded-full border border-white/10 bg-white/8 p-3 text-white/75 transition hover:bg-white/12 hover:text-white"
                  aria-label="展開封面圖"
                >
                  <Expand className="h-4 w-4" />
                </button>
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
        {isArtworkOpen && currentTrack && artworkSrc ? (
          <div
            ref={artworkContainerRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#02040a]/96 p-4 md:p-8"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.16),transparent_26%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_32%)]" />
            <Image
              src={artworkSrc}
              alt={currentTrack.title}
              fill
              className="object-cover opacity-22 blur-2xl"
              unoptimized
            />
            <div className="relative z-10 flex h-full w-full max-w-7xl flex-col">
              <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/32 px-4 py-3 text-white/80 backdrop-blur-xl">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/60">Artwork View</p>
                  <h3 className="truncate font-serif text-lg text-white">{currentTrack.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleArtworkFullscreen}
                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
                  >
                    {isArtworkFullscreen ? "退出全螢幕" : "全螢幕"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseArtwork}
                    className="rounded-full border border-white/10 bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white"
                    aria-label="關閉看圖模式"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="relative mt-4 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black/28 shadow-[0_34px_110px_rgba(0,0,0,0.45)]">
                <Image src={artworkSrc} alt={currentTrack.title} fill className="object-contain" unoptimized priority />
              </div>
            </div>
          </div>
        ) : null}
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
                  Neon Focus Player
                </div>
                <div className="flex items-center gap-2">
                  {currentTrack && artworkSrc ? (
                    <button
                      type="button"
                      onClick={handleOpenArtwork}
                      className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/70 transition hover:bg-white/12 hover:text-white"
                      aria-label="展開封面圖"
                    >
                      看圖
                    </button>
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
                    {currentTrack?.title ?? "尚未選擇播放曲目"}
                  </h3>
                  <p className="mt-1 truncate text-sm text-white/62">
                    {nextTrack ? `下一首：${nextTrack.title}` : "勾選素材後即可建立播放清單"}
                  </p>
                </div>
                <div className="text-sm text-white/64">
                  清單共 {playlist.length} 首
                  {playback.isCrossfading ? ` · Crossfade 進行中（${playback.crossfadeWindowSeconds}s）` : ""}
                </div>
              </div>
              {currentTrack ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-white/72">
                    {currentTrack.musicalKey} · Energy {currentTrack.energyLevel.toFixed(1)}
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
                      {playback.prefersBackgroundPlayback ? "HTML5 Audio" : "Equal-Power Fade"}
                    </span>
                  ) : null}
                  {showAdminDetails && playback.prefersBackgroundPlayback ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100/85">
                      背景播放優化模式
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
              <p className="text-sm text-white/48">先勾選素材或點卡片的播放，這裡就會出現整個清單。</p>
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
                      <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">Track {index + 1}</p>
                      <p className="mt-2 truncate text-sm font-medium">{track.title}</p>
                      <p className="mt-1 text-xs opacity-70">
                        {isCurrent ? "目前播放" : isNext ? "下一首" : `${track.bpm} BPM`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {isArtworkOpen && currentTrack && artworkSrc ? (
        <div ref={artworkContainerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[#02040a]/96 p-4 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.16),transparent_26%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_32%)]" />
          <Image
            src={artworkSrc}
            alt={currentTrack.title}
            fill
            className="object-cover opacity-22 blur-2xl"
            unoptimized
          />
          <div className="relative z-10 flex h-full w-full max-w-7xl flex-col">
            <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/32 px-4 py-3 text-white/80 backdrop-blur-xl">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/60">Artwork View</p>
                <h3 className="truncate font-serif text-lg text-white">{currentTrack.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleArtworkFullscreen}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
                >
                  {isArtworkFullscreen ? "退出全螢幕" : "全螢幕"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseArtwork}
                  className="rounded-full border border-white/10 bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white"
                  aria-label="關閉看圖模式"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative mt-4 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black/28 shadow-[0_34px_110px_rgba(0,0,0,0.45)]">
              <Image src={artworkSrc} alt={currentTrack.title} fill className="object-contain" unoptimized priority />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
