import { Howl } from "howler";

import type { PlaybackSnapshot, Track } from "@/types/music";

const PLAYBACK_POLL_MS = 200;
const EQUAL_POWER_TICK_MS = 40;

type PlaylistControllerOptions = {
  onStateChange?: (snapshot: PlaybackSnapshot) => void;
  preferBackgroundPlayback?: boolean;
};

type CrossfadePlan = {
  fadeDurationSeconds: number;
  outgoingStartSeconds: number;
  incomingStartSeconds: number;
  targetMixInSeconds: number;
  strategyLabel: string;
  bpmDelta: number;
};

function detectBackgroundPlaybackPreference() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent);
  const isIpadOs = /Mac/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return isIosDevice || isIpadOs;
}

export class HowlerPlaylistController {
  private playlist: Track[] = [];
  private currentIndex = -1;
  private currentHowl: Howl | null = null;
  private nextHowl: Howl | null = null;
  private preparedNextHowl: Howl | null = null;
  private preparedNextTrackId: string | null = null;
  private crossfadeMonitor: ReturnType<typeof setInterval> | null = null;
  private equalPowerCurveTimer: ReturnType<typeof setInterval> | null = null;
  private crossfadeFinalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange?: (snapshot: PlaybackSnapshot) => void;
  private isCrossfading = false;
  private prefersBackgroundPlayback: boolean;
  private playbackEngine: PlaybackSnapshot["engine"];
  private repeatEnabled = true;

  constructor(options: PlaylistControllerOptions = {}) {
    this.onStateChange = options.onStateChange;
    this.prefersBackgroundPlayback =
      options.preferBackgroundPlayback ?? detectBackgroundPlaybackPreference();
    this.playbackEngine = this.prefersBackgroundPlayback ? "background_safe_html5" : "precision_web_audio";
  }

  setPlaylist(nextPlaylist: Track[]) {
    const currentTrackId = this.getCurrentTrack()?.id ?? null;
    const isPlaying = this.isPlaying();

    this.playlist = nextPlaylist;

    if (nextPlaylist.length === 0) {
      this.stopAndUnloadAll();
      this.currentIndex = -1;
      this.emitState();
      return;
    }

    if (!currentTrackId) {
      this.currentIndex = this.currentIndex >= 0 ? Math.min(this.currentIndex, nextPlaylist.length - 1) : -1;
      this.primeUpcomingTrack();
      this.emitState();
      return;
    }

    const nextCurrentIndex = nextPlaylist.findIndex((track) => track.id === currentTrackId);

    if (nextCurrentIndex === -1) {
      this.stopAndUnloadAll();
      this.currentIndex = isPlaying ? 0 : -1;

      if (isPlaying) {
        this.startTrack(0);
        return;
      }

      this.primeUpcomingTrack();
      this.emitState();
      return;
    }

    this.currentIndex = nextCurrentIndex;
    this.resetPreparedNextHowlIfMismatch();
    this.primeUpcomingTrack();
    this.emitState();
  }

  play(trackId?: string) {
    if (this.playlist.length === 0) {
      return;
    }

    if (trackId) {
      const trackIndex = this.playlist.findIndex((track) => track.id === trackId);
      if (trackIndex !== -1) {
        this.startTrack(trackIndex);
        return;
      }
    }

    if (this.currentHowl) {
      if (!this.currentHowl.playing()) {
        this.currentHowl.play();
      }
      this.scheduleCrossfadeMonitor();
      this.emitState();
      return;
    }

    const indexToPlay = this.currentIndex >= 0 ? this.currentIndex : 0;
    this.startTrack(indexToPlay);
  }

  pause() {
    if (!this.currentHowl) {
      return;
    }

    if (this.nextHowl) {
      this.cleanupNextHowl();
      this.isCrossfading = false;
      this.clearEqualPowerCurveTimer();
      this.clearCrossfadeFinalizeTimer();
      this.currentHowl.volume(this.getTargetGain(this.getCurrentTrack()));
    }

    this.clearCrossfadeMonitor();
    this.currentHowl.pause();
    this.emitState();
  }

