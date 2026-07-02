import { Howl } from "howler";

import type { MusicAsset, PlaybackSnapshot } from "@/types/music";

const PLAYBACK_POLL_MS = 200;

type PlaylistControllerOptions = {
  onStateChange?: (snapshot: PlaybackSnapshot) => void;
};

export class HowlerPlaylistController {
  private playlist: MusicAsset[] = [];
  private currentIndex = -1;
  private currentHowl: Howl | null = null;
  private nextHowl: Howl | null = null;
  private preparedNextHowl: Howl | null = null;
  private preparedNextTrackId: string | null = null;
  private crossfadeMonitor: ReturnType<typeof setInterval> | null = null;
  private crossfadeFinalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange?: (snapshot: PlaybackSnapshot) => void;
  private isCrossfading = false;

  constructor(options: PlaylistControllerOptions = {}) {
    this.onStateChange = options.onStateChange;
  }

  setPlaylist(nextPlaylist: MusicAsset[]) {
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

    const nextIndex = this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
    if (nextIndex >= this.playlist.length) {
      return;
    }

    this.startTrack(nextIndex);
  }

  previous() {
    if (this.playlist.length === 0) {
      return;
    }

    const previousIndex = this.currentIndex > 0 ? this.currentIndex - 1 : 0;
    this.startTrack(previousIndex);
  }

  seekTo(seconds: number) {
    if (!this.currentHowl) {
      return;
    }

    const duration = this.currentHowl.duration();
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const boundedSeconds = Math.min(Math.max(seconds, 0), duration);
    this.currentHowl.seek(boundedSeconds);

    if (this.nextHowl) {
      this.cleanupNextHowl();
      this.isCrossfading = false;
      this.clearCrossfadeFinalizeTimer();
      this.currentHowl.volume(this.getTargetGain(this.getCurrentTrack()));
    }

    if (this.currentHowl.playing()) {
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

  private createHowl(track: MusicAsset, volumeFactor: number, startAtSeconds = 0) {
    const howl = new Howl({
      src: [track.audioUrl],
      html5: false,
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

    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.playlist.length) {
      this.startTrack(nextIndex);
      return;
    }

    this.cleanupCurrentHowl();
    this.cleanupPreparedNextHowl();
    this.emitState();
  }

  private scheduleCrossfadeMonitor() {
    this.clearCrossfadeMonitor();

    if (!this.currentHowl || !this.currentHowl.playing()) {
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
      const mixWindow = currentTrack.transition.outroMixWindowSeconds;

      this.emitState();

      if (
        !this.isCrossfading &&
        this.playlist[this.currentIndex + 1] &&
        duration > mixWindow &&
        duration - seek <= mixWindow
      ) {
        this.startCrossfade();
      }
    }, PLAYBACK_POLL_MS);
  }

  private startCrossfade() {
    const currentHowl = this.currentHowl;
    const currentTrack = this.getCurrentTrack();
    const nextTrack = this.playlist[this.currentIndex + 1];

    if (!currentHowl || !currentTrack || !nextTrack || this.nextHowl) {
      return;
    }

    this.isCrossfading = true;
    this.clearCrossfadeMonitor();

    const fadeDurationSeconds = Math.min(
      currentTrack.transition.outroMixWindowSeconds,
      nextTrack.transition.crossfadeSeconds,
    );
    const fadeDurationMs = fadeDurationSeconds * 1000;
    const nextHowl =
      this.preparedNextTrackId === nextTrack.id && this.preparedNextHowl
        ? this.preparedNextHowl
        : this.createHowl(nextTrack, 0, nextTrack.transition.introCueSeconds);

    this.nextHowl = nextHowl;
    this.preparedNextHowl = null;
    this.preparedNextTrackId = null;

    nextHowl.play();
    nextHowl.fade(0, this.getTargetGain(nextTrack), fadeDurationMs);
    currentHowl.fade(currentHowl.volume(), 0, fadeDurationMs);

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
      this.currentIndex += 1;
      this.isCrossfading = false;

      this.primeUpcomingTrack();
      this.scheduleCrossfadeMonitor();
      this.emitState();
    }, fadeDurationMs + 50);

    this.emitState();
  }

  private stopAndUnloadAll() {
    this.clearCrossfadeMonitor();
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
    return this.playlist[this.currentIndex + 1] ?? null;
  }

  private isPlaying() {
    return Boolean(this.currentHowl?.playing() || this.nextHowl?.playing());
  }

  private getTargetGain(track: MusicAsset | null) {
    return track?.transition.targetGain ?? 1;
  }

  private primeUpcomingTrack() {
    const nextTrack = this.getNextTrack();

    if (!nextTrack) {
      this.cleanupPreparedNextHowl();
      return;
    }

    if (this.preparedNextTrackId === nextTrack.id && this.preparedNextHowl) {
      return;
    }

    this.cleanupPreparedNextHowl();
    this.preparedNextTrackId = nextTrack.id;
    this.preparedNextHowl = this.createHowl(nextTrack, 0, nextTrack.transition.introCueSeconds);
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

    this.onStateChange({
      currentTrackId: currentTrack?.id ?? null,
      nextTrackId: nextTrack?.id ?? null,
      currentTime: currentHowl ? Number(currentHowl.seek() || 0) : 0,
      duration: currentHowl?.duration() ?? 0,
      isPlaying: this.isPlaying(),
      isCrossfading: this.isCrossfading,
      crossfadeWindowSeconds: currentTrack?.transition.crossfadeSeconds ?? 4.36,
    });
  }
}
