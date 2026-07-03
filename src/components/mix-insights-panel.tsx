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
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(7,10,24,0.48)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">
            混音概況
          </p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">
            混音使用概況
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66">
            這裡整理已發布曲目、混音次數與完成率，方便追蹤哪些內容最常被接著聽。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">已發布曲目</p>
            <p className="mt-3 text-3xl font-semibold text-white">{publishedCount}</p>
            <p className="mt-2 text-sm text-white/58">目前可用內容</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">公開混音</p>
            <p className="mt-3 text-3xl font-semibold text-white">{publicSessionCount}</p>
            <p className="mt-2 text-sm text-white/58">目前公開場景數</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">已儲存混音</p>
            <p className="mt-3 text-3xl font-semibold text-white">{savedMixCount}</p>
            <p className="mt-2 text-sm text-white/58">實際保存次數</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">平均聽完率</p>
            <p className="mt-3 text-3xl font-semibold text-white">{avgCompletionRate}%</p>
            <p className="mt-2 text-sm text-white/58">觀看停留表現</p>
          </div>
          <div className="rounded-[22px] border border-fuchsia-400/18 bg-fuchsia-400/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-fuchsia-100/60">熱門接歌</p>
            <p className="mt-3 text-lg font-semibold text-fuchsia-50">{topTransitionLabel}</p>
            <p className="mt-2 text-sm text-fuchsia-50/68">出現 {topTransitionCount} 次</p>
          </div>
        </div>
      </div>
    </section>
  );
}
