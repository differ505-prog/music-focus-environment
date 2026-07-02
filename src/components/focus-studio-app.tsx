'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Waves } from "lucide-react";

import {
  bpmOptions,
  generatedSceneImageUrl,
  mixEvents,
  mixSessions,
  promptWorkflowSteps,
  tracks,
} from "@/data/music-assets";
import { FilterBar } from "@/components/filter-bar";
import { GlobalPlayer } from "@/components/global-player";
import { MediaCard } from "@/components/media-card";
import { MixInsightsPanel } from "@/components/mix-insights-panel";
import { PromptWorkflowPanel } from "@/components/prompt-workflow-panel";
import { SelectionActionBar } from "@/components/selection-action-bar";
import { StudioNav } from "@/components/studio-nav";
import { HowlerPlaylistController } from "@/lib/howler-playlist";
import type { PlaybackSnapshot } from "@/types/music";

const initialPlaybackState: PlaybackSnapshot = {
  currentTrackId: null,
  nextTrackId: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isCrossfading: false,
  crossfadeWindowSeconds: 4.36,
};

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type FocusStudioAppProps = {
  mode?: "public" | "admin";
};

export function FocusStudioApp({ mode = "public" }: FocusStudioAppProps) {
  const controllerRef = useRef<HowlerPlaylistController | null>(null);
  const [activeBpms, setActiveBpms] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(true);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [playback, setPlayback] = useState<PlaybackSnapshot>(initialPlaybackState);

  const trackMap = useMemo(() => {
    return new Map(tracks.map((track) => [track.id, track]));
  }, []);

  const filteredAssets = useMemo(() => {
    if (activeBpms.length === 0) {
      return tracks;
    }

    return tracks.filter((asset) => activeBpms.includes(asset.bpm));
  }, [activeBpms]);

  const selectedAssets = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return tracks.filter((asset) => selectedSet.has(asset.id));
  }, [selectedIds]);

  const currentTrack = useMemo(() => {
    return tracks.find((asset) => asset.id === playback.currentTrackId) ?? null;
  }, [playback.currentTrackId]);

  const nextTrack = useMemo(() => {
    return tracks.find((asset) => asset.id === playback.nextTrackId) ?? null;
  }, [playback.nextTrackId]);

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

  useEffect(() => {
    controllerRef.current = new HowlerPlaylistController({
      onStateChange: setPlayback,
    });

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPlaylist(selectedAssets);
  }, [selectedAssets]);

  useEffect(() => {
    if (!pendingPlayId) {
      return;
    }

    if (!selectedAssets.some((asset) => asset.id === pendingPlayId)) {
      return;
    }

    controllerRef.current?.play(pendingPlayId);
    setPendingPlayId(null);
  }, [pendingPlayId, selectedAssets]);

  const toggleBpm = (bpm: number) => {
    setActiveBpms((current: number[]) => {
      return current.includes(bpm) ? current.filter((item) => item !== bpm) : [...current, bpm];
    });
  };

  const toggleAsset = (assetId: string) => {
    setSelectedIds((current: string[]) => {
      return current.includes(assetId) ? current.filter((item) => item !== assetId) : [...current, assetId];
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

  const handlePlayPause = () => {
    if (!controllerRef.current) {
      return;
    }

    if (playback.isPlaying) {
      controllerRef.current.pause();
      return;
    }

    controllerRef.current.play();
  };

  const handlePlayTrack = (assetId: string) => {
    setIsPlayerOpen(true);
    setIsPlayerMinimized(false);

    if (!selectedIds.includes(assetId)) {
      setSelectedIds((current: string[]) => {
        return [...current, assetId];
      });
      setPendingPlayId(assetId);
      return;
    }

    controllerRef.current?.play(assetId);
  };

  const isAdmin = mode === "admin";
  const heroTitle = isAdmin ? "音樂創作後台工作台" : "音樂創作與專注力環境";
  const heroDescription = isAdmin
    ? "集中管理提示詞流程、轉場參數、生成資料與 mix 數據，讓你可以一邊產歌、一邊調整接歌與網站資產。"
    : "以 110 BPM 深度節奏為核心，整合沉浸式氛圍、播放清單、4.36 秒 crossfade 與批次下載，讓每段深度工作都像高階主管的夜間決策室。";

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
                  Prompt Workflow
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
            onToggleBpm={toggleBpm}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
        </div>

        {isAdmin ? (
          <div className="mt-6">
            <MixInsightsPanel {...mixInsights} />
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-6">
            <PromptWorkflowPanel steps={promptWorkflowSteps.map((step) => ({ ...step }))} />
          </div>
        ) : null}

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              mode={mode}
              checked={selectedIds.includes(asset.id)}
              isCurrent={playback.currentTrackId === asset.id}
              isNext={playback.nextTrackId === asset.id}
              onToggle={toggleAsset}
              onPlayTrack={handlePlayTrack}
            />
          ))}
        </section>
      </div>

      <SelectionActionBar
        selectedCount={selectedAssets.length}
        isDownloading={isDownloading}
        onDownload={handleDownload}
      />

      {isPlayerOpen ? (
        <GlobalPlayer
          playlist={selectedAssets}
          currentTrack={currentTrack}
          nextTrack={nextTrack}
          playback={playback}
          isMinimized={isPlayerMinimized}
          onPlayPause={handlePlayPause}
          onPrevious={() => controllerRef.current?.previous()}
          onNext={() => controllerRef.current?.next()}
          onSeek={(seconds) => controllerRef.current?.seekTo(seconds)}
          onSeekBy={(deltaSeconds) => controllerRef.current?.seekBy(deltaSeconds)}
          onPlayTrack={handlePlayTrack}
          onToggleMinimize={() => setIsPlayerMinimized((current) => !current)}
          onClose={() => {
            setIsPlayerOpen(false);
            setIsPlayerMinimized(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsPlayerOpen(true);
            setIsPlayerMinimized(false);
          }}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/28 bg-[#0a0814]/88 px-4 py-3 text-sm font-medium text-fuchsia-50 shadow-[0_24px_60px_rgba(84,12,112,0.38)] backdrop-blur-2xl transition hover:bg-[#100d1d]"
        >
          <Waves className="h-4 w-4" />
          打開播放器
        </button>
      )}
    </main>
  );
}
