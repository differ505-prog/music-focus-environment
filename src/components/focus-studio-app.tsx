'use client';

import { useMemo, useState } from "react";

import {
  bpmOptions,
  generatedSceneImageUrl,
  mixEvents,
  mixSessions,
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
  const [isDownloading, setIsDownloading] = useState(false);
  const { selectedIds, setSelectedIds, selectedAssets, currentTrack, playback, toggleAsset, playTrack } = usePlayback();

  const trackMap = useMemo(() => {
    return new Map(tracks.map((track) => [track.id, track]));
  }, []);

  const filteredAssets = useMemo(() => {
    if (activeBpms.length === 0) {
      return tracks;
    }

    return tracks.filter((asset) => activeBpms.includes(asset.bpm));
  }, [activeBpms]);

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

  const isAdmin = mode === "admin";
  const heroTitle = isAdmin ? "音樂創作後台工作台" : "音樂創作與專注力環境";
  const heroDescription = isAdmin
    ? "集中管理主題作戰手冊、轉場參數、生成資料與 mix 數據，現在每條內容線都內建自己的策略藍圖、SOP、Prompt 模組與驗收清單。"
    : "以 CEO Deep Focus 與 BPM180 慢跑兩條內容線為核心，整合沉浸式氛圍、播放清單、精準 crossfade 與批次下載，讓不同使用情境都能擁有完整主題體驗。";

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
          </div>
        </section>

        <div className="mt-6">
          <FilterBar
            bpmOptions={bpmOptions}
            activeBpms={activeBpms}
            visibleCount={filteredAssets.length}
            selectedCount={selectedAssets.length}
            isDownloading={isDownloading}
            onToggleBpm={toggleBpm}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onDownload={handleDownload}
          />
        </div>

        <div className="mt-6">
          <ThemeProgramPanel mode={mode} programs={themePrograms} />
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
          {filteredAssets.map((asset) => (
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
          ))}
        </section>
      </div>
    </main>
  );
}
