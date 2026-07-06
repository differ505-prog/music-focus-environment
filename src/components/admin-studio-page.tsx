'use client';

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminPlaybackWorkbench } from "@/components/admin-playback-workbench";
import { AppSceneShell } from "@/components/app-scene-shell";
import { Breadcrumb } from "@/components/breadcrumb";
import { BpmAnalysisPanel } from "@/components/bpm-analysis-panel";
import { FilterBar } from "@/components/filter-bar";
import { MediaCard } from "@/components/media-card";
import { MixInsightsPanel } from "@/components/mix-insights-panel";
import { TrackBpmReviewPanel } from "@/components/track-bpm-review-panel";
import { TrackTransitionReviewPanel } from "@/components/track-transition-review-panel";
import { usePlayback } from "@/components/playback-provider";
import { ThemeProgramPanel } from "@/components/theme-program-panel";
import { mixEvents, mixSessions, themePrograms, trackCollections } from "@/data/music-assets";
import { useRuntimeTracks } from "@/hooks/use-runtime-tracks";
import { buildBpmCompatibilityMap, buildMixInsights } from "@/lib/studio-view-model";

export function AdminStudioPage() {
  const tracks = useRuntimeTracks();
  const [activeBpms, setActiveBpms] = useState<number[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>("all");
  const { selectedIds, setSelectedIds, selectedAssets, currentTrack, playback, toggleAsset, playTrack } = usePlayback();

  const activeCollection = useMemo(
    () => (activeCollectionId === "all" ? null : trackCollections.find((collection) => collection.id === activeCollectionId) ?? null),
    [activeCollectionId],
  );
  const filteredAssets = useMemo(
    () =>
      tracks.filter((asset) => {
        const matchesBpm = activeBpms.length === 0 || activeBpms.includes(asset.bpm);
        const matchesCollection = !activeCollection || activeCollection.trackIds.includes(asset.id);
        return matchesBpm && matchesCollection;
      }),
    [activeBpms, activeCollection, tracks],
  );
  const availableBpmOptions = useMemo(
    () => Array.from(new Set(tracks.map((track) => track.bpm))).sort((left, right) => left - right),
    [tracks],
  );
  const bpmCompatibilityMap = useMemo(() => buildBpmCompatibilityMap(tracks, currentTrack), [currentTrack, tracks]);
  const mixInsights = useMemo(() => buildMixInsights(tracks, mixSessions, mixEvents), [tracks]);

  return (
    <AppSceneShell
      eyebrow="管理工作台"
      title="OmniSonic 後台工作台"
      description="把系列、上架素材、主題手冊與播放資料拆成清楚的工作區。"
      bottomPaddingClassName="pb-[18rem] md:pb-[22rem]"
      badges={["主題手冊", "上架素材", "流程管理"]}
    >
      <section className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-5 shadow-[0_32px_90px_rgba(3,7,18,0.42)] backdrop-blur-2xl md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">已上架路線</p>
            <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">已上架系列</h2>
            <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">先縮小工作範圍，再進到細部管理。</p>
          </div>
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
            <p className="mt-3 text-sm leading-6 text-white/68">回到完整曲目庫，直接挑現在想處理的內容。</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/62">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{tracks.length} 首曲目</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                {availableBpmOptions.join(" / ")} BPM
              </span>
            </div>
          </button>
          {trackCollections.map((collection) => {
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
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{collection.heroMetric}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    BPM {collection.bpmFocus.join(" / ")}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveCollectionId((current) => (current === collection.id ? "all" : collection.id))}
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

      <div className="mt-6">
        <FilterBar
          bpmOptions={availableBpmOptions}
          activeBpms={activeBpms}
          visibleCount={filteredAssets.length}
          selectedCount={selectedAssets.length}
          activeCollectionLabel={activeCollection?.title ?? "全部曲目"}
          filteredAssets={filteredAssets}
          onToggleBpm={(bpm) =>
            setActiveBpms((current) => (current.includes(bpm) ? current.filter((item) => item !== bpm) : [...current, bpm]))
          }
          onSelectAll={() =>
            setSelectedIds((current) => {
              const merged = new Set([...current, ...filteredAssets.map((asset) => asset.id)]);
              return Array.from(merged);
            })
          }
          onClearSelection={() => setSelectedIds([])}
        />
      </div>

      <div className="mt-4">
        <Breadcrumb
          items={[
            { label: "前台首頁", href: "/" },
            { label: "管理工作台" },
          ]}
        />
      </div>

      <div id="theme-routes-detail" className="mt-6">
        <ThemeProgramPanel programs={themePrograms} />
      </div>

      <div className="mt-6">
        <AdminPlaybackWorkbench programs={themePrograms} />
      </div>

      <div className="mt-6">
        <TrackBpmReviewPanel tracks={tracks} />
      </div>

      <div className="mt-6">
        <TrackTransitionReviewPanel tracks={tracks} />
      </div>

      <div className="mt-6">
        <BpmAnalysisPanel />
      </div>

      <div className="mt-6">
        <MixInsightsPanel {...mixInsights} />
      </div>

      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredAssets.length > 0 ? (
          filteredAssets.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              mode="admin"
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

    </AppSceneShell>
  );
}
