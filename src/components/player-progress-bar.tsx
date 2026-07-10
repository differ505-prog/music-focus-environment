type ProgressMarker = {
  seconds: number;
  label: string;
  tone?: "fuchsia" | "cyan" | "amber";
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
  formatTime: (value: number) => string;
  markers?: ProgressMarker[];
  ranges?: ProgressRange[];
  secondaryDuration?: number;
  secondaryLabel?: string;
  secondaryMarkers?: ProgressMarker[];
  secondaryRanges?: ProgressRange[];
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
      pill: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100/85",
    };
  }

  if (tone === "amber") {
    return {
      line: "bg-amber-300/80",
      pill: "border-amber-300/20 bg-amber-300/10 text-amber-100/85",
    };
  }

  return {
    line: "bg-fuchsia-300/80",
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
  formatTime,
  markers = [],
  ranges = [],
  secondaryDuration,
  secondaryLabel,
  secondaryMarkers = [],
  secondaryRanges = [],
}: PlayerProgressBarProps) {
  return (
    <div className="mt-4">
        <div className="pointer-events-none absolute inset-0">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onInput={(event) => onSeek(Number((event.target as HTMLInputElement).value))}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={duration <= 0}
            className="pointer-events-auto h-2 w-full cursor-pointer accent-fuchsia-400 disabled:cursor-not-allowed"
            aria-label="快轉播放進度"
          />
        {markers.map((marker) => {
          const toneClasses = markerToneClasses(marker.tone);
          const position = clampMarkerPosition(marker.seconds, duration);

          return (
            <div
              key={`${marker.label}-${marker.seconds}`}
              className="pointer-events-none absolute inset-y-0"
              style={{ left: `${position}%` }}
            >
              <div className={`absolute bottom-3 h-5 w-px -translate-x-1/2 ${toneClasses.line}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-white/50">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      {ranges.length > 0 ? (
        <div className="mt-3 rounded-[18px] border border-white/10 bg-white/6 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-white/45">
            <span>當前轉場區段</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-white/8">
            {ranges.map((range) => (
              <div
                key={`${range.label}-${range.startSeconds}-${range.endSeconds}`}
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
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {ranges.map((range) => {
              const toneClasses = markerToneClasses(range.tone);

              return (
                <span
                  key={`range-legend-${range.label}-${range.startSeconds}-${range.endSeconds}`}
                  className={`rounded-full border px-3 py-1 ${toneClasses.pill}`}
                >
                  {range.label} {formatTime(range.startSeconds)} - {formatTime(range.endSeconds)}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
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
      {secondaryDuration && secondaryDuration > 0 ? (
        <div className="mt-4 rounded-[18px] border border-white/10 bg-white/6 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-white/45">
            <span>{secondaryLabel ?? "下一首進點"}</span>
            <span>{formatTime(secondaryDuration)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-white/8">
            {secondaryRanges.map((range) => (
              <div
                key={`secondary-range-${range.label}-${range.startSeconds}-${range.endSeconds}`}
                className={`absolute inset-y-0 rounded-full ${rangeToneClasses(range.tone)}`}
                style={buildRangeStyle(range.startSeconds, range.endSeconds, secondaryDuration)}
              />
            ))}
            {secondaryMarkers.map((marker) => {
              const toneClasses = markerToneClasses(marker.tone);
              const position = clampMarkerPosition(marker.seconds, secondaryDuration);

              return (
                <div
                  key={`secondary-${marker.label}-${marker.seconds}`}
                  className="pointer-events-none absolute inset-y-0"
                  style={{ left: `${position}%` }}
                >
                  <div className={`absolute top-0 h-2 w-px -translate-x-1/2 ${toneClasses.line}`} />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {secondaryRanges.map((range) => {
              const toneClasses = markerToneClasses(range.tone);

              return (
                <span
                  key={`secondary-range-legend-${range.label}-${range.startSeconds}-${range.endSeconds}`}
                  className={`rounded-full border px-3 py-1 ${toneClasses.pill}`}
                >
                  {range.label} {formatTime(range.startSeconds)} - {formatTime(range.endSeconds)}
                </span>
              );
            })}
            {secondaryMarkers.map((marker) => {
              const toneClasses = markerToneClasses(marker.tone);

              return (
                <span
                  key={`secondary-legend-${marker.label}-${marker.seconds}`}
                  className={`rounded-full border px-3 py-1 ${toneClasses.pill}`}
                >
                  {marker.label} {formatTime(marker.seconds)}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
