'use client';

import Link from "next/link";
import { useMemo, useState } from "react";

import { generatedSceneImageUrl, mixEvents, mixSessions, trackBatches, trackCollections, themePrograms, tracks } from "@/data/music-assets";
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

type FocusStudioAppProps = {
  mode?: "public" | "admin";
};

export function FocusStudioApp({ mode = "public" }: FocusStudioAppProps) {
  const [activeBpms, setActiveBpms] = useState<number[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>("all");
  const {
    selectedIds,
    setSelectedIds,
    selectedAssets,
    currentTrack,
    autoDjPlan,
    playback,
    toggleAsset,
    playTrack,
    startSession,
  } =
    usePlayback();

  const trackMap = useMemo(() => {
    return new Map(tracks.map((track) => [track.id, track]));
  }, []);

  const activeCollection = useMemo(() => {
    return activeCollectionId === "all"
      ? null
      : trackCollections.find((collection) => collection.id === activeCollectionId) ?? null;
  }, [activeCollectionId]);

  const filteredAssets = useMemo(() => {
    return tracks.filter((asset) => {
      const matchesBpm = activeBpms.length === 0 || activeBpms.includes(asset.bpm);
      const matchesCollection = !activeCollection || activeCollection.trackIds.includes(asset.id);
      return matchesBpm && matchesCollection;
    });
  }, [activeBpms, activeCollection]);

  const publishedCollections = useMemo(() => {
    return trackCollections;
  }, []);

  const availableBpmOptions = useMemo(() => {
    return Array.from(new Set(tracks.map((track) => track.bpm))).sort((left, right) => left - right);
  }, []);

  const featuredTrackCount = useMemo(() => {
    return tracks.filter((track) => track.featured).length;
  }, []);

  const latestBatch = useMemo(() => {
    return [...trackBatches].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0] ?? null;
  }, []);

  const publicThemeEntries = useMemo(() => {
    return themePrograms.map((program) => {
      const programTracks = tracks.filter((track) => track.themeProgramId === program.id);
      const primaryCollection =
        trackCollections.find((collection) =>
          collection.trackIds.some((trackId) => programTracks.some((track) => track.id === trackId)),
        ) ?? null;

      return {
        program,
        programTracks,
        primaryCollection,
      };
    });
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

  const handleStartThemeSession = (programId: string) => {
    const programTracks = tracks.filter((track) => track.themeProgramId === programId);

    if (programTracks.length === 0) {
      return;
    }

    setActiveCollectionId("all");
    setActiveBpms(Array.from(new Set(programTracks.map((track) => track.bpm))));
    startSession(
      programTracks.map((track) => track.id),
      programTracks[0]?.id,
    );
  };

  const handleBrowseTheme = (programId: string) => {
    const programTracks = tracks.filter((track) => track.themeProgramId === programId);

    setActiveCollectionId("all");
    setActiveBpms(Array.from(new Set(programTracks.map((track) => track.bpm))));
  };

  const isAdmin = mode === "admin";
  const heroTitle = isAdmin ? "OmniSonic 後台工作台" : "OmniSonic";
  const heroDescription = isAdmin
    ? "管理主題藍圖、轉場參數與生成資料，支援各內容線的 Prompt 模組與驗收流程。"
    : "把不同使用情境整理成可直接開始的音樂路線。先選你現在的狀態，再快速進入對應的聆聽體驗。";

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
              {isAdmin ? "Internal Studio Workspace" : "專注音樂路線"}
            </p>
            <h1 className="mt-4 max-w-2xl bg-gradient-to-r from-white via-fuchsia-100 to-cyan-100 bg-clip-text font-serif text-4xl leading-tight text-transparent md:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
              {heroDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/60">
              <span className="rounded-full border border-fuchsia-300/18 bg-fuchsia-300/10 px-4 py-2">
                低干擾
              </span>
              <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2">
                無縫播放
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                長時專注
              </span>
              {isAdmin ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2">
                  Theme Operations Manual
                </span>
              ) : null}
            </div>
            {!isAdmin ? (
              <div className="mt-8 rounded-[30px] border border-white/10 bg-white/6 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">主題路線</p>
                    <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">從不同路線進入，不只一種聆聽方式</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-white/62">
                    {currentTrack ? (
                      <span className="rounded-full border border-fuchsia-300/18 bg-fuchsia-300/10 px-3 py-1.5">
                        目前播放：{currentTrack.title}
                      </span>
                    ) : null}
                    {autoDjPlan ? (
                      <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5">
                        已排好下一首
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                      {selectedAssets.length} 首待播
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {publicThemeEntries.map(({ program, programTracks, primaryCollection }) => {
                    const hasPublishedTracks = programTracks.length > 0;
                    const totalMinutes = Math.max(
                      1,
                      Math.round(programTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60),
                    );

                    return (
                      <article
                        key={program.id}
                        className="rounded-[26px] border border-white/10 bg-black/18 p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/8"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-white/62">
                          <span className="rounded-full border border-fuchsia-300/18 bg-fuchsia-300/10 px-3 py-1.5">
                    {program.label}
                          </span>
                          <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5">
                            {program.bpmDisplay}
                          </span>
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                            {hasPublishedTracks ? `約 ${totalMinutes} 分鐘` : "即將推出"}
                          </span>
                        </div>
                        <h3 className="mt-4 font-serif text-2xl text-white">{program.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-white/68">{program.summary}</p>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleStartThemeSession(program.id)}
                            disabled={!hasPublishedTracks}
                            className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/18 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {hasPublishedTracks ? "立即開始" : "即將推出"}
                          </button>
                          {primaryCollection ? (
                            <Link
                              href={`/collections/${primaryCollection.id}`}
                              className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/76 transition hover:bg-white/12 hover:text-white"
                            >
                              查看系列
                            </Link>
                          ) : hasPublishedTracks ? (
                            <button
                              type="button"
                              onClick={() => handleBrowseTheme(program.id)}
                              className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/76 transition hover:bg-white/12 hover:text-white"
                            >
                              瀏覽曲目
                            </button>
                          ) : (
                            <a
                              href="#theme-routes-detail"
                              className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/76 transition hover:bg-white/12 hover:text-white"
                            >
                              查看主題說明
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {!isAdmin ? (
          <section className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">已上架路線</p>
                <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">已上架系列入口</h2>
                <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">
                  這裡放的是目前已經整理完成、可直接瀏覽與播放的系列，不再只集中在少數主題。
                </p>
              </div>
              {latestBatch ? (
                <div className="rounded-[24px] border border-amber-300/16 bg-amber-300/8 p-4 text-sm text-white/72">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-100/70">最新上架</p>
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
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/52">全部瀏覽</p>
                <h3 className="mt-3 font-serif text-2xl text-white">全部曲目</h3>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  回到完整曲目庫，直接瀏覽目前已上架的所有內容。
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    {tracks.length} 首曲目
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    {availableBpmOptions.join(" / ")} BPM
                  </span>
                </div>
              </button>
              {publishedCollections.map((collection) => {
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
                        只看這個系列
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
            bpmOptions={availableBpmOptions}
            activeBpms={activeBpms}
            visibleCount={filteredAssets.length}
            selectedCount={selectedAssets.length}
            featuredCollectionCount={publishedCollections.length}
            featuredTrackCount={featuredTrackCount}
            activeCollectionLabel={activeCollection?.title ?? "全部曲目"}
            latestBatchLabel={latestBatch?.label ?? "尚無批次"}
            onToggleBpm={toggleBpm}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
        </div>

        <div id="theme-routes-detail" className="mt-6">
          {isAdmin ? (
            <ThemeProgramPanel mode={mode} programs={themePrograms} />
          ) : (
            <ThemeProgramShowcase programs={themePrograms} tracks={tracks} batches={trackBatches} />
          )}
        </div>

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
              目前沒有符合條件的曲目，請放寬節奏篩選或回到全部曲目。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
