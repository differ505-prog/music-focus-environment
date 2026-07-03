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
      {hideTitle ? <div /> : (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-fuchsia-100/60">
          <Waves className="h-4 w-4" />
          {title}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2">
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
          className={`rounded-full border border-white/10 bg-white/8 text-white/70 transition hover:bg-white/12 hover:text-white ${
            compact ? "p-3" : "p-2"
          }`}
          aria-label={compact ? "展開播放器" : "縮小播放器"}
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-full border border-white/10 bg-white/8 text-white/70 transition hover:bg-white/12 hover:text-white ${
            compact ? "p-3" : "p-2"
          }`}
          aria-label="關閉播放器"
        >
          {compact ? <X className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
