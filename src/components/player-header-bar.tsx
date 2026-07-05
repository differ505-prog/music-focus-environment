import { Minimize2, Waves, X } from "lucide-react";

import { PlayerArtworkActions } from "@/components/player-artwork-actions";

type PlayerHeaderBarProps = {
  showAdminDetails: boolean;
  hasArtwork: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  title: string;
  onOpenArtwork: () => void;
  onOpenProjection: () => void;
  onToggleMinimize: () => void;
  onClose: () => void;
};

export function PlayerHeaderBar({
  showAdminDetails,
  hasArtwork,
  compact = false,
  hideTitle = false,
  title,
  onOpenArtwork,
  onOpenProjection,
  onToggleMinimize,
  onClose,
}: PlayerHeaderBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {hideTitle ? null : (
        <div className="inline-flex items-center gap-3 rounded-full border border-fuchsia-300/16 bg-fuchsia-300/8 px-3 py-2 text-[11px] uppercase tracking-[0.32em] text-fuchsia-100/68 shadow-[0_10px_30px_rgba(76,29,149,0.16)]">
          <Waves className="h-4 w-4" />
          {title}
        </div>
      )}
      <div
        className={`flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] shadow-[0_18px_44px_rgba(2,6,23,0.22)] backdrop-blur-2xl ${
          compact ? "px-2 py-2" : "px-2 py-2"
        }`}
      >
        <PlayerArtworkActions
          hasArtwork={hasArtwork}
          showAdminDetails={showAdminDetails}
          compact={compact}
          onOpenArtwork={onOpenArtwork}
          onOpenProjection={onOpenProjection}
        />
        <button
          type="button"
          onClick={onToggleMinimize}
          className={`rounded-full border border-white/10 bg-white/8 text-white/70 transition hover:border-fuchsia-300/20 hover:bg-white/12 hover:text-white ${
            compact ? "p-3" : "p-2.5"
          }`}
          aria-label={compact ? "展開播放器" : "縮小播放器"}
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-full border border-white/10 bg-white/8 text-white/70 transition hover:border-rose-300/20 hover:bg-white/12 hover:text-white ${
            compact ? "p-3" : "p-2.5"
          }`}
          aria-label="關閉播放器"
        >
          {compact ? <X className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
