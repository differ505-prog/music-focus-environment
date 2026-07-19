'use client';

import { useEffect, useState } from "react";
import { Waves } from "lucide-react";

import { PlaybackProvider, usePlayback } from "@/components/playback-provider";
import { useRuntimeTracks } from "@/hooks/use-runtime-tracks";

type PlayState = "idle" | "loading" | "playing" | "error";

export default function EmbedButtonPage() {
  return (
    <PlaybackProvider embedMode>
      <EmbedButton />
    </PlaybackProvider>
  );
}

function EmbedButton() {
  const tracks = useRuntimeTracks();
  const { startRandomSession, playback } = usePlayback();
  const [playState, setPlayState] = useState<PlayState>("idle");

  // Listen for commands from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type } = event.data ?? {};
      if (type === "OMNI_START_RANDOM") {
        handlePlay();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Notify parent when playback starts
  useEffect(() => {
    if (playback.isPlaying && playState === "loading") {
      setPlayState("playing");
      window.parent.postMessage({ type: "OMNI_PLAYING" }, "*");
    }
  }, [playback.isPlaying, playState]);

  function handlePlay() {
    if (tracks.length === 0) {
      setPlayState("error");
      window.parent.postMessage({ type: "OMNI_ERROR", message: "No tracks available" }, "*");
      return;
    }
    setPlayState("loading");
    startRandomSession(tracks.map((t) => t.id));
    // If already playing, OMNI_PLAYING will fire via the effect above
    // If tracks are already loaded, PlaybackProvider will start immediately
    if (playback.isPlaying) {
      setPlayState("playing");
      window.parent.postMessage({ type: "OMNI_PLAYING" }, "*");
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <button
        type="button"
        onClick={handlePlay}
        disabled={playState === "loading"}
        className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-100 shadow-[0_0_32px_rgba(192,38,211,0.35)] transition-all duration-200 hover:scale-105 hover:bg-fuchsia-400/22 hover:shadow-[0_0_48px_rgba(192,38,211,0.55)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="開始深度專注心流"
      >
        {playState === "loading" ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-fuchsia-400/40 border-t-fuchsia-300" />
        ) : (
          <Waves className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
