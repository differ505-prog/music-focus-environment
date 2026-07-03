'use client';

import type { Track } from "@/types/music";
import type { BpmCompatibility } from "@/lib/bpm-lanes";

type RecommendationItem = {
  track: Track;
  compatibility: BpmCompatibility;
};

type BpmRecommendationPanelProps = {
  currentTrack: Track | null;
  recommendations: RecommendationItem[];
  onPlayTrack: (assetId: string) => void;
};

function getCompatibilityTone(status: BpmCompatibility["status"]) {
  if (status === "exact") {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/85";
  }

  if (status === "adjacent") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100/85";
  }

  return "border-rose-300/20 bg-rose-300/10 text-rose-100/85";
}

export function BpmRecommendationPanel({
  currentTrack,
  recommendations,
  onPlayTrack,
}: BpmRecommendationPanelProps) {
  if (!currentTrack) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">Keep Listening</p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">接著聽這幾首</h2>
          <p className="mt-2 text-sm leading-7 text-white/66">
            正在播放 {currentTrack.title}，下面這幾首最適合延續目前的聆聽狀態。
          </p>
        </div>

        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {recommendations.map(({ track, compatibility }) => (
              <button
                key={track.id}
                type="button"
                onClick={() => onPlayTrack(track.id)}
                className="rounded-[22px] border border-white/10 bg-black/18 p-4 text-left transition hover:border-white/20 hover:bg-white/8"
              >
                <p className="text-[11px] uppercase tracking-[0.26em] text-white/42">{track.bpm} BPM</p>
                <h3 className="mt-3 font-medium text-white">{track.title}</h3>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${getCompatibilityTone(
                    compatibility.status,
                  )}`}
                >
                  {compatibility.status === "exact" ? "延續最順" : compatibility.status === "adjacent" ? "節奏接近" : compatibility.label}
                </span>
                <p className="mt-3 text-sm leading-6 text-white/58">{track.copy.descriptionZh}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-sm leading-7 text-white/62">
              這首歌目前較適合單獨播放。若想維持相同氛圍，建議先回到同一系列繼續聽。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
