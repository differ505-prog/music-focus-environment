'use client';

import Link from "next/link";

import type { ThemeProgram, Track } from "@/types/music";

type ThemeProgramShowcaseProps = {
  programs: ThemeProgram[];
  tracks: Track[];
};

export function ThemeProgramShowcase({ programs, tracks }: ThemeProgramShowcaseProps) {
  return (
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">直接播放</p>
        <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">直接挑一條開始</h2>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {programs.map((program) => {
          const programTracks = tracks.filter((track) => track.themeProgramId === program.id);
          const primaryCollectionId = programTracks.find((track) => (track.collectionIds?.length ?? 0) > 0)?.collectionIds?.[0] ?? null;
          const totalMinutes = Math.max(
            1,
            Math.round(programTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60),
          );

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
                  {programTracks.length > 0 ? `約 ${totalMinutes} 分鐘` : "即將推出"}
                </span>
              </div>

              <div className="mt-5 rounded-[20px] border border-white/8 bg-white/6 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">適用情境</p>
                <p className="mt-2 leading-6 text-white/76">{program.audience}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {programTracks.length > 0 && primaryCollectionId ? (
                  <Link
                    href={`/collections/${primaryCollectionId}`}
                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/76 transition hover:bg-white/12 hover:text-white"
                  >
                    查看系列
                  </Link>
                ) : (
                  <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2 text-sm text-amber-100/82">
                    即將推出
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
