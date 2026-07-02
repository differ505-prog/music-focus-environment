'use client';

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Headphones, Sparkles } from "lucide-react";

import { generatedSceneImageUrl } from "@/data/music-assets";
import type { BpmCompatibility } from "@/lib/bpm-lanes";
import type { Track } from "@/types/music";

type MediaCardProps = {
  asset: Track;
  mode?: "public" | "admin";
  compatibility?: BpmCompatibility | null;
  checked: boolean;
  isCurrent: boolean;
  isNext: boolean;
  onToggle: (assetId: string) => void;
  onPlayTrack: (assetId: string) => void;
};

export function MediaCard({
  asset,
  mode = "public",
  compatibility = null,
  checked,
  isCurrent,
  isNext,
  onToggle,
  onPlayTrack,
}: MediaCardProps) {
  const [imageErrored, setImageErrored] = useState(false);
  const showAdminDetails = mode === "admin";
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);

  const imageSrc = useMemo(() => {
    return imageErrored ? generatedSceneImageUrl : asset.media.coverImageUrl;
  }, [asset.media.coverImageUrl, imageErrored]);

  const compatibilityTone =
    compatibility?.status === "exact"
      ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
      : compatibility?.status === "adjacent"
        ? "border-amber-300/25 bg-amber-300/12 text-amber-100"
        : "border-rose-300/25 bg-rose-300/12 text-rose-100";

  return (
    <article className="group relative overflow-hidden rounded-[30px] border border-fuchsia-400/12 bg-white/9 p-4 shadow-[0_28px_90px_rgba(3,7,18,0.48)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(192,38,211,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_32%)]" />
      <div className="relative">
      <div className="relative overflow-hidden rounded-[24px]">
        <Image
          src={imageSrc}
          alt={asset.title}
          width={1200}
          height={720}
          className="h-56 w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          onError={() => setImageErrored(true)}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03070d] via-[#03070d]/18 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          <span className="rounded-full border border-white/12 bg-black/32 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100/78 backdrop-blur-xl">
            {asset.bpm} BPM
          </span>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-black/32 px-3 py-2 text-xs text-white/75 backdrop-blur-xl">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(asset.id)}
              className="h-4 w-4 rounded border-white/18 bg-transparent accent-cyan-300"
            />
            選取
          </label>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">
              CEO Focus Library
            </p>
            <h3 className="font-serif text-2xl text-white">{asset.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onPlayTrack(asset.id)}
            className="rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
          >
            播放
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
          {asset.musicalKey}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
          Energy {asset.energyLevel.toFixed(1)}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
          {Math.round(asset.durationSeconds / 60)} min loop
        </span>
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
            {asset.transition.tempoLockBars} Bars Lock
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
            Cue {asset.transition.introCueSeconds.toFixed(2)}s
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
            Fade {asset.transition.crossfadeSeconds.toFixed(2)}s
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
            Mix {asset.transition.mixInPointSeconds}s / {asset.transition.mixOutPointSeconds}s
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
            {asset.transition.sourceLufs.toFixed(1)} LUFS
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100/85">
            Norm {asset.transition.normalizationGainDb > 0 ? "+" : ""}
            {asset.transition.normalizationGainDb.toFixed(2)} dB
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100/85">
            Equal-Power
          </span>
        ) : null}
        {isCurrent ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/12 px-3 py-1 text-xs text-emerald-100">
            <Headphones className="h-3.5 w-3.5" />
            目前播放
          </span>
        ) : null}
        {isNext ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/12 px-3 py-1 text-xs text-amber-100">
            <Sparkles className="h-3.5 w-3.5" />
            下一首 Crossfade
          </span>
        ) : null}
        {checked ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/78">
            <Check className="h-3.5 w-3.5" />
            已加入播放清單
          </span>
        ) : null}
        {compatibility && !isCurrent ? (
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${compatibilityTone}`}>
            {compatibility.label}
          </span>
        ) : null}
      </div>

      {showAdminDetails ? (
        <button
          type="button"
          onClick={() => setIsAdminExpanded((current) => !current)}
          className="mt-5 inline-flex w-full items-center justify-between rounded-[20px] border border-fuchsia-400/16 bg-[#0c0b17]/70 px-4 py-3 text-left text-sm text-white/76 transition hover:bg-[#120f21]"
        >
          <span>歌曲庫資訊欄</span>
          <span className="inline-flex items-center gap-2 text-fuchsia-100/70">
            {isAdminExpanded ? "收合" : "展開"}
            {isAdminExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
      ) : null}

      {!showAdminDetails || isAdminExpanded ? (
        <div className="mt-5 grid gap-4 text-sm text-white/72">
        <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.28em] text-white/40">
            Track Identity
          </p>
          <p className="leading-6">{asset.copy.descriptionZh}</p>
          <p className="mt-3 text-white/55">{asset.copy.descriptionEn}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {asset.moodTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/58"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {showAdminDetails ? (
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-[0.28em] text-white/40">
              Generation Prompt
            </p>
            <p className="line-clamp-4 leading-6">{asset.prompts.generationPrompt}</p>
          </div>
        ) : null}
        {showAdminDetails ? (
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-[0.28em] text-white/40">
              Prompt Assets
            </p>
            <p className="line-clamp-3 leading-6">{asset.prompts.musicPrompt}</p>
            <p className="mt-3 line-clamp-3 leading-6 text-white/55">{asset.prompts.imagePrompt}</p>
            <p className="mt-3 line-clamp-3 leading-6 text-white/45">{asset.prompts.videoPrompt}</p>
          </div>
        ) : null}
      </div>
      ) : null}
      </div>
    </article>
  );
}
