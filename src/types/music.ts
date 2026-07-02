export type FadeCurve = "equal_power";

export type TrackStatus = "draft" | "ready" | "published";

export type TrackMedia = {
  audioUrl: string;
  coverImageUrl: string;
  backgroundVideoUrl: string;
};

export type TrackCopy = {
  descriptionZh: string;
  descriptionEn: string;
  themeScenario: string;
};

export type TrackPrompts = {
  musicPrompt: string;
  imagePrompt: string;
  videoPrompt: string;
  generationPrompt: string;
};

export type TrackTransitionProfile = {
  introCueSeconds: number;
  outroMixWindowSeconds: number;
  crossfadeSeconds: number;
  targetGain: number;
  sourceLufs: number;
  targetLufs: number;
  normalizationGainDb: number;
  fadeCurve: FadeCurve;
  tempoLockBars: number;
  beatDurationSeconds: number;
  mixInPointSeconds: number;
  mixOutPointSeconds: number;
};

export type Track = {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  durationSeconds: number;
  musicalKey: string;
  energyLevel: number;
  moodTags: string[];
  status: TrackStatus;
  media: TrackMedia;
  copy: TrackCopy;
  prompts: TrackPrompts;
  transition: TrackTransitionProfile;
  createdAt: string;
};

export type ThemeWorkflowStep = {
  id: string;
  title: string;
  detail: string;
  deliverable: string;
};

export type ThemePromptModule = {
  id: string;
  title: string;
  purpose: string;
  template: string;
};

export type ThemeChecklistItem = {
  id: string;
  title: string;
  detail: string;
};

export type ThemeProgram = {
  id: string;
  label: string;
  title: string;
  bpmDisplay: string;
  summary: string;
  audience: string;
  positioning: string;
  operatingPrinciples: string[];
  layoutNotes: string[];
  workflow: ThemeWorkflowStep[];
  promptSeed: string;
  promptModules: ThemePromptModule[];
  acceptanceChecklist: ThemeChecklistItem[];
};

export type MixEventType =
  | "play"
  | "transition_complete"
  | "seek"
  | "skip"
  | "save_mix"
  | "share";

export type MixEvent = {
  id: string;
  sessionId: string;
  type: MixEventType;
  trackId: string;
  fromTrackId?: string;
  toTrackId?: string;
  value?: number;
  occurredAt: string;
};

export type MixSession = {
  id: string;
  listenerMode: "private_studio" | "public_mix";
  startedAt: string;
  endedAt: string;
  trackSequence: string[];
  savedMixTitle?: string;
  completionRate: number;
};

export type PlaybackEngine = "precision_web_audio" | "background_safe_html5";

export type PlaybackSnapshot = {
  currentTrackId: string | null;
  nextTrackId: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isCrossfading: boolean;
  crossfadeWindowSeconds: number;
  engine: PlaybackEngine;
  prefersBackgroundPlayback: boolean;
};