  next() {
    if (this.playlist.length === 0) {
      return;
    }

    const nextIndex = this.getNextTrackIndex();
    if (nextIndex === null) {
      return;
    }

    this.startTrack(nextIndex);
  }

  previous() {
    if (this.playlist.length === 0) {
      return;
    }

    const previousIndex = this.getPreviousTrackIndex();
    this.startTrack(previousIndex);
  }

  setRepeatEnabled(enabled: boolean) {
    this.repeatEnabled = enabled;
    this.resetPreparedNextHowlIfMismatch();
    this.primeUpcomingTrack();
    this.emitState();
  }

  seekTo(seconds: number) {
    if (!this.currentHowl) {
      return;
    }

    const wasPlaying = this.currentHowl.playing();
    const duration = this.currentHowl.duration();
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const boundedSeconds = Math.min(Math.max(seconds, 0), duration);
    this.currentHowl.seek(boundedSeconds);

    if (this.nextHowl) {
      this.cleanupNextHowl();
      this.isCrossfading = false;
      this.clearEqualPowerCurveTimer();
      this.clearCrossfadeFinalizeTimer();
      this.currentHowl.volume(this.getTargetGain(this.getCurrentTrack()));
    }

    if (wasPlaying) {
      this.clearCrossfadeMonitor();
      this.currentHowl.pause();
    }

    this.currentHowl.seek(boundedSeconds);

    if (wasPlaying) {
      this.currentHowl.play();
      this.scheduleCrossfadeMonitor();
    }

    this.emitState();
  }

  seekBy(deltaSeconds: number) {
    if (!this.currentHowl) {
      return;
    }

    const currentSeconds = Number(this.currentHowl.seek() || 0);
    this.seekTo(currentSeconds + deltaSeconds);
  }

  destroy() {
    this.stopAndUnloadAll();
    this.currentIndex = -1;
    this.emitState();
  }

  private startTrack(index: number) {
    const track = this.playlist[index];
    if (!track) {
      return;
    }

    this.stopAndUnloadAll();
    this.currentIndex = index;

    const howl = this.createHowl(track, 1, track.transition.introCueSeconds);
    this.currentHowl = howl;
    howl.play();
    this.primeUpcomingTrack();
    this.emitState();
  }

  private buildCrossfadePlan(
    currentTrack: Track,
    nextTrack: Track,
    currentDurationSeconds: number,
  ): CrossfadePlan {
    const safeCurrentDuration = Number.isFinite(currentDurationSeconds)
      ? currentDurationSeconds
      : currentTrack.durationSeconds;
    const bpmDelta = Math.abs(currentTrack.bpm - nextTrack.bpm);
    const sharedBeatDurationSeconds = Math.max(
      currentTrack.transition.beatDurationSeconds,
      nextTrack.transition.beatDurationSeconds,
    );
    const requestedFadeDurationSeconds = Math.min(
      currentTrack.transition.outroMixWindowSeconds,
      nextTrack.transition.crossfadeSeconds,
    );
    const adaptiveFadeCapSeconds =
      bpmDelta <= 2
        ? requestedFadeDurationSeconds
        : bpmDelta <= 4
          ? sharedBeatDurationSeconds * 4
          : sharedBeatDurationSeconds * 2;
    const fadeDurationPolicyLabel =
      bpmDelta <= 2
        ? "綠燈同車道"
        : bpmDelta <= 4
          ? "黃燈縮短 1 Bar"
          : "紅燈縮短 2 Beats";
    const fallbackOutgoingStartSeconds = Math.max(
      safeCurrentDuration - Math.min(requestedFadeDurationSeconds, adaptiveFadeCapSeconds),
      currentTrack.transition.introCueSeconds,
    );
    const configuredOutgoingStartSeconds = Number.isFinite(currentTrack.transition.mixOutPointSeconds)
      ? currentTrack.transition.mixOutPointSeconds
      : fallbackOutgoingStartSeconds;
    const outgoingStartSeconds = Math.min(
      Math.max(configuredOutgoingStartSeconds, currentTrack.transition.introCueSeconds),
      Math.max(safeCurrentDuration - 0.25, currentTrack.transition.introCueSeconds),
    );
    const availableOutgoingFadeSeconds = Math.max(safeCurrentDuration - outgoingStartSeconds, 0.25);
    const fadeDurationSeconds = Math.max(
      Math.min(requestedFadeDurationSeconds, adaptiveFadeCapSeconds, availableOutgoingFadeSeconds),
      0.25,
    );
    const configuredIncomingStartSeconds = nextTrack.transition.mixInPointSeconds - fadeDurationSeconds;
    const incomingStartSeconds = Math.max(
      nextTrack.transition.introCueSeconds,
      Number.isFinite(configuredIncomingStartSeconds) ? configuredIncomingStartSeconds : nextTrack.transition.introCueSeconds,
    );

    return {
      fadeDurationSeconds,
      outgoingStartSeconds,
      incomingStartSeconds,
      targetMixInSeconds: nextTrack.transition.mixInPointSeconds,
      strategyLabel: `${fadeDurationPolicyLabel} · Δ${bpmDelta} BPM`,
      bpmDelta,
    };
  }

