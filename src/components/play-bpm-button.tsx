'use client';

import { Play } from 'lucide-react';

type PlayBpmButtonProps = {
  trackId: string;
  trackTitle: string;
  onPlay: (trackId: string) => void;
  /** 播放中時顯示綠色強調 */
  isPlaying?: boolean;
  /** 當前曲目 ID（用於判斷 isPlaying） */
  currentTrackId?: string | null;
};

export function PlayBpmButton({ trackId, trackTitle, onPlay, currentTrackId }: PlayBpmButtonProps) {
  const isCurrentTrack = currentTrackId === trackId;

  return (
    <button
      type="button"
      onClick={() => onPlay(trackId)}
      aria-label={`播放 ${trackTitle}`}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition"
      style={{
        borderColor: isCurrentTrack ? 'rgba(52, 211, 153, 0.45)' : 'rgba(52, 211, 153, 0.28)',
        backgroundColor: isCurrentTrack ? 'rgba(52, 211, 153, 0.18)' : 'rgba(52, 211, 153, 0.10)',
        color: 'rgba(52, 211, 153, 0.95)',
        transitionProperty: 'background-color, border-color',
        transitionDuration: 'var(--duration-fast)',
        transitionTimingFunction: 'var(--ease-apple-out)',
      }}
      onMouseEnter={(e) => {
        if (!isCurrentTrack) {
          e.currentTarget.style.backgroundColor = 'rgba(52, 211, 153, 0.18)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isCurrentTrack) {
          e.currentTarget.style.backgroundColor = 'rgba(52, 211, 153, 0.10)';
        }
      }}
    >
      <Play
        className="h-3.5 w-3.5 shrink-0"
        style={{
          fill: isCurrentTrack ? 'rgba(52, 211, 153, 0.9)' : 'none',
        }}
      />
      {isCurrentTrack ? '播放中' : '播放'}
    </button>
  );
}
