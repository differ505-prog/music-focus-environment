'use client';

import Link from "next/link";

import type { ThemeProgram, Track, TrackBatch } from "@/types/music";

type ThemeProgramShowcaseProps = {
  programs: ThemeProgram[];
  tracks: Track[];
  batches: TrackBatch[];
};

export function ThemeProgramShowcase({ programs, tracks, batches }: ThemeProgramShowcaseProps) {
  return (
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">Listening Modes</p>
        <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">依照使用情境，快速找到適合的音樂路線</h2>
        <p className="mt-3 text-sm leading-7 text-white/66 md:text-base">
          每條內容線都對應不同的工作、移動或空間氛圍，直接挑適合你的那一條就好。
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {programs.map((program) => {
          const programTracks = tracks.filter((track) => track.themeProgramId === program.id);
          const featuredCount = programTracks.filter((track) => track.featured).length;
          const programBatches = batches.filter((batch) => batch.themeProgramId === program.id);
          const liveCollections = new Set(programTracks.flatMap((track) => track.collectionIds ?? [])).size;

          return (
            <article
              key={program.id}
              className="rounded-[24px] border border-white/10 bg-black/18 p-5 text-sm text-white/72"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-fuchsia-100/85">
                  {program.label}
                </span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
                  {program.bpmDisplay}
                </span>
              </div>

              <h3 className="mt-4 font-serif text-2xl text-white">{program.title}</h3>
              <p className="mt-3 leading-7 text-white/66">{program.summary}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">
                  曲目 {programTracks.length}
                </span>
                <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1.5 text-amber-100/80">
                  精選 {featuredCount}
                </span>
                <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5 text-cyan-100/80">
                  批次 {programBatches.length}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  系列 {liveCollections}
                </span>
              </div>

              <div className="mt-5 rounded-[20px] border border-white/8 bg-white/6 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">適用場景</p>
                <p className="mt-2 leading-6 text-white/76">{program.audience}</p>
              </div>

              <div className="mt-4 rounded-[20px] border border-white/8 bg-[#08111c]/90 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/60">你會聽到什麼</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {program.layoutNotes.slice(0, 2).map((note, index) => (
                    <div key={`${program.id}-note-${index + 1}`} className="rounded-[18px] border border-cyan-300/10 bg-cyan-300/6 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/55">重點 {index + 1}</p>
                      <p className="mt-2 leading-6 text-white/68">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {programTracks.length > 0 && liveCollections > 0 ? (
                  <Link
                    href={`/collections/${programTracks[0].collectionIds?.[0] ?? ""}`}
                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/76 transition hover:bg-white/12 hover:text-white"
                  >
                    查看代表系列頁
                  </Link>
                ) : (
                  <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2 text-sm text-amber-100/82">
                    內容線已建好，曲目庫建置中
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
