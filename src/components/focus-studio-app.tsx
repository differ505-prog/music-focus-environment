'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Waves } from "lucide-react";

import { bpmOptions, generatedSceneImageUrl, mixEvents, mixSessions, tracks } from "@/data/music-assets";
import { FilterBar } from "@/components/filter-bar";
import { GlobalPlayer } from "@/components/global-player";
import { MediaCard } from "@/components/media-card";
import { MixInsightsPanel } from "@/components/mix-insights-panel";
import { SelectionActionBar } from "@/components/selection-action-bar";
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

export function FocusStudioApp() {
  const controllerRef = useRef<HowlerPlaylistController | null>(null);
  const [activeBpms, setActiveBpms] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(true);
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

    if (!selectedIds.includes(assetId)) {
      setSelectedIds((current: string[]) => {
        return [...current, assetId];
      });
      setPendingPlayId(assetId);
      return;
    }

    controllerRef.current?.play(assetId);
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#02060b] text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(2,6,11,0.72), rgba(2,6,11,0.92)), url("${generatedSceneImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,164,191,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[31rem] pt-8 md:px-8 md:pb-[24rem] md:pt-12">
        <section className="rounded-[36px] border border-white/12 bg-black/22 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-3xl md:p-10">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.38em] text-cyan-100/58">
              CEO Mindset Environment
            </p>
            <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight text-white md:text-6xl">
              音樂創作與專注力環境
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
              以 110 BPM 深度節奏為核心，整合沉浸式氛圍、播放清單、4.36 秒 crossfade 與批次下載，
              讓每段深度工作都像高階主管的夜間決策室。
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/60">
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                Dark Mode
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                Glassmorphism
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                Howler.js Crossfade
              </span>
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

        <div className="mt-6">
          <MixInsightsPanel {...mixInsights} />
        </div>

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
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
          onPlayPause={handlePlayPause}
          onPrevious={() => controllerRef.current?.previous()}
          onNext={() => controllerRef.current?.next()}
          onSeek={(seconds) => controllerRef.current?.seekTo(seconds)}
          onSeekBy={(deltaSeconds) => controllerRef.current?.seekBy(deltaSeconds)}
          onPlayTrack={handlePlayTrack}
          onClose={() => setIsPlayerOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlayerOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-cyan-300/28 bg-[#07111d]/88 px-4 py-3 text-sm font-medium text-cyan-50 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition hover:bg-[#0b1827]"
        >
          <Waves className="h-4 w-4" />
          打開播放器
        </button>
      )}
    </main>
  );
}
