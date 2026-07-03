'use client';

import { useCallback, useEffect, useRef, useState } from "react";

type UseArtworkProjectionOptions = {
  enabled: boolean;
};

export function useArtworkProjection({ enabled }: UseArtworkProjectionOptions) {
  const [isArtworkOpen, setIsArtworkOpen] = useState(false);
  const [isProjectionMode, setIsProjectionMode] = useState(false);
  const [isArtworkFullscreen, setIsArtworkFullscreen] = useState(false);
  const [isProjectionHudVisible, setIsProjectionHudVisible] = useState(true);
  const [isProjectionCursorHidden, setIsProjectionCursorHidden] = useState(false);

  const artworkContainerRef = useRef<HTMLDivElement | null>(null);
  const hudHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearProjectionTimers = useCallback(() => {
    if (hudHideTimerRef.current) {
      clearTimeout(hudHideTimerRef.current);
      hudHideTimerRef.current = null;
    }

    if (cursorHideTimerRef.current) {
      clearTimeout(cursorHideTimerRef.current);
      cursorHideTimerRef.current = null;
    }
  }, []);

  const revealProjectionHud = useCallback(() => {
    if (isArtworkFullscreen) {
      setIsProjectionHudVisible(false);
      return;
    }

    setIsProjectionHudVisible(true);
    setIsProjectionCursorHidden(false);
    clearProjectionTimers();

    hudHideTimerRef.current = setTimeout(() => {
      setIsProjectionHudVisible(false);
    }, isProjectionMode ? 1600 : 2200);

    if (isProjectionMode) {
      cursorHideTimerRef.current = setTimeout(() => {
        setIsProjectionCursorHidden(true);
      }, 1400);
    }
  }, [clearProjectionTimers, isArtworkFullscreen, isProjectionMode]);

  const closeArtwork = useCallback(async () => {
    if (typeof document !== "undefined" && document.fullscreenElement === artworkContainerRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // Browsers can reject fullscreen exit when the document is inactive.
      }
    }

    clearProjectionTimers();
    setIsArtworkOpen(false);
    setIsProjectionMode(false);
    setIsProjectionCursorHidden(false);
    setIsArtworkFullscreen(false);
    setIsProjectionHudVisible(true);
  }, [clearProjectionTimers]);

  const openArtwork = useCallback(
    (projectionMode = false) => {
      if (!enabled) {
        return;
      }

      clearProjectionTimers();
      setIsProjectionMode(projectionMode);
      setIsArtworkOpen(true);
      setIsProjectionHudVisible(true);
      setIsProjectionCursorHidden(false);
      setIsArtworkFullscreen(false);
    },
    [clearProjectionTimers, enabled],
  );

  const toggleArtworkFullscreen = useCallback(async () => {
    if (!artworkContainerRef.current || typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement === artworkContainerRef.current) {
      await document.exitFullscreen();
      return;
    }

    await artworkContainerRef.current.requestFullscreen();
  }, []);

  useEffect(() => {
    if (enabled) {
      return;
    }

    void closeArtwork();
  }, [closeArtwork, enabled]);

  useEffect(() => {
    return () => {
      clearProjectionTimers();
    };
  }, [clearProjectionTimers]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === artworkContainerRef.current;
      setIsArtworkFullscreen(isFullscreen);

      if (isFullscreen) {
        setIsProjectionHudVisible(false);
        setIsProjectionCursorHidden(isProjectionMode);
      } else if (isArtworkOpen) {
        setIsProjectionCursorHidden(false);
        revealProjectionHud();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement !== artworkContainerRef.current) {
        void closeArtwork();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeArtwork, isArtworkOpen, isProjectionMode, revealProjectionHud]);

  useEffect(() => {
    if (!isArtworkOpen) {
      clearProjectionTimers();
      setIsProjectionHudVisible(true);
      setIsProjectionCursorHidden(false);
      return;
    }

    revealProjectionHud();
  }, [clearProjectionTimers, isArtworkOpen, isArtworkFullscreen, isProjectionMode, revealProjectionHud]);

  return {
    artworkContainerRef,
    isArtworkOpen,
    isProjectionMode,
    isArtworkFullscreen,
    isProjectionHudVisible,
    isProjectionCursorHidden,
    isPureProjection: isProjectionMode && isArtworkFullscreen,
    openArtwork,
    closeArtwork,
    revealProjectionHud,
    toggleArtworkFullscreen,
  };
}
