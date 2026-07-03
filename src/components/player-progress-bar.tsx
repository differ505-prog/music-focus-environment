type PlayerProgressBarProps = {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  formatTime: (value: number) => string;
};

export function PlayerProgressBar({
  currentTime,
  duration,
  onSeek,
  formatTime,
}: PlayerProgressBarProps) {
  return (
    <div className="mt-4">
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onInput={(event) => onSeek(Number((event.target as HTMLInputElement).value))}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={duration <= 0}
        className="h-2 w-full cursor-pointer accent-fuchsia-400 disabled:cursor-not-allowed"
        aria-label="快轉播放進度"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-white/50">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
