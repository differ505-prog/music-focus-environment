'use client';

import { Pause, Play, SkipBack, SkipForward, Waves } from "lucide-react";

import type { MusicAsset, PlaybackSnapshot } from "@/types/music";

type GlobalPlayerProps = {
  playlist: MusicAsset[];
  currentTrack: MusicAsset | null;
  nextTrack: MusicAsset | null;
  playback: PlaybackSnapshot;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
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
  onPlayPause,
  onPrevious,
  onNext,
}: GlobalPlayerProps) {
  const progressPercent =
    playback.duration > 0 ? Math.min((playback.currentTime / playback.duration) * 100, 100) : 0;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-6xl rounded-[30px] border border-white/12 bg-[#050b12]/86 p-4 shadow-[0_34px_90px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-cyan-100/60">
            <Waves className="h-4 w-4" />
            Global Focus Player
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
        </div>

        <div className="flex items-center gap-3">
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
            className="rounded-full border border-cyan-300/30 bg-cyan-300/16 p-4 text-cyan-50 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-40"
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
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(133,243,255,0.94),rgba(255,255,255,0.72))] transition-[width] duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-white/50">
          <span>{formatTime(playback.currentTime)}</span>
          <span>{formatTime(playback.duration)}</span>
        </div>
      </div>
    </div>
  );
}
