'use client';

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  bpmOptions,
  generatedSceneImageUrl,
  mixEvents,
  mixSessions,
  sessionPresets,
  trackBatches,
  trackCollections,
  themePrograms,
  tracks,
} from "@/data/music-assets";
import { FilterBar } from "@/components/filter-bar";
import { BpmRecommendationPanel } from "@/components/bpm-recommendation-panel";
import { BpmAnalysisPanel } from "@/components/bpm-analysis-panel";
import { MediaCard } from "@/components/media-card";
import { MixInsightsPanel } from "@/components/mix-insights-panel";
import { usePlayback } from "@/components/playback-provider";
import { StudioNav } from "@/components/studio-nav";
import { ThemeProgramPanel } from "@/components/theme-program-panel";
import { ThemeProgramShowcase } from "@/components/theme-program-showcase";
import { getBpmCompatibility, rankTracksForMixing } from "@/lib/bpm-lanes";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type FocusStudioAppProps = {
  mode?: "public" | "admin";
};

export function FocusStudioApp({ mode = "public" }: FocusStudioAppProps) {
  const [activeBpms, setActiveBpms] = useState<number[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>("all");
  const [isDownloading, setIsDownloading] = useState(false);
  const { selectedIds, setSelectedIds, selectedAssets, currentTrack, playback, toggleAsset, playTrack, startSession } =
    usePlayback();

  const trackMap = useMemo(() => {
    return new Map(tracks.map((track) => [track.id, track]));
  }, []);

  const activeCollection = useMemo(() => {
    return activeCollectionId === "all"
      ? null
      : trackCollections.find((collection) => collection.id === activeCollectionId) ?? null;
  }, [activeCollectionId]);

  const defaultHeroCollection = useMemo(() => {
    return trackCollections.find((collection) => collection.id === "featured-obsidian-waters") ?? trackCollections[0] ?? null;
  }, []);

  const nightLedgerCollection = useMemo(() => {
    return trackCollections.find((collection) => collection.id === "night-ledger-series") ?? null;
  }, []);

  const collectionForDetail = activeCollection ?? defaultHeroCollection;

  const collectionTracks = useMemo(() => {
    if (!collectionForDetail) {
      return [];
    }

    return collectionForDetail.trackIds
      .map((trackId) => tracks.find((track) => track.id === trackId) ?? null)
      .filter((track): track is (typeof tracks)[number] => Boolean(track));
  }, [collectionForDetail]);

  const collectionBatch = useMemo(() => {
    if (!collectionForDetail) {
      return null;
    }

    return (
      trackBatches.find((batch) =>
        collectionForDetail.trackIds.every((trackId) => batch.trackIds.includes(trackId)),
      ) ?? null
    );
  }, [collectionForDetail]);

  const collectionAverageMinutes = useMemo(() => {
    if (collectionTracks.length === 0) {
      return 0;
    }

    const totalSeconds = collectionTracks.reduce((sum, track) => sum + track.durationSeconds, 0);
    return Math.round(totalSeconds / collectionTracks.length / 60);
  }, [collectionTracks]);

  const collectionPresets = useMemo(() => {
    if (!collectionForDetail) {
      return [];
    }

    return sessionPresets.filter((preset) => preset.collectionId === collectionForDetail.id);
  }, [collectionForDetail]);

  const filteredAssets = useMemo(() => {
    return tracks.filter((asset) => {
      const matchesBpm = activeBpms.length === 0 || activeBpms.includes(asset.bpm);
      const matchesCollection = !activeCollection || activeCollection.trackIds.includes(asset.id);
      return matchesBpm && matchesCollection;
    });
  }, [activeBpms, activeCollection]);

  const featuredCollections = useMemo(() => {
    return trackCollections.slice(0, 3);
  }, []);

  const featuredTrackCount = useMemo(() => {
    return tracks.filter((track) => track.featured).length;
  }, []);

  const latestBatch = useMemo(() => {
    return [...trackBatches].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0] ?? null;
  }, []);

  const bpmCompatibilityMap = useMemo(() => {
    const entries = tracks.map((track) => {
      if (!currentTrack || currentTrack.id === track.id) {
        return [track.id, null] as const;
      }

      return [track.id, getBpmCompatibility(currentTrack.bpm, track.bpm)] as const;
    });

    return new Map(entries);
  }, [currentTrack]);

  const recommendedMixes = useMemo(() => {
    return rankTracksForMixing(currentTrack, tracks)
      .filter((item) => item.compatibility.isRecommended)
      .slice(0, 3);
  }, [currentTrack]);

  const mixInsights = useMemo(() => {
    const publicSessions = mixSessions.filter((session) => session.listenerMode === "public_mix");
    const savedMixCount = mixEvents.filter((event) => event.type === "save_mix").length;
    const avgCompletionRate = publicSessions.length
      ? Math.round(
          (publicSessions.reduce((sum, session) => sum + session.completionRate, 0) / publicSessions.length) * 100,
        )
      : 0;

    const transitionCounter = new Map<string, { label: string; count: number }>();
    for (const event of mixEvents) {
      if (event.type !== "transition_complete" || !event.fromTrackId || !event.toTrackId) {
        continue;
      }

      const fromTrack = trackMap.get(event.fromTrackId);
      const toTrack = trackMap.get(event.toTrackId);
      const key = `${event.fromTrackId}:${event.toTrackId}`;
      const current = transitionCounter.get(key);
      const label = fromTrack && toTrack ? `${fromTrack.title} -> ${toTrack.title}` : key;

      transitionCounter.set(key, {
        label,
        count: (current?.count ?? 0) + 1,
      });
    }

    const topTransition =
      Array.from(transitionCounter.values()).sort((left, right) => right.count - left.count)[0] ?? null;

    return {
      publishedCount: tracks.filter((track) => track.status === "published").length,
      publicSessionCount: publicSessions.length,
      savedMixCount,
      avgCompletionRate,
      topTransitionLabel: topTransition?.label ?? "尚無資料",
      topTransitionCount: topTransition?.count ?? 0,
    };
  }, [trackMap]);

  const toggleBpm = (bpm: number) => {
    setActiveBpms((current: number[]) => {
      return current.includes(bpm) ? current.filter((item) => item !== bpm) : [...current, bpm];
    });
  };

  const toggleCollection = (collectionId: string) => {
    setActiveCollectionId((current) => (current === collectionId ? "all" : collectionId));
  };

  const handleSelectAll = () => {
    setSelectedIds((current: string[]) => {
      const merged = new Set([...current, ...filteredAssets.map((asset) => asset.id)]);
      return Array.from(merged);
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleDownload = async () => {
    if (selectedAssets.length === 0 || isDownloading) {
      return;
    }

    setIsDownloading(true);

    try {
      for (const asset of selectedAssets) {
        const link = document.createElement("a");
        link.href = asset.media.audioUrl;
        link.download = `${asset.title.toLowerCase().replace(/\s+/g, "-")}.mp3`;
        link.rel = "noopener";
        document.body.append(link);
        link.click();
        link.remove();
        await wait(150);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartCollectionSession = (collectionId: string) => {
    const targetCollection = trackCollections.find((collection) => collection.id === collectionId);

    if (!targetCollection || targetCollection.trackIds.length === 0) {
      return;
    }

    setActiveCollectionId(collectionId);
    startSession(targetCollection.trackIds, targetCollection.trackIds[0]);
  };

  const handleStartPresetSession = (presetId: string) => {
    const preset = sessionPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setActiveCollectionId(preset.collectionId);
    startSession(preset.trackIds, preset.trackIds[0]);
  };

  const isAdmin = mode === "admin";
  const heroTitle = isAdmin ? "音樂創作後台工作台" : "音樂創作與專注力環境";
  const heroDescription = isAdmin
    ? "集中管理主題作戰手冊、轉場參數、生成資料與 mix 數據，現在每條內容線都內建自己的策略藍圖、SOP、Prompt 模組與驗收清單。"
    : "以 CEO Deep Focus 與 BPM180 慢跑兩條內容線為核心，現在加入 Featured Collections 與批次視角，讓使用者能先進入完整情境，再挑選最適合當下工作的曲目。";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#02060b] text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,3,11,0.66), rgba(2,5,15,0.94)), url("${generatedSceneImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.22),transparent_28%),radial-gradient(circle_at_right,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.12),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,transparent_22%,transparent_80%,rgba(255,255,255,0.03)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[31rem] pt-8 md:px-8 md:pb-[24rem] md:pt-12">
        <StudioNav />

        <section className="relative rounded-[36px] border border-fuchsia-400/18 bg-black/26 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.52)] backdrop-blur-3xl md:p-10">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/45 to-transparent" />
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.38em] text-fuchsia-100/58">
              {isAdmin ? "Internal Studio Workspace" : "CEO Mindset Environment"}
            </p>
            <h1 className="mt-4 max-w-2xl bg-gradient-to-r from-white via-fuchsia-100 to-cyan-100 bg-clip-text font-serif text-4xl leading-tight text-transparent md:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
              {heroDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/60">
              <span className="rounded-full border border-fuchsia-300/18 bg-fuchsia-300/10 px-4 py-2">
                Dark Mode
              </span>
              <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2">
                Glassmorphism
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                Howler.js Crossfade
              </span>
              {isAdmin ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2">
                  Theme Operations Manual
                </span>
              ) : null}
            </div>
            {!isAdmin ? (
              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => defaultHeroCollection && handleStartCollectionSession(defaultHeroCollection.id)}
                  className="rounded-[26px] border border-fuchsia-300/20 bg-fuchsia-300/10 p-5 text-left transition hover:-translate-y-0.5 hover:bg-fuchsia-300/14"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-fuchsia-100/62">Start Session</p>
                  <h3 className="mt-3 font-serif text-2xl text-white">立即開始 Focus Session</h3>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    直接載入 {defaultHeroCollection?.title ?? "精選系列"}，打開播放器並從第一首開始進入工作狀態。
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => nightLedgerCollection && handleStartCollectionSession(nightLedgerCollection.id)}
                  className="rounded-[26px] border border-cyan-300/20 bg-cyan-300/10 p-5 text-left transition hover:-translate-y-0.5 hover:bg-cyan-300/14"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/62">Night Workflow</p>
                  <h3 className="mt-3 font-serif text-2xl text-white">開始深夜理性工作</h3>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    載入 Night Ledger 系列，適合寫作、校對、財務整理與長時間低干擾專注。
                  </p>
                </button>
                <div className="rounded-[26px] border border-white/10 bg-white/6 p-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/44">Now Context</p>
                  <h3 className="mt-3 font-serif text-2xl text-white">
                    {currentTrack ? `正在播放 ${currentTrack.title}` : "尚未開始播放"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {currentTrack
                      ? `目前播放清單 ${selectedAssets.length} 首，可直接用下方系列詳情與推薦區塊繼續擴充 session。`
                      : "先從上方任一入口開始 session，再往下用系列詳情與 BPM filter 精修你的工作場景。"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {!isAdmin ? (
          <section className="mt-6 rounded-[30px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">Session Presets</p>
                <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">把播放體驗包裝成可直接啟動的工作包</h2>
                <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">
                  這一層不是單首歌，而是可以直接開始的 session preset。使用者不需要自己先組清單，就能從首頁進入明確任務。
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              {sessionPresets.map((preset) => (
                <article
                  key={preset.id}
                  className="rounded-[24px] border border-white/10 bg-white/6 p-5 text-sm text-white/72"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">{preset.label}</p>
                  <h3 className="mt-3 font-serif text-2xl text-white">{preset.title}</h3>
                  <p className="mt-3 leading-6 text-white/68">{preset.summary}</p>
                  <p className="mt-3 leading-6 text-white/58">{preset.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
                    <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5">
                      {preset.durationMinutes} 分鐘
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                      {preset.trackIds.length} 首曲目
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleStartPresetSession(preset.id)}
                      className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/18"
                    >
                      啟動 Preset
                    </button>
                    <Link
                      href={`/collections/${preset.collectionId}`}
                      className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/76 transition hover:bg-white/12 hover:text-white"
                    >
                      查看系列頁
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!isAdmin ? (
          <section className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">Featured Collections</p>
                <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">先選情境，再進入曲目庫</h2>
                <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">
                  這一層把單首卡片整理成可直接進入的內容入口，讓首頁更像精品化音樂產品，而不是只有歌曲清單。
                </p>
              </div>
              {latestBatch ? (
                <div className="rounded-[24px] border border-amber-300/16 bg-amber-300/8 p-4 text-sm text-white/72">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-100/70">Latest Batch</p>
                  <p className="mt-2 font-medium text-white">{latestBatch.title}</p>
                  <p className="mt-2 text-white/60">{latestBatch.summary}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setActiveCollectionId("all")}
                className={`rounded-[28px] border border-white/10 bg-white/6 p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${
                  activeCollectionId === "all" ? "shadow-[0_0_40px_rgba(255,255,255,0.08)] ring-1 ring-white/14" : ""
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/52">Library View</p>
                <h3 className="mt-3 font-serif text-2xl text-white">All Library</h3>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  回到完整曲目庫，搭配 BPM filter 直接瀏覽全站內容，不套用特定策展系列。
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    {tracks.length} 首曲目
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    {bpmOptions.join(" / ")} BPM
                  </span>
                </div>
              </button>
              {featuredCollections.map((collection) => {
                const isActive = activeCollectionId === collection.id;
                const toneClasses =
                  collection.tone === "cyan"
                    ? "border-cyan-300/18 bg-cyan-300/8"
                    : collection.tone === "amber"
                      ? "border-amber-300/18 bg-amber-300/8"
                      : "border-fuchsia-300/18 bg-fuchsia-300/8";

                return (
                  <article
                    key={collection.id}
                    className={`rounded-[28px] border p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${toneClasses} ${
                      isActive ? "shadow-[0_0_40px_rgba(217,70,239,0.16)] ring-1 ring-white/14" : ""
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/52">{collection.label}</p>
                    <h3 className="mt-3 font-serif text-2xl text-white">{collection.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/68">{collection.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        {collection.heroMetric}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        BPM {collection.bpmFocus.join(" / ")}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        {collection.trackIds.length} 首曲目
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-white/58">{collection.description}</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCollection(collection.id)}
                        className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/76 transition hover:bg-white/10 hover:text-white"
                      >
                        切換首頁視角
                      </button>
                      <Link
                        href={`/collections/${collection.id}`}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-white/76 transition hover:bg-white/12 hover:text-white"
                      >
                        打開系列頁
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-6">
          <FilterBar
            bpmOptions={bpmOptions}
            activeBpms={activeBpms}
            visibleCount={filteredAssets.length}
            selectedCount={selectedAssets.length}
            featuredCollectionCount={featuredCollections.length}
            featuredTrackCount={featuredTrackCount}
            activeCollectionLabel={activeCollection?.title ?? "All Library"}
            latestBatchLabel={latestBatch?.label ?? "尚無批次"}
            isDownloading={isDownloading}
            onToggleBpm={toggleBpm}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onDownload={handleDownload}
          />
        </div>

        <div className="mt-6">
          {isAdmin ? (
            <ThemeProgramPanel mode={mode} programs={themePrograms} />
          ) : (
            <ThemeProgramShowcase programs={themePrograms} tracks={tracks} batches={trackBatches} />
          )}
        </div>

        {!isAdmin && collectionForDetail ? (
          <section className="mt-6 rounded-[30px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">Collection Detail</p>
                <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">{collectionForDetail.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">{collectionForDetail.description}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-white/62">
                <span className="rounded-full border border-fuchsia-300/18 bg-fuchsia-300/10 px-3 py-1.5">
                  {collectionForDetail.heroMetric}
                </span>
                <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5">
                  平均 {collectionAverageMinutes} 分鐘
                </span>
                {collectionBatch ? (
                  <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1.5">
                    {collectionBatch.label}
                  </span>
                ) : null}
                <Link
                  href={`/collections/${collectionForDetail.id}`}
                  className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-white/76 transition hover:bg-white/12 hover:text-white"
                >
                  查看完整系列頁
                </Link>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">Session Launch</p>
                    <h3 className="mt-2 font-serif text-2xl text-white">把系列直接變成播放任務</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartCollectionSession(collectionForDetail.id)}
                    className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/18"
                  >
                    播放整組 Session
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {collectionTracks.map((track, index) => (
                    <button
                      key={`${collectionForDetail.id}-${track.id}`}
                      type="button"
                      onClick={() => startSession(collectionForDetail.trackIds, track.id)}
                      className="rounded-[20px] border border-white/10 bg-black/20 p-4 text-left transition hover:border-white/16 hover:bg-white/8"
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">Track {index + 1}</p>
                      <h4 className="mt-2 font-medium text-white">{track.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-white/62">
                        {track.bpm} BPM · {track.musicalKey} · Energy {track.energyLevel.toFixed(1)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                {collectionPresets.length > 0 ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">Preset Package</p>
                    <div className="mt-3 grid gap-3">
                      {collectionPresets.map((preset) => (
                        <button
                          key={`${collectionForDetail.id}-${preset.id}`}
                          type="button"
                          onClick={() => handleStartPresetSession(preset.id)}
                          className="rounded-[18px] border border-white/10 bg-black/20 p-4 text-left transition hover:border-white/16 hover:bg-white/8"
                        >
                          <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{preset.label}</p>
                          <p className="mt-2 font-medium text-white">{preset.title}</p>
                          <p className="mt-2 text-sm leading-6 text-white/62">{preset.summary}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">Use Case</p>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    {collectionTracks[0]?.copy.themeScenario ??
                      "用這個系列快速進入穩定、低干擾且可持續工作的沉浸式聆聽場景。"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-cyan-300/12 bg-[#07101a]/90 p-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/58">Why It Feels Productized</p>
                  <ul className="mt-3 grid gap-3 text-sm leading-6 text-white/68">
                    <li>不是只挑單首，而是能直接啟動一整組工作 session。</li>
                    <li>系列、批次、BPM 與播放器現在形成同一條任務路徑。</li>
                    <li>首頁即可完成「理解內容 到 開始使用 到 再微調」的閉環。</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <div className="mt-6">
            <BpmAnalysisPanel />
          </div>
        ) : null}

        {!isAdmin && currentTrack ? (
          <div className="mt-6">
            <BpmRecommendationPanel
              currentTrack={currentTrack}
              recommendations={recommendedMixes}
              onPlayTrack={playTrack}
            />
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-6">
            <MixInsightsPanel {...mixInsights} />
          </div>
        ) : null}

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.length > 0 ? (
            filteredAssets.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                mode={mode}
                compatibility={bpmCompatibilityMap.get(asset.id) ?? null}
                checked={selectedIds.includes(asset.id)}
                isCurrent={playback.currentTrackId === asset.id}
                isNext={playback.nextTrackId === asset.id}
                onToggle={toggleAsset}
                onPlayTrack={playTrack}
              />
            ))
          ) : (
            <div className="col-span-full rounded-[28px] border border-white/10 bg-white/6 p-8 text-center text-white/68">
              目前這個系列與 BPM 組合沒有曲目，切回 `All Library` 或放寬 BPM filter 即可看到更多內容。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
