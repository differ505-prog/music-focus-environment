'use client';

import { ListMusic } from "lucide-react";

import type { AutoDjSessionPlan, Track } from "@/types/music";

type PlayerPlaylistStripProps = {
  playlist: Track[];
  currentTrackId: string | null;
  nextTrackId: string | null;
  showAdminDetails: boolean;
  sessionPlan: AutoDjSessionPlan | null;
  onPlayTrack: (assetId: string) => void;
};

export function PlayerPlaylistStrip({
  playlist,
  currentTrackId,
  nextTrackId,
  showAdminDetails,
  sessionPlan,
  onPlayTrack,
}: PlayerPlaylistStripProps) {
  return (
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
            const isCurrent = currentTrackId === track.id;
            const isNext = nextTrackId === track.id;

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
  );
}
