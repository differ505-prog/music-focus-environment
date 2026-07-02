'use client';

type FilterBarProps = {
  bpmOptions: readonly number[];
  activeBpms: number[];
  visibleCount: number;
  selectedCount: number;
  onToggleBpm: (bpm: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

export function FilterBar({
  bpmOptions,
  activeBpms,
  visibleCount,
  selectedCount,
  onToggleBpm,
  onSelectAll,
  onClearSelection,
}: FilterBarProps) {
  return (
    <section className="rounded-[28px] border border-white/12 bg-white/8 p-5 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/60">
            Executive Tempo Filter
          </p>
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
                      ? "border-cyan-300/70 bg-cyan-300/18 text-cyan-50 shadow-[0_0_24px_rgba(116,227,255,0.18)]"
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
              className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/14"
            >
              全選
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white/72 transition hover:border-white/20 hover:text-white"
            >
              取消全選
            </button>
          </div>
          <p className="text-sm text-white/64">
            目前顯示 {visibleCount} 首，已加入清單 {selectedCount} 首
          </p>
        </div>
      </div>
    </section>
  );
}