  private createHowl(track: Track, volumeFactor: number, startAtSeconds = 0) {
    const howl = new Howl({
      src: [track.media.audioUrl],
      html5: this.prefersBackgroundPlayback,
      preload: true,
      volume: this.getTargetGain(track) * volumeFactor,
    });
    let startCueApplied = false;

    howl.on("load", () => {
      if (howl === this.currentHowl && howl.playing()) {
        this.scheduleCrossfadeMonitor();
      }
      this.emitState();
    });

    howl.on("play", () => {
      if (!startCueApplied && startAtSeconds > 0) {
        howl.seek(startAtSeconds);
        startCueApplied = true;
      }

      if (howl === this.currentHowl) {
        this.scheduleCrossfadeMonitor();
      }
      this.emitState();
    });

    howl.on("pause", () => {
      this.emitState();
    });

    howl.on("stop", () => {
      this.emitState();
    });

    howl.on("end", () => {
      if (howl === this.currentHowl && !this.isCrossfading) {
        this.handleTrackEnd();
      }
    });

    return howl;
  }

  private handleTrackEnd() {
    this.clearCrossfadeMonitor();
    this.clearCrossfadeFinalizeTimer();

    if (this.repeatEnabled && this.playlist.length === 1) {
      this.startTrack(0);
      return;
    }

    const nextIndex = this.getNextTrackIndex();
    if (nextIndex !== null) {
      this.startTrack(nextIndex);
      return;
    }

    this.cleanupCurrentHowl();
    this.cleanupPreparedNextHowl();
    this.emitState();
  }

  private scheduleCrossfadeMonitor() {
    this.clearCrossfadeMonitor();

    if (this.prefersBackgroundPlayback || !this.currentHowl || !this.currentHowl.playing()) {
      return;
    }

    this.crossfadeMonitor = setInterval(() => {
      const currentHowl = this.currentHowl;
      const currentTrack = this.getCurrentTrack();

      if (!currentHowl || !currentTrack) {
        return;
      }

      if (!currentHowl.playing()) {
        this.emitState();
        return;
      }

      const duration = currentHowl.duration();
      const seek = Number(currentHowl.seek() || 0);
      const nextTrack = this.getNextTrack();

      this.emitState();

      if (!nextTrack || !Number.isFinite(duration) || duration <= 0) {
        return;
      }

      const crossfadePlan = this.buildCrossfadePlan(currentTrack, nextTrack, duration);

      if (!this.isCrossfading && seek >= crossfadePlan.outgoingStartSeconds) {
        this.startCrossfade();
      }
    }, PLAYBACK_POLL_MS);
  }

