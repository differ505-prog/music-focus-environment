import { Pause, Play, Redo2, Repeat, SkipBack, SkipForward, Undo2 } from "lucide-react";

import type { PlaybackSnapshot } from "@/types/music";

type PlayerTransportControlsProps = {
  playlistLength: number;
  playback: PlaybackSnapshot;
  compact?: boolean;
  onPlayPause: () => void;
  onToggleRepeat: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeekBy: (deltaSeconds: number) => void;
};

export function PlayerTransportControls({
  playlistLength,
  playback,
  compact = false,
  onPlayPause,
  onToggleRepeat,
  onPrevious,
  onNext,
  onSeekBy,
}: PlayerTransportControlsProps) {
  const disabled = playlistLength === 0;

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={onPlayPause}
          disabled={disabled}
          className="rounded-full border border-cyan-300/25 bg-cyan-300/14 p-3 text-cyan-50 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={playback.isPlaying ? "暫停播放" : "開始播放"}
        >
          {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onToggleRepeat}
          disabled={disabled}
          className={`rounded-full border p-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${
            playback.repeatEnabled
              ? "border-fuchsia-300/35 bg-fuchsia-400/16 text-fuchsia-50"
              : "border-white/10 bg-white/8 text-white/75 hover:bg-white/12 hover:text-white"
          }`}
          aria-label={playback.repeatEnabled ? "關閉循環播放" : "開啟循環播放"}
        >
          <Repeat className="h-4 w-4" />
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => onSeekBy(-10)}
        disabled={disabled}
        className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="倒退十秒"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onPrevious}
        disabled={disabled}
        className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="播放上一首"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/18 p-4 text-fuchsia-50 transition hover:bg-fuchsia-400/26 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={playback.isPlaying ? "暫停播放" : "開始播放"}
      >
        {playback.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <button
        type="button"
        onClick={onToggleRepeat}
        disabled={disabled}
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
        disabled={disabled}
        className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="播放下一首"
      >
        <SkipForward className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onSeekBy(10)}
        disabled={disabled}
        className="rounded-full border border-white/10 bg-white/8 p-3 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="快轉十秒"
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
}
