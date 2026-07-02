'use client';

type MixInsightsPanelProps = {
  publishedCount: number;
  publicSessionCount: number;
  savedMixCount: number;
  avgCompletionRate: number;
  topTransitionLabel: string;
  topTransitionCount: number;
};

export function MixInsightsPanel({
  publishedCount,
  publicSessionCount,
  savedMixCount,
  avgCompletionRate,
  topTransitionLabel,
  topTransitionCount,
}: MixInsightsPanelProps) {
  return (
    <section className="rounded-[28px] border border-white/12 bg-white/8 p-5 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/60">
            Mix Data Blueprint
          </p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">
            從個人播放到公眾接歌的資料骨架
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66">
            目前首頁已接上 `Track / Transition / MixSession / MixEvent` mock schema，之後你只要持續上歌，
            就能開始累積熱門轉場、保存混音與完播率資料，為 YouTube 剪輯與推薦系統鋪底。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Published</p>
            <p className="mt-3 text-3xl font-semibold text-white">{publishedCount}</p>
            <p className="mt-2 text-sm text-white/58">已發布可接歌曲目</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Public Sessions</p>
            <p className="mt-3 text-3xl font-semibold text-white">{publicSessionCount}</p>
            <p className="mt-2 text-sm text-white/58">可擴充的公眾混音場景</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Saved Mixes</p>
            <p className="mt-3 text-3xl font-semibold text-white">{savedMixCount}</p>
            <p className="mt-2 text-sm text-white/58">可反推 YouTube 選題的保存量</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Avg Completion</p>
            <p className="mt-3 text-3xl font-semibold text-white">{avgCompletionRate}%</p>
            <p className="mt-2 text-sm text-white/58">衡量混音耐聽度與停留品質</p>
          </div>
          <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-300/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/60">Top Transition</p>
            <p className="mt-3 text-lg font-semibold text-cyan-50">{topTransitionLabel}</p>
            <p className="mt-2 text-sm text-cyan-50/68">出現 {topTransitionCount} 次，可作為熱門混剪候選</p>
          </div>
        </div>
      </div>
    </section>
  );
}