  private startCrossfade() {
    if (this.prefersBackgroundPlayback) {
      return;
    }

    const currentHowl = this.currentHowl;
    const currentTrack = this.getCurrentTrack();
    const nextTrack = this.getNextTrack();

    if (!currentHowl || !currentTrack || !nextTrack || this.nextHowl) {
      return;
    }

    this.isCrossfading = true;
    this.clearCrossfadeMonitor();

    const crossfadePlan = this.buildCrossfadePlan(
      currentTrack,
      nextTrack,
      currentHowl.duration() || currentTrack.durationSeconds,
    );
    const fadeDurationSeconds = crossfadePlan.fadeDurationSeconds;
    const fadeDurationMs = fadeDurationSeconds * 1000;
    const nextHowl =
      this.preparedNextTrackId === nextTrack.id && this.preparedNextHowl
        ? this.preparedNextHowl
        : this.createHowl(nextTrack, 0, crossfadePlan.incomingStartSeconds);

    this.nextHowl = nextHowl;
    this.preparedNextHowl = null;
    this.preparedNextTrackId = null;

    nextHowl.play();
    nextHowl.volume(0);
    currentHowl.volume(this.getTargetGain(currentTrack));
    this.runEqualPowerCurve(currentHowl, nextHowl, currentTrack, nextTrack, fadeDurationMs);

    this.crossfadeFinalizeTimer = setTimeout(() => {
      const outgoingHowl = this.currentHowl;
      const incomingHowl = this.nextHowl;

      if (!outgoingHowl || !incomingHowl) {
        return;
      }

      outgoingHowl.stop();
      outgoingHowl.unload();

      this.currentHowl = incomingHowl;
      this.nextHowl = null;
      this.currentIndex = this.getNextTrackIndex() ?? this.currentIndex;
      this.isCrossfading = false;

      this.primeUpcomingTrack();
      this.scheduleCrossfadeMonitor();
      this.emitState();
    }, fadeDurationMs + 50);

    this.emitState();
  }

  private stopAndUnloadAll() {
    this.clearCrossfadeMonitor();
    this.clearEqualPowerCurveTimer();
    this.clearCrossfadeFinalizeTimer();
    this.isCrossfading = false;
    this.cleanupCurrentHowl();
    this.cleanupNextHowl();
    this.cleanupPreparedNextHowl();
  }

  private cleanupCurrentHowl() {
    if (!this.currentHowl) {
      return;
    }

    this.currentHowl.stop();
    this.currentHowl.unload();
    this.currentHowl = null;
  }

  private cleanupNextHowl() {
    if (!this.nextHowl) {
      return;
    }

    this.nextHowl.stop();
    this.nextHowl.unload();
    this.nextHowl = null;
  }

  private cleanupPreparedNextHowl() {
    if (!this.preparedNextHowl) {
      this.preparedNextTrackId = null;
      return;
    }

    this.preparedNextHowl.stop();
    this.preparedNextHowl.unload();
    this.preparedNextHowl = null;
    this.preparedNextTrackId = null;
  }

  private clearCrossfadeMonitor() {
    if (!this.crossfadeMonitor) {
      return;
    }

    clearInterval(this.crossfadeMonitor);
    this.crossfadeMonitor = null;
  }

  private clearEqualPowerCurveTimer() {
    if (!this.equalPowerCurveTimer) {
      return;
    }

    clearInterval(this.equalPowerCurveTimer);
    this.equalPowerCurveTimer = null;
  }

  private clearCrossfadeFinalizeTimer() {
    if (!this.crossfadeFinalizeTimer) {
      return;
    }

    clearTimeout(this.crossfadeFinalizeTimer);
    this.crossfadeFinalizeTimer = null;
  }

  private getCurrentTrack() {
    return this.playlist[this.currentIndex] ?? null;
  }

  private getNextTrack() {
    const nextIndex = this.getNextTrackIndex();
    return nextIndex === null ? null : this.playlist[nextIndex] ?? null;
  }

  private getNextTrackIndex() {
    if (this.playlist.length === 0) {
      return null;
    }

    const nextIndex = this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
    if (nextIndex < this.playlist.length) {
      return nextIndex;
    }

    if (this.repeatEnabled && this.playlist.length > 1) {
      return 0;
    }

    return null;
  }

  private getPreviousTrackIndex() {
    if (this.playlist.length === 0) {
      return 0;
    }

    if (this.currentIndex > 0) {
      return this.currentIndex - 1;
    }

    if (this.repeatEnabled && this.playlist.length > 1) {
      return this.playlist.length - 1;
    }

    return 0;
  }

  private isPlaying() {
    return Boolean(this.currentHowl?.playing() || this.nextHowl?.playing());
  }

  private getTargetGain(track: Track | null) {
    return track?.transition.targetGain ?? 1;
  }

