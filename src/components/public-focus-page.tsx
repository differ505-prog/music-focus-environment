'use client';

import { useEffect, useMemo, useState } from "react";

import { AppSceneShell } from "@/components/app-scene-shell";
import { PublicFocusBrowser } from "@/components/public-focus-browser";
import { usePlayback } from "@/components/playback-provider";
import { themePrograms, tracks } from "@/data/music-assets";
import { buildBpmCompatibilityMap, buildPublicRouteEntries } from "@/lib/studio-view-model";

export function PublicFocusPage() {
  const [activeRouteId, setActiveRouteId] = useState<string>(themePrograms[0]?.id ?? "");
  const [activeRouteBpm, setActiveRouteBpm] = useState<number | null>(null);
  const { selectedIds, setSelectedIds, currentTrack, playback, toggleAsset, playTrack, startRandomSession } = usePlayback();

  const routeEntries = useMemo(() => buildPublicRouteEntries(themePrograms, tracks), []);
  const bpmCompatibilityMap = useMemo(() => buildBpmCompatibilityMap(tracks, currentTrack), [currentTrack]);
  const activeRouteEntry = useMemo(
    () => routeEntries.find((entry) => entry.program.id === activeRouteId) ?? routeEntries[0] ?? null,
    [activeRouteId, routeEntries],
  );
  const activeSubroute = useMemo(
    () => activeRouteEntry?.subroutes.find((subroute) => subroute.bpm === activeRouteBpm) ?? activeRouteEntry?.subroutes[0] ?? null,
    [activeRouteBpm, activeRouteEntry],
  );

  useEffect(() => {
    if (routeEntries.length === 0) {
      return;
    }

    if (!routeEntries.some((entry) => entry.program.id === activeRouteId)) {
      setActiveRouteId(routeEntries[0]?.program.id ?? "");
    }
  }, [activeRouteId, routeEntries]);

  useEffect(() => {
    if (!activeRouteEntry) {
      setActiveRouteBpm(null);
      return;
    }

    if (activeRouteBpm && activeRouteEntry.subroutes.some((subroute) => subroute.bpm === activeRouteBpm)) {
      return;
    }

    setActiveRouteBpm(activeRouteEntry.subroutes[0]?.bpm ?? null);
  }, [activeRouteBpm, activeRouteEntry]);

  const visibleTracks = activeSubroute?.tracks ?? [];

  const handleSelectRoute = (routeId: string) => {
    setActiveRouteId(routeId);
  };

  const handleSelectBpm = (bpm: number) => {
    setActiveRouteBpm(bpm);
  };

  const handleQueueTracks = () => {
    if (visibleTracks.length === 0) {
      return;
    }

    setSelectedIds((current) => {
      const merged = new Set([...current, ...visibleTracks.map((track) => track.id)]);
      return Array.from(merged);
    });
  };

  const handleRandomPlay = () => {
    if (visibleTracks.length === 0) {
      return;
    }

    startRandomSession(visibleTracks.map((track) => track.id));
  };

  return (
    <AppSceneShell
      eyebrow="直接播放"
      title="OmniSonic"
      description="直接選你現在要的狀態。"
      bottomPaddingClassName="pb-32 md:pb-40"
    >
      <PublicFocusBrowser
        routeEntries={routeEntries}
        activeRouteId={activeRouteId}
        activeRouteBpm={activeRouteBpm}
        selectedIds={selectedIds}
        playbackCurrentTrackId={playback.currentTrackId}
        playbackNextTrackId={playback.nextTrackId}
        bpmCompatibilityMap={bpmCompatibilityMap}
        onSelectRoute={handleSelectRoute}
        onSelectBpm={handleSelectBpm}
        onRandomPlay={handleRandomPlay}
        onQueueTracks={handleQueueTracks}
        onClearSelection={() => setSelectedIds([])}
        onToggleTrack={toggleAsset}
        onPlayTrack={playTrack}
      />
    </AppSceneShell>
  );
}
