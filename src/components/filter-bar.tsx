'use client';

type FilterBarProps = {
  bpmOptions: readonly number[];
  activeBpms: number[];
  visibleCount: number;
  selectedCount: number;
  activeCollectionLabel: string;
  onToggleBpm: (bpm: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

export function FilterBar({
  bpmOptions,
  activeBpms,
  visibleCount,
  selectedCount,
  activeCollectionLabel,
  onToggleBpm,
  onSelectAll,
  onClearSelection,
}: FilterBarProps) {
  return (
    <section className="relative rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(6,8,20,0.44)] backdrop-blur-2xl md:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/35 to-transparent" />
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">依節奏挑選</p>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/62">
              目前瀏覽 {activeCollectionLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {bpmOptions.map((bpm) => {
              const isActive = activeBpms.includes(bpm);

              return (
                <button
                  key={bpm}
                  type="button"
                  onClick={() => onToggleBpm(bpm)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-fuchsia-300/70 bg-fuchsia-400/18 text-fuchsia-50 shadow-[0_0_24px_rgba(217,70,239,0.24)]"
                      : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white"
                  }`}
                  aria-pressed={isActive}
                >
                  {bpm} BPM
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-full border border-cyan-300/20 bg-cyan-300/12 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/18"
            >
              加入目前顯示
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white/72 transition hover:border-white/20 hover:text-white"
            >
              清空播放清單
            </button>
          </div>
          <p className="text-sm text-white/64">
            目前顯示 {visibleCount} 首，播放清單已有 {selectedCount} 首。
          </p>
        </div>
      </div>
    </section>
  );
}
