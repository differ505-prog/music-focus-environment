'use client';

import Image from "next/image";
import type { RefObject } from "react";

type PlayerArtworkStageProps = {
  artworkContainerRef: RefObject<HTMLDivElement | null>;
  artworkSrc: string;
  trackTitle: string;
  detailLine: string;
  footerLabel: string;
  isProjectionMode: boolean;
  isArtworkFullscreen: boolean;
  isPureProjection: boolean;
  isProjectionHudVisible: boolean;
  isProjectionCursorHidden: boolean;
  onBackgroundClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onRevealHud: () => void;
  onToggleFullscreen: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export function PlayerArtworkStage({
  artworkContainerRef,
  artworkSrc,
  trackTitle,
  detailLine,
  footerLabel,
  isProjectionMode,
  isArtworkFullscreen,
  isPureProjection,
  isProjectionHudVisible,
  isProjectionCursorHidden,
  onBackgroundClick,
  onRevealHud,
  onToggleFullscreen,
}: PlayerArtworkStageProps) {
  return (
    <div
      ref={artworkContainerRef}
      onClick={onBackgroundClick}
      onMouseMove={onRevealHud}
      onTouchStart={onRevealHud}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#02040a]/96 p-4 md:p-8 ${
        isProjectionMode && isProjectionCursorHidden ? "cursor-none" : ""
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.16),transparent_26%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_32%)] animate-projection-breathe" />
      <Image
        src={artworkSrc}
        alt={trackTitle}
        fill
        className="projection-artwork-glow object-cover opacity-22 blur-2xl"
        unoptimized
      />
      <div
        className={`pointer-events-none absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/22 px-4 py-3 text-[11px] uppercase tracking-[0.26em] text-white/52 backdrop-blur-xl transition duration-500 md:left-8 md:right-8 ${
          isProjectionHudVisible && !isArtworkFullscreen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <span>{isProjectionMode ? "全螢幕封面" : "封面檢視"}</span>
        <span>{isProjectionMode ? "Esc 關閉 / 雙擊切換全螢幕" : "雙擊切換全螢幕"}</span>
      </div>
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <div
          className={`projection-stage relative aspect-[16/9] w-full max-w-[min(92vw,180vh)] overflow-hidden bg-black/28 ${
            isPureProjection
              ? "h-full w-full max-w-none rounded-none border-none shadow-none"
              : "rounded-[32px] border border-white/10 shadow-[0_34px_110px_rgba(0,0,0,0.45)]"
          } ${isProjectionMode ? "projection-stage-drift" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onDoubleClick={onToggleFullscreen}
        >
          {!isPureProjection ? (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_28%,transparent_72%,rgba(255,255,255,0.03))]" />
          ) : null}
          <Image
            src={artworkSrc}
            alt={trackTitle}
            fill
            className={isPureProjection ? "object-contain projection-pure-drift" : "object-contain"}
            unoptimized
            priority
          />
        </div>
      </div>
      <div
        className={`pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex justify-center transition duration-500 md:bottom-8 ${
          isProjectionHudVisible && !isArtworkFullscreen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className="max-w-4xl rounded-[28px] border border-white/10 bg-black/26 px-5 py-4 text-center backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-fuchsia-100/52">
            {isProjectionMode ? "全螢幕封面" : "正在播放"}
          </p>
          <h3 className="mt-3 font-serif text-2xl text-white md:text-4xl">{trackTitle}</h3>
          <p className="mt-2 text-sm text-white/56 md:text-base">{detailLine}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/38">{footerLabel}</p>
        </div>
      </div>
    </div>
  );
}
