import type { ReactNode } from "react";

import { generatedSceneImageUrl } from "@/data/music-assets";
import { StudioNav } from "@/components/studio-nav";

type AppSceneShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  bottomPaddingClassName: string;
  badges?: string[];
  children: ReactNode;
};

export function AppSceneShell({
  eyebrow,
  title,
  description,
  bottomPaddingClassName,
  badges = [],
  children,
}: AppSceneShellProps) {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#02060b] text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,3,11,0.66), rgba(2,5,15,0.94)), url("${generatedSceneImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.22),transparent_28%),radial-gradient(circle_at_right,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.12),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,transparent_22%,transparent_80%,rgba(255,255,255,0.03)_100%)]" />

      <div
        className={`relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pt-8 md:px-8 md:pt-12 ${bottomPaddingClassName}`}
      >
        <StudioNav />

        <section className="relative rounded-[36px] border border-fuchsia-400/18 bg-black/26 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.52)] backdrop-blur-3xl md:p-10">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/45 to-transparent" />
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.38em] text-fuchsia-100/58">{eyebrow}</p>
            <h1 className="mt-4 max-w-2xl bg-gradient-to-r from-white via-fuchsia-100 to-cyan-100 bg-clip-text font-serif text-4xl leading-tight text-transparent md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 md:text-base">{description}</p>
            {badges.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/60">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/12 bg-white/8 px-4 py-2"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}
