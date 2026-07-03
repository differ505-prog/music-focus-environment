'use client';

import { MediaCard } from "@/components/media-card";
import type { BpmCompatibility } from "@/lib/bpm-lanes";
import type { ThemeProgram, Track } from "@/types/music";

export type PublicRouteEntry = {
  program: ThemeProgram;
  programTracks: Track[];
  configuredBpms: number[];
  subroutes: Array<{
    bpm: number;
    tracks: Track[];
    totalMinutes: number;
  }>;
  totalMinutes: number;
};

type PublicFocusBrowserProps = {
  routeEntries: PublicRouteEntry[];
  activeRouteId: string;
  activeRouteBpm: number | null;
  selectedIds: string[];
  playbackCurrentTrackId: string | null;
  playbackNextTrackId: string | null;
  bpmCompatibilityMap: Map<string, BpmCompatibility | null>;
  onSelectRoute: (routeId: string) => void;
  onSelectBpm: (bpm: number) => void;
  onRandomPlay: () => void;
  onQueueTracks: () => void;
  onClearSelection: () => void;
  onToggleTrack: (assetId: string) => void;
  onPlayTrack: (assetId: string) => void;
};

export function PublicFocusBrowser({
  routeEntries,
  activeRouteId,
  activeRouteBpm,
  selectedIds,
  playbackCurrentTrackId,
  playbackNextTrackId,
  bpmCompatibilityMap,
  onSelectRoute,
  onSelectBpm,
  onRandomPlay,
  onQueueTracks,
  onClearSelection,
  onToggleTrack,
  onPlayTrack,
}: PublicFocusBrowserProps) {
  const activeRouteEntry = routeEntries.find((entry) => entry.program.id === activeRouteId) ?? routeEntries[0] ?? null;
  const activeSubroute =
    activeRouteEntry?.subroutes.find((subroute) => subroute.bpm === activeRouteBpm) ?? activeRouteEntry?.subroutes[0] ?? null;
  const visibleTracks = activeSubroute?.tracks ?? [];

  return (
    <>
      <div className="mt-8 rounded-[30px] border border-white/10 bg-white/6 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">現在想聽什麼</p>
            <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">直接選一個狀態</h2>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="播放狀態">
          {routeEntries.map(({ program, configuredBpms }) => {
            const isActive = activeRouteEntry?.program.id === program.id;

            return (
              <button
                key={program.id}
                type="button"
                onClick={() => onSelectRoute(program.id)}
                className={`rounded-[26px] border p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/8 xl:p-4 ${
                  isActive
                    ? "border-fuchsia-300/34 bg-fuchsia-300/10 shadow-[0_0_36px_rgba(217,70,239,0.14)] ring-1 ring-white/12"
                    : "border-white/10 bg-black/18"
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/48">{configuredBpms.join(" / ")} BPM</p>
                <h3 className="mt-3 font-serif text-2xl text-white xl:text-xl">{program.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/68 xl:text-[13px] xl:leading-5">{program.summary}</p>
              </button>
            );
          })}
        </section>
      </div>

      <section className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">節奏</p>
            <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">
              {activeRouteEntry?.program.title ?? "選一個狀態"}
            </h2>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="節奏選擇">
          {activeRouteEntry?.subroutes.map((subroute) => {
            const isActive = activeSubroute?.bpm === subroute.bpm;

            return (
              <button
                key={`${activeRouteEntry.program.id}-${subroute.bpm}`}
                type="button"
                onClick={() => onSelectBpm(subroute.bpm)}
                className={`rounded-[28px] border p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${
                  isActive
                    ? "border-fuchsia-300/28 bg-fuchsia-300/10 shadow-[0_0_40px_rgba(217,70,239,0.16)] ring-1 ring-white/14"
                    : "border-white/10 bg-white/6"
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/52">節奏</p>
                <h3 className="mt-3 font-serif text-2xl text-white">{subroute.bpm} BPM</h3>
                <p className="mt-3 text-sm leading-6 text-white/68">{subroute.tracks.length > 0 ? "直接進入" : "暫時沒有歌曲"}</p>
              </button>
            );
          })}
        </section>
      </section>

      <section className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">直接播放</p>
            <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">
              {activeSubroute ? `${activeSubroute.bpm} BPM` : "選一個節奏"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">
              {activeSubroute ? "挑一首，或直接開始。" : "先選一個節奏。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRandomPlay}
              disabled={visibleTracks.length === 0}
              className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              隨機播放
            </button>
            <button
              type="button"
              onClick={onQueueTracks}
              disabled={visibleTracks.length === 0}
              className="rounded-full border border-cyan-300/20 bg-cyan-300/12 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              加入播放清單
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white/72 transition hover:border-white/20 hover:text-white"
            >
              清空清單
            </button>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="歌曲清單">
          {visibleTracks.length > 0 ? (
            visibleTracks.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                compatibility={bpmCompatibilityMap.get(asset.id) ?? null}
                checked={selectedIds.includes(asset.id)}
                isCurrent={playbackCurrentTrackId === asset.id}
                isNext={playbackNextTrackId === asset.id}
                onToggle={onToggleTrack}
                onPlayTrack={onPlayTrack}
              />
            ))
          ) : (
            <div className="col-span-full rounded-[28px] border border-white/10 bg-white/6 p-8 text-center text-white/68">
              這個節奏暫時沒有歌曲。
            </div>
          )}
        </section>
      </section>
    </>
  );
}
