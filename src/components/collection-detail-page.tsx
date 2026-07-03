'use client';

import Link from "next/link";
import { useMemo } from "react";

import { sessionPresets, trackBatches, trackCollections, tracks } from "@/data/music-assets";
import { usePlayback } from "@/components/playback-provider";

type CollectionDetailPageProps = {
  collectionId: string;
};

export function CollectionDetailPage({ collectionId }: CollectionDetailPageProps) {
  const { startSession } = usePlayback();

  const collection = useMemo(() => {
    return trackCollections.find((item) => item.id === collectionId) ?? null;
  }, [collectionId]);

  const collectionTracks = useMemo(() => {
    if (!collection) {
      return [];
    }

    return collection.trackIds
      .map((trackId) => tracks.find((track) => track.id === trackId) ?? null)
      .filter((track): track is (typeof tracks)[number] => Boolean(track));
  }, [collection]);

  const presets = useMemo(() => {
    return sessionPresets.filter((preset) => preset.collectionId === collectionId);
  }, [collectionId]);

  const batch = useMemo(() => {
    if (!collection) {
      return null;
    }

    return (
      trackBatches.find((item) => collection.trackIds.every((trackId) => item.trackIds.includes(trackId))) ?? null
    );
  }, [collection]);

  const totalMinutes = useMemo(() => {
    if (collectionTracks.length === 0) {
      return 0;
    }

    return Math.round(collectionTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60);
  }, [collectionTracks]);

  if (!collection) {
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02060b] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.18),transparent_28%),radial-gradient(circle_at_right,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.1),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="rounded-[34px] border border-fuchsia-400/18 bg-black/26 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.52)] backdrop-blur-3xl md:p-10">
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/8 px-4 py-2 transition hover:bg-white/12 hover:text-white"
            >
              返回首頁
            </Link>
            <span className="rounded-full border border-fuchsia-300/18 bg-fuchsia-300/10 px-4 py-2">{collection.label}</span>
            <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2">
              BPM {collection.bpmFocus.join(" / ")}
            </span>
            {batch ? (
              <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2">{batch.label}</span>
            ) : null}
          </div>

          <h1 className="mt-5 max-w-4xl bg-gradient-to-r from-white via-fuchsia-100 to-cyan-100 bg-clip-text font-serif text-4xl text-transparent md:text-6xl">
            {collection.title}
          </h1>
          <p className="mt-5 max-w-4xl text-sm leading-8 text-white/70 md:text-base">{collection.description}</p>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/62">
            <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">{collection.heroMetric}</span>
            <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">{collectionTracks.length} 首曲目</span>
            <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">總長約 {totalMinutes} 分鐘</span>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">Track List</p>
                <h2 className="mt-3 font-serif text-3xl text-white">系列曲目與播放入口</h2>
              </div>
              {collectionTracks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => startSession(collection.trackIds, collection.trackIds[0])}
                  className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/18"
                >
                  播放整組 Session
                </button>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {collectionTracks.map((track, index) => (
                <button
                  key={`${collection.id}-${track.id}`}
                  type="button"
                  onClick={() => startSession(collection.trackIds, track.id)}
                  className="rounded-[22px] border border-white/10 bg-white/6 p-5 text-left transition hover:border-white/16 hover:bg-white/10"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">Track {index + 1}</p>
                  <h3 className="mt-3 font-serif text-2xl text-white">{track.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/66">{track.copy.descriptionZh}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{track.bpm} BPM</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{track.musicalKey}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                      Energy {track.energyLevel.toFixed(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/58">Preset Package</p>
              <h2 className="mt-3 font-serif text-3xl text-white">可直接啟動的工作包</h2>
              <div className="mt-6 grid gap-4">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => startSession(preset.trackIds, preset.trackIds[0])}
                    className="rounded-[22px] border border-cyan-300/12 bg-cyan-300/6 p-5 text-left transition hover:border-cyan-300/18 hover:bg-cyan-300/10"
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/58">{preset.label}</p>
                    <h3 className="mt-3 font-serif text-2xl text-white">{preset.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/66">{preset.summary}</p>
                    <p className="mt-3 text-sm leading-6 text-white/56">{preset.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{preset.durationMinutes} 分鐘</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{preset.trackIds.length} 首曲目</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-amber-100/58">Scene Brief</p>
              <h2 className="mt-3 font-serif text-3xl text-white">這組系列適合什麼時候打開</h2>
              <p className="mt-4 text-sm leading-7 text-white/68">
                {collectionTracks[0]?.copy.themeScenario ??
                  "這個系列適合用來建立一段穩定、連續且低干擾的沉浸式工作情境。"}
              </p>
              <p className="mt-4 text-sm leading-7 text-white/58">
                這裡把單首、系列、Preset 與播放器打通，讓 collection 不只是內容分類，而是可直接使用的產品單位。
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
