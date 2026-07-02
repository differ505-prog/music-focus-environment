'use client';

import { Download, LoaderCircle } from "lucide-react";

type FilterBarProps = {
  bpmOptions: readonly number[];
  activeBpms: number[];
  visibleCount: number;
  selectedCount: number;
  isDownloading: boolean;
  onToggleBpm: (bpm: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownload: () => void;
};

export function FilterBar({
  bpmOptions,
  activeBpms,
  visibleCount,
  selectedCount,
  isDownloading,
  onToggleBpm,
  onSelectAll,
  onClearSelection,
  onDownload,
}: FilterBarProps) {
  return (
    <section className="relative rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(6,8,20,0.44)] backdrop-blur-2xl md:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/35 to-transparent" />
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">
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
              全選
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white/72 transition hover:border-white/20 hover:text-white"
            >
              取消全選
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={selectedCount === 0 || isDownloading}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/18 px-4 py-2 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-400/24 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  下載中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  下載已選取
                </>
              )}
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
