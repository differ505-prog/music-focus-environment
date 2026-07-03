'use client';

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Waves } from "lucide-react";

import { generatedSceneImageUrl, tracks } from "@/data/music-assets";
import { GlobalPlayer } from "@/components/global-player";
import { buildAutoDjQueue, createAutoDjSessionPlan } from "@/lib/auto-dj";
import { HowlerPlaylistController } from "@/lib/howler-playlist";
import type { AutoDjSessionPlan, PlaybackSnapshot, Track } from "@/types/music";

const initialPlaybackState: PlaybackSnapshot = {
  currentTrackId: null,
  nextTrackId: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isCrossfading: false,
  crossfadeWindowSeconds: 4.36,
  engine: "precision_web_audio",
  prefersBackgroundPlayback: false,
  repeatEnabled: true,
};

type PlaybackContextValue = {
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  selectedAssets: Track[];
  currentTrack: Track | null;
  nextTrack: Track | null;
  autoDjPlan: AutoDjSessionPlan | null;
  playback: PlaybackSnapshot;
  toggleAsset: (assetId: string) => void;
  playTrack: (assetId: string) => void;
  startSession: (assetIds: string[], initialTrackId?: string) => void;
  startRandomSession: (assetIds: string[]) => void;
  playPause: () => void;
  toggleRepeat: () => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

function shuffleIds<T>(items: T[]) {
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mode = pathname.startsWith("/admin") ? "admin" : "public";
  const controllerRef = useRef<HowlerPlaylistController | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(true);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(true);
  const [playback, setPlayback] = useState<PlaybackSnapshot>(initialPlaybackState);

  const selectedAssets = useMemo(() => {
    return selectedIds
      .map((assetId) => tracks.find((asset) => asset.id === assetId) ?? null)
      .filter((asset): asset is Track => Boolean(asset));
  }, [selectedIds]);

  const currentTrack = useMemo(() => {
    return tracks.find((asset) => asset.id === playback.currentTrackId) ?? null;
  }, [playback.currentTrackId]);

  const nextTrack = useMemo(() => {
    return tracks.find((asset) => asset.id === playback.nextTrackId) ?? null;
  }, [playback.nextTrackId]);

  const autoDjPlan = useMemo(() => {
    return createAutoDjSessionPlan(selectedAssets, playback.currentTrackId, playback.nextTrackId);
  }, [playback.currentTrackId, playback.nextTrackId, selectedAssets]);

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
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    if (typeof MediaMetadata !== "undefined") {
      const artworkSrc = currentTrack?.media.coverImageUrl
        ? new URL(currentTrack.media.coverImageUrl, window.location.origin).toString()
        : generatedSceneImageUrl;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack?.title ?? "OmniSonic",
        artist: "OmniSonic",
        album: "OmniSonic",
        artwork: [{ src: artworkSrc, sizes: "512x512", type: "image/jpeg" }],
      });
    }

    navigator.mediaSession.playbackState = playback.isPlaying ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", () => controllerRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => controllerRef.current?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => controllerRef.current?.previous());
    navigator.mediaSession.setActionHandler("nexttrack", () => controllerRef.current?.next());
    navigator.mediaSession.setActionHandler("seekbackward", () => controllerRef.current?.seekBy(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => controllerRef.current?.seekBy(10));
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        controllerRef.current?.seekTo(details.seekTime);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [currentTrack, playback.isPlaying]);

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

  const toggleAsset = (assetId: string) => {
    setSelectedIds((current) => {
      return current.includes(assetId) ? current.filter((item) => item !== assetId) : [...current, assetId];
    });
  };

  const playTrack = (assetId: string) => {
    setIsPlayerOpen(true);
    setIsPlayerMinimized((current) => (isPlayerOpen ? current : true));

    if (!selectedIds.includes(assetId)) {
      setSelectedIds((current) => [...current, assetId]);
      setPendingPlayId(assetId);
      return;
    }

    controllerRef.current?.play(assetId);
  };

  const startSession = (assetIds: string[], initialTrackId?: string) => {
    const nextPlaylist = Array.from(new Set(assetIds))
      .map((assetId) => tracks.find((track) => track.id === assetId) ?? null)
      .filter((track): track is Track => Boolean(track));

    if (nextPlaylist.length === 0) {
      return;
    }

    const orderedIds = buildAutoDjQueue(nextPlaylist, initialTrackId);
    const targetInitialTrackId =
      initialTrackId && orderedIds.includes(initialTrackId) ? initialTrackId : orderedIds[0] ?? null;

    setIsPlayerOpen(true);
    setIsPlayerMinimized(true);
    setSelectedIds(orderedIds);
    setPendingPlayId(targetInitialTrackId);
  };

  const startRandomSession = (assetIds: string[]) => {
    const uniqueIds = Array.from(new Set(assetIds)).filter((assetId) => tracks.some((track) => track.id === assetId));

    if (uniqueIds.length === 0) {
      return;
    }

    const shuffledIds = shuffleIds(uniqueIds);

    setIsPlayerOpen(true);
    setIsPlayerMinimized(true);
    setSelectedIds(shuffledIds);
    setPendingPlayId(shuffledIds[0] ?? null);
  };

  const playPause = () => {
    if (!controllerRef.current) {
      return;
    }

    if (playback.isPlaying) {
      controllerRef.current.pause();
      return;
    }

    controllerRef.current.play();
  };

  const toggleRepeat = () => {
    controllerRef.current?.setRepeatEnabled(!playback.repeatEnabled);
  };

  const value = useMemo<PlaybackContextValue>(
    () => ({
      selectedIds,
      setSelectedIds,
      selectedAssets,
      currentTrack,
      nextTrack,
      autoDjPlan,
      playback,
      toggleAsset,
      playTrack,
      startSession,
      startRandomSession,
      playPause,
      toggleRepeat,
    }),
    [selectedIds, selectedAssets, currentTrack, nextTrack, autoDjPlan, playback],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {isPlayerOpen ? (
        <GlobalPlayer
          playlist={selectedAssets}
          currentTrack={currentTrack}
          nextTrack={nextTrack}
          sessionPlan={autoDjPlan}
          playback={playback}
          isMinimized={isPlayerMinimized}
          mode={mode}
          onPlayPause={playPause}
          onToggleRepeat={toggleRepeat}
          onPrevious={() => controllerRef.current?.previous()}
          onNext={() => controllerRef.current?.next()}
          onSeek={(seconds) => controllerRef.current?.seekTo(seconds)}
          onSeekBy={(deltaSeconds) => controllerRef.current?.seekBy(deltaSeconds)}
          onPlayTrack={playTrack}
          onToggleMinimize={() => setIsPlayerMinimized((current) => !current)}
          onClose={() => {
            setIsPlayerOpen(false);
            setIsPlayerMinimized(true);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsPlayerOpen(true);
            setIsPlayerMinimized(true);
          }}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/28 bg-[#0a0814]/88 px-4 py-3 text-sm font-medium text-fuchsia-50 shadow-[0_24px_60px_rgba(84,12,112,0.38)] backdrop-blur-2xl transition hover:bg-[#100d1d]"
        >
          <Waves className="h-4 w-4" />
          打開播放器
        </button>
      )}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const context = useContext(PlaybackContext);

  if (!context) {
    throw new Error("usePlayback 必須在 PlaybackProvider 內使用");
  }

  return context;
}
