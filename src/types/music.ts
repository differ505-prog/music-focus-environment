export type MusicTransitionProfile = {
  introCueSeconds: number;
  outroMixWindowSeconds: number;
  crossfadeSeconds: number;
  targetGain: number;
  tempoLockBars: number;
  beatDurationSeconds: number;
};

export type MusicAsset = {
  id: string;
  title: string;
  bpm: 110;
  audioUrl: string;
  imageUrl: string;
  musicPrompt: string;
  imagePrompt: string;
  transition: MusicTransitionProfile;
};

export type PlaybackSnapshot = {
  currentTrackId: string | null;
  nextTrackId: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isCrossfading: boolean;
  crossfadeWindowSeconds: number;
};