  private runEqualPowerCurve(
    currentHowl: Howl,
    nextHowl: Howl,
    currentTrack: Track,
    nextTrack: Track,
    fadeDurationMs: number,
  ) {
    this.clearEqualPowerCurveTimer();

    const startedAt = Date.now();
    const currentTargetGain = this.getTargetGain(currentTrack);
    const nextTargetGain = this.getTargetGain(nextTrack);

    const updateCurve = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / fadeDurationMs, 1);
      const outgoingGain = Math.cos((progress * Math.PI) / 2) * currentTargetGain;
      const incomingGain = Math.sin((progress * Math.PI) / 2) * nextTargetGain;

      currentHowl.volume(outgoingGain);
      nextHowl.volume(incomingGain);

      if (progress >= 1) {
        this.clearEqualPowerCurveTimer();
      }
    };

    updateCurve();
    this.equalPowerCurveTimer = setInterval(updateCurve, EQUAL_POWER_TICK_MS);
  }

  private primeUpcomingTrack() {
    if (this.prefersBackgroundPlayback) {
      this.cleanupPreparedNextHowl();
      return;
    }

    const nextTrack = this.getNextTrack();

    if (!nextTrack) {
      this.cleanupPreparedNextHowl();
      return;
    }

    if (this.preparedNextTrackId === nextTrack.id && this.preparedNextHowl) {
      return;
    }

    const currentTrack = this.getCurrentTrack();
    const previewCrossfadePlan = currentTrack
      ? this.buildCrossfadePlan(currentTrack, nextTrack, currentTrack.durationSeconds)
      : null;

    this.cleanupPreparedNextHowl();
    this.preparedNextTrackId = nextTrack.id;
    this.preparedNextHowl = this.createHowl(
      nextTrack,
      0,
      previewCrossfadePlan?.incomingStartSeconds ?? nextTrack.transition.introCueSeconds,
    );
  }

  private resetPreparedNextHowlIfMismatch() {
    const nextTrackId = this.getNextTrack()?.id ?? null;

    if (this.preparedNextTrackId && this.preparedNextTrackId !== nextTrackId) {
      this.cleanupPreparedNextHowl();
    }
  }

  private emitState() {
    if (!this.onStateChange) {
      return;
    }

    const currentHowl = this.currentHowl;
    const currentTrack = this.getCurrentTrack();
    const nextTrack = this.isCrossfading ? this.playlist[this.currentIndex + 1] : this.getNextTrack();
    const crossfadeNextTrack = this.isCrossfading ? this.getNextTrack() : null;
    const activeNextTrack = crossfadeNextTrack ?? nextTrack;
    const activeCrossfadePlan =
      !this.prefersBackgroundPlayback && currentTrack && activeNextTrack
        ? this.buildCrossfadePlan(
            currentTrack,
            activeNextTrack,
            currentHowl?.duration() || currentTrack.durationSeconds,
          )
        : null;

    this.onStateChange({
      currentTrackId: currentTrack?.id ?? null,
      nextTrackId: activeNextTrack?.id ?? null,
      currentTime: currentHowl ? Number(currentHowl.seek() || 0) : 0,
      duration: currentHowl?.duration() ?? 0,
      isPlaying: this.isPlaying(),
      isCrossfading: this.isCrossfading,
      crossfadeWindowSeconds: activeCrossfadePlan?.fadeDurationSeconds ?? currentTrack?.transition.crossfadeSeconds ?? 4.36,
      crossfadeOutStartSeconds: activeCrossfadePlan?.outgoingStartSeconds ?? null,
      crossfadeInStartSeconds: activeCrossfadePlan?.incomingStartSeconds ?? null,
      crossfadeTargetMixInSeconds: activeCrossfadePlan?.targetMixInSeconds ?? null,
      transitionStrategyLabel: this.prefersBackgroundPlayback
        ? "背景模式停用重疊轉場"
        : activeCrossfadePlan?.strategyLabel ?? null,
      transitionBpmDelta: activeCrossfadePlan?.bpmDelta ?? null,
      engine: this.playbackEngine,
      prefersBackgroundPlayback: this.prefersBackgroundPlayback,
      repeatEnabled: this.repeatEnabled,
    });
  }
}
