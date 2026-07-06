'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Headphones, Plus, Sparkles } from 'lucide-react';

import { ContentCardOverview } from '@/components/content-card-overview';
import { SmartPlaceholder } from '@/components/ui-system';
import { trackBatches, trackCollections } from '@/data/music-assets';
import type { BpmCompatibility } from '@/lib/bpm-lanes';
import type { Track } from '@/types/music';

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
    return imageErrored ? null : asset.media.coverImageUrl;
  }, [asset.media.coverImageUrl, imageErrored]);

  const fallbackPrompt = useMemo(() => {
    return `${asset.title} ${asset.moodTags.slice(0, 2).join(' ')} music scene`;
  }, [asset]);

  const collectionLabels = useMemo(() => {
    return (asset.collectionIds ?? [])
      .map((collectionId) => trackCollections.find((collection) => collection.id === collectionId)?.label)
      .filter((label): label is string => Boolean(label));
  }, [asset.collectionIds]);

  const primaryCollectionTitle = useMemo(() => {
    const primaryCollectionId = asset.collectionIds?.[0];
    return trackCollections.find((collection) => collection.id === primaryCollectionId)?.title;
  }, [asset.collectionIds]);

  const batchLabel = useMemo(() => {
    return trackBatches.find((batch) => batch.id === asset.batchId)?.label ?? null;
  }, [asset.batchId]);

  const compatibilityTone =
    compatibility?.status === "exact"
      ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
      : compatibility?.status === "adjacent"
        ? "border-amber-300/25 bg-amber-300/12 text-amber-100"
        : "border-rose-300/25 bg-rose-300/12 text-rose-100";

  return (
    <article className="group relative overflow-hidden rounded-[32px] border border-fuchsia-400/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] p-4 shadow-[0_28px_90px_rgba(3,7,18,0.48)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(192,38,211,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_32%)]" />
      <div className="pointer-events-none absolute -inset-x-6 -top-10 h-32 bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_62%)] opacity-70 blur-2xl transition duration-700 group-hover:opacity-100" />
      <div className="relative">
        <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/24 shadow-[0_22px_60px_rgba(0,0,0,0.34)]">
          {imageSrc ? (
            <div className="pointer-events-none absolute inset-0 scale-110">
              <Image
                src={imageSrc}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover opacity-24 blur-3xl saturate-[1.1]"
              />
            </div>
          ) : null}
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={asset.title}
              width={1200}
              height={720}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="h-56 w-full object-cover transition duration-700 group-hover:scale-[1.04] group-hover:saturate-[1.08]"
              onError={() => setImageErrored(true)}
            />
          ) : (
            <SmartPlaceholder
              width={1200}
              height={720}
              label={`${asset.title}`}
              aiPrompt={fallbackPrompt}
              className="h-56 w-full"
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_20%,transparent_56%,rgba(3,7,13,0.78)_100%)]" />
          <div className="absolute inset-0 cinematic-vignette" />
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_62%)] opacity-80" />
          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/12 bg-black/34 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100/82 backdrop-blur-xl">
                {asset.bpm} BPM
              </span>
              {asset.featured && showAdminDetails ? (
                <span className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/16 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-fuchsia-50 backdrop-blur-xl">
                  精選
                </span>
              ) : null}
            </div>
            {showAdminDetails ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-black/32 px-3 py-2 text-xs text-white/75 backdrop-blur-xl">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(asset.id)}
                  className="h-4 w-4 rounded border-white/18 bg-transparent accent-cyan-300"
                />
                選取
              </label>
            ) : null}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <ContentCardOverview
              eyebrow={primaryCollectionTitle ?? "獨立單曲"}
              title={asset.title}
              wrapperClassName="space-y-0 max-w-[70%]"
              eyebrowClassName="text-white/52"
              titleClassName="mt-2 drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
            />
            <button
              type="button"
              onClick={() => onPlayTrack(asset.id)}
              className="rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-2 text-sm font-medium text-cyan-50 shadow-[0_10px_28px_rgba(20,184,166,0.12)] transition hover:bg-cyan-300/20"
            >
              播放
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {showAdminDetails
          ? collectionLabels.map((label) => (
              <span
                key={`${asset.id}-${label}`}
                className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-xs text-fuchsia-100/85"
              >
                {label}
              </span>
            ))
          : null}
        {batchLabel && showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100/85">
            {batchLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
          約 {Math.round(asset.durationSeconds / 60)} 分鐘
        </span>
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
            {asset.musicalKey}
          </span>
        ) : null}
        {showAdminDetails ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
            Energy {asset.energyLevel.toFixed(1)}
          </span>
        ) : null}
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
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
            目前 Mix In {asset.transition.mixInPointSeconds.toFixed(2)}s
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
            下一首
          </span>
        ) : null}
        {compatibility && !isCurrent && showAdminDetails ? (
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
              {showAdminDetails ? "曲目資訊" : "這首歌適合什麼時候播放"}
            </p>
            <p className="leading-6">{asset.copy.descriptionZh}</p>
            {showAdminDetails ? <p className="mt-3 text-white/55">{asset.copy.descriptionEn}</p> : null}
            <p className="mt-3 text-white/52">
              {primaryCollectionTitle ? `收錄於 ${primaryCollectionTitle}` : "獨立曲目"}
              {showAdminDetails && batchLabel ? `，上架批次：${batchLabel}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(showAdminDetails ? asset.moodTags : asset.moodTags.slice(0, 2)).map((tag) => (
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
      {!showAdminDetails ? (
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => onToggle(asset.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              checked
                ? "border-white/16 bg-white/12 text-white"
                : "border-white/10 bg-black/20 text-white/76 hover:border-white/18 hover:text-white"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {checked ? "已加入清單" : "加入清單"}
            </span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
