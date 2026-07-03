'use client';

import { Expand } from "lucide-react";

type PlayerArtworkActionsProps = {
  hasArtwork: boolean;
  showAdminDetails: boolean;
  compact?: boolean;
  onOpenArtwork: () => void;
  onOpenProjection: () => void;
};

export function PlayerArtworkActions({
  hasArtwork,
  showAdminDetails,
  compact = false,
  onOpenArtwork,
  onOpenProjection,
}: PlayerArtworkActionsProps) {
  if (!hasArtwork) {
    return null;
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={onOpenArtwork}
          className="rounded-full border border-white/10 bg-white/8 p-3 text-white/75 transition hover:bg-white/12 hover:text-white"
          aria-label="展開封面圖"
        >
          <Expand className="h-4 w-4" />
        </button>
        {showAdminDetails ? (
          <button
            type="button"
            onClick={onOpenProjection}
            className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/12 px-3 py-3 text-[11px] uppercase tracking-[0.24em] text-fuchsia-50 transition hover:bg-fuchsia-400/18"
            aria-label="開啟投影模式"
          >
            投影
          </button>
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpenArtwork}
        className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/70 transition hover:bg-white/12 hover:text-white"
        aria-label="展開封面圖"
      >
        封面
      </button>
      {showAdminDetails ? (
        <button
          type="button"
          onClick={onOpenProjection}
          className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/12 px-4 py-2 text-xs uppercase tracking-[0.24em] text-fuchsia-50 transition hover:bg-fuchsia-400/18"
          aria-label="開啟投影模式"
        >
          投影
        </button>
      ) : null}
    </>
  );
}
