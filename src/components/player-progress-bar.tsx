type ProgressMarker = {
  seconds: number;
  label: string;
  tone?: "fuchsia" | "cyan" | "amber";
  /** Optional live countdown in seconds; when provided, marker renders the countdown badge. */
  secondsUntil?: number;
};

type ProgressRange = {
  startSeconds: number;
  endSeconds: number;
  label: string;
  tone?: "fuchsia" | "cyan" | "amber";
};

type PlayerProgressBarProps = {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  /** Fires on every input event during drag — use for live UI updates separate from committed seek */
  onSeekChange?: (seconds: number) => void;
  formatTime: (value: number) => string;
  markers?: ProgressMarker[];
  ranges?: ProgressRange[];
};

function clampMarkerPosition(seconds: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  return Math.min(Math.max((seconds / duration) * 100, 0), 100);
}

function markerToneClasses(tone: ProgressMarker["tone"] = "fuchsia") {
  if (tone === "cyan") {
    return {
      line: "bg-cyan-300/80",
      triangle: "border-t-cyan-300/85",
      pill: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100/85",
    };
  }

  if (tone === "amber") {
    return {
      line: "bg-amber-300/80",
      triangle: "border-t-amber-300/85",
      pill: "border-amber-300/20 bg-amber-300/10 text-amber-100/85",
    };
  }

  return {
    line: "bg-fuchsia-300/80",
    triangle: "border-t-fuchsia-300/85",
    pill: "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100/85",
  };
}

function buildRangeStyle(startSeconds: number, endSeconds: number, duration: number) {
  const start = clampMarkerPosition(startSeconds, duration);
  const end = clampMarkerPosition(endSeconds, duration);

  return {
    left: `${Math.min(start, end)}%`,
    width: `${Math.max(Math.abs(end - start), 0)}%`,
  };
}

function rangeToneClasses(tone: ProgressRange["tone"] = "fuchsia") {
  if (tone === "cyan") {
    return "bg-cyan-300/18";
  }

  if (tone === "amber") {
    return "bg-amber-300/18";
  }

  return "bg-fuchsia-300/18";
}

export function PlayerProgressBar({
  currentTime,
  duration,
  onSeek,
  onSeekChange,
  formatTime,
  markers = [],
  ranges = [],
}: PlayerProgressBarProps) {
  return (
    <div className="mt-4">
      <div className="relative">
        {ranges.length > 0 ? (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <div className="relative h-2 rounded-full bg-white/8">
              {ranges.map((range) => (
                <div
                  key={`range-${range.label}-${range.startSeconds}-${range.endSeconds}`}
                  className={`absolute inset-y-0 rounded-full ${rangeToneClasses(range.tone)}`}
                  style={buildRangeStyle(range.startSeconds, range.endSeconds, duration)}
                />
              ))}
              {markers.map((marker) => {
                const toneClasses = markerToneClasses(marker.tone);
                const position = clampMarkerPosition(marker.seconds, duration);

                return (
                  <div
                    key={`range-marker-${marker.label}-${marker.seconds}`}
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: `${position}%` }}
                  >
                    <div className={`absolute top-0 h-2 w-px -translate-x-1/2 ${toneClasses.line}`} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <div className="h-2 rounded-full bg-white/8" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onInput={(event) => {
              const value = Number((event.target as HTMLInputElement).value);
              onSeek(value);
              onSeekChange?.(value);
            }}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={duration <= 0}
            className="pointer-events-auto h-2 w-full cursor-pointer appearance-none bg-transparent accent-fuchsia-400 disabled:cursor-not-allowed"
            aria-label="快轉播放進度"
          />
        </div>

        {markers.map((marker) => {
          const toneClasses = markerToneClasses(marker.tone);
          const position = clampMarkerPosition(marker.seconds, duration);
          const countdownLabel =
            typeof marker.secondsUntil === "number"
              ? marker.secondsUntil > 60
                ? `${Math.floor(marker.secondsUntil / 60)}:${Math.floor(marker.secondsUntil % 60)
                    .toString()
                    .padStart(2, "0")}`
                : `${marker.secondsUntil.toFixed(1)}s`
              : formatTime(marker.seconds);

          return (
            <div
              key={`marker-${marker.label}-${marker.seconds}`}
              className="pointer-events-none absolute inset-y-0"
              style={{ left: `${position}%` }}
            >
              <div className="relative h-full w-0">
                <div className={`absolute bottom-1/2 h-3 w-px -translate-x-1/2 ${toneClasses.line}`} />
                <div
                  className={`absolute bottom-1/2 h-0 w-0 -translate-x-1/2 translate-y-full border-x-[5px] border-t-[6px] border-x-transparent ${toneClasses.triangle}`}
                  aria-hidden
                />
                <div
                  className={`absolute bottom-[calc(50%+10px)] -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${toneClasses.pill}`}
                >
                  {marker.label} · {countdownLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-white/50">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {markers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {markers.map((marker) => {
            const toneClasses = markerToneClasses(marker.tone);

            return (
              <span
                key={`legend-${marker.label}-${marker.seconds}`}
                className={`rounded-full border px-3 py-1 ${toneClasses.pill}`}
              >
                {marker.label} {formatTime(marker.seconds)}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}