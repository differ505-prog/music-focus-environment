import { Howl } from "howler";

import type { MusicAsset, PlaybackSnapshot } from "@/types/music";

const CROSSFADE_WINDOW_SECONDS = 4.36;
const CROSSFADE_DURATION_MS = CROSSFADE_WINDOW_SECONDS * 1000;
const PLAYBACK_POLL_MS = 200;

type PlaylistControllerOptions = {
  onStateChange?: (snapshot: PlaybackSnapshot) => void;
};

export class HowlerPlaylistController {
  private playlist: MusicAsset[] = [];
  private currentIndex = -1;
  private currentHowl: Howl | null = null;
  private nextHowl: Howl | null = null;
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

      this.emitState();
      return;
    }

    this.currentIndex = nextCurrentIndex;

    if (this.nextHowl) {
      const nextTrackId = nextPlaylist[nextCurrentIndex + 1]?.id;
      if (!nextTrackId) {
        this.cleanupNextHowl();
      }
    }

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
      this.currentHowl.volume(1);
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

    const howl = this.createHowl(track, 1);
    this.currentHowl = howl;
    howl.play();
    this.emitState();
  }

  private createHowl(track: MusicAsset, volume: number) {
    const howl = new Howl({
      src: [track.audioUrl],
      html5: false,
      preload: true,
      volume,
    });

    howl.on("load", () => {
      if (howl === this.currentHowl && howl.playing()) {
        this.scheduleCrossfadeMonitor();
      }
      this.emitState();
    });

    howl.on("play", () => {
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
    this.emitState();
  }

  private scheduleCrossfadeMonitor() {
    this.clearCrossfadeMonitor();

    if (!this.currentHowl || !this.currentHowl.playing()) {
      return;
    }

    this.crossfadeMonitor = setInterval(() => {
      const currentHowl = this.currentHowl;
      if (!currentHowl) {
        return;
      }

      if (!currentHowl.playing()) {
        this.emitState();
        return;
      }

      const duration = currentHowl.duration();
      const seek = Number(currentHowl.seek() || 0);

      this.emitState();

      if (
        !this.isCrossfading &&
        this.playlist[this.currentIndex + 1] &&
        duration > CROSSFADE_WINDOW_SECONDS &&
        duration - seek <= CROSSFADE_WINDOW_SECONDS
      ) {
        this.startCrossfade();
      }
    }, PLAYBACK_POLL_MS);
  }

  private startCrossfade() {
    const currentHowl = this.currentHowl;
    const nextTrack = this.playlist[this.currentIndex + 1];

    if (!currentHowl || !nextTrack || this.nextHowl) {
      return;
    }

    this.isCrossfading = true;
    this.clearCrossfadeMonitor();

    const nextHowl = this.createHowl(nextTrack, 0);
    this.nextHowl = nextHowl;

    nextHowl.play();
    nextHowl.fade(0, 1, CROSSFADE_DURATION_MS);
    currentHowl.fade(currentHowl.volume(), 0, CROSSFADE_DURATION_MS);

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

      this.scheduleCrossfadeMonitor();
      this.emitState();
    }, CROSSFADE_DURATION_MS + 50);

    this.emitState();
  }

  private stopAndUnloadAll() {
    this.clearCrossfadeMonitor();
    this.clearCrossfadeFinalizeTimer();
    this.isCrossfading = false;
    this.cleanupCurrentHowl();
    this.cleanupNextHowl();
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
      crossfadeWindowSeconds: CROSSFADE_WINDOW_SECONDS,
    });
  }
}
