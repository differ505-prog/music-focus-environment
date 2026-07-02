'use client';

import { Download, LoaderCircle } from "lucide-react";

type SelectionActionBarProps = {
  selectedCount: number;
  isDownloading: boolean;
  onDownload: () => void;
};

export function SelectionActionBar({
  selectedCount,
  isDownloading,
  onDownload,
}: SelectionActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-[7.25rem] z-30 mx-auto w-auto max-w-3xl rounded-[26px] border border-fuchsia-400/18 bg-[#080714]/82 p-4 shadow-[0_24px_80px_rgba(84,12,112,0.26)] backdrop-blur-2xl md:bottom-[6.5rem]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-100/58">
            Batch Action
          </p>
          <p className="mt-1 text-sm text-white/78">
            下載已選取音訊（共 {selectedCount} 項）
          </p>
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/18 px-5 py-3 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-400/24 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isDownloading ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              下載中...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              開始下載
            </>
          )}
        </button>
      </div>
    </div>
  );
}
