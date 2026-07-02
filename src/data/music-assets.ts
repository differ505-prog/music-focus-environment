import type { MusicAsset } from "@/types/music";

export const defaultMusicPrompt =
  "Instrumental deep chillwave, melodic techno, dark atmospheric electronic, steady driving bassline, focused deep work rhythm for CEO mindset, tempo 110 BPM, constant tempo, subtle background fireplace crackling sounds, ambient, no vocals, cinematic, sophisticated.";

export const defaultImagePrompt =
  "Cinematic interior shot of a luxurious modern mansion in the mountains. Massive floor-to-ceiling windows revealing a dark, dense, and misty pine forest outside. A warm, roaring fireplace is burning in the living room. Sleek, sophisticated CEO workspace with a dark wood desk, moody ambient lighting, photorealistic, 8k resolution, architectural photography, cozy yet powerful and focused atmosphere.";

export const generatedSceneImageUrl = `https://core-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(defaultImagePrompt)}&image_size=landscape_16_9`;

const tempoLockedCrossfadeSeconds = 4.36;
const targetLufs = -14.5;

function dbToGain(db: number) {
  return Number(Math.pow(10, db / 20).toFixed(3));
}

function createTransitionProfile(profile: {
  introCueSeconds: number;
  outroMixWindowSeconds: number;
  crossfadeSeconds: number;
  sourceLufs: number;
  tempoLockBars: number;
  beatDurationSeconds: number;
}): MusicAsset["transition"] {
  const normalizationGainDb = Number((targetLufs - profile.sourceLufs).toFixed(2));

  return {
    ...profile,
    targetGain: dbToGain(normalizationGainDb),
    targetLufs,
    normalizationGainDb,
    fadeCurve: "equal_power",
  };
}

const transitionProfiles: MusicAsset["transition"][] = [
  createTransitionProfile({
    introCueSeconds: 0.12,
    outroMixWindowSeconds: 4.36,
    crossfadeSeconds: 4.36,
    sourceLufs: -13.95,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  }),
  createTransitionProfile({
    introCueSeconds: 0.28,
    outroMixWindowSeconds: 4.14,
    crossfadeSeconds: 4.14,
    sourceLufs: -14.08,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  }),
  createTransitionProfile({
    introCueSeconds: 0.08,
    outroMixWindowSeconds: 4.36,
    crossfadeSeconds: 4.36,
    sourceLufs: -13.78,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  }),
  createTransitionProfile({
    introCueSeconds: 0.2,
    outroMixWindowSeconds: 4.5,
    crossfadeSeconds: 4.2,
    sourceLufs: -14.02,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  }),
  createTransitionProfile({
    introCueSeconds: 0.16,
    outroMixWindowSeconds: tempoLockedCrossfadeSeconds,
    crossfadeSeconds: tempoLockedCrossfadeSeconds,
    sourceLufs: -13.7,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  }),
];

export const musicAssets: MusicAsset[] = [
  {
    id: "aurora-strategy",
    title: "Aurora Strategy Loop",
    bpm: 110,
    audioUrl: "/audio/demo.mp3",
    imageUrl: "/img/demo.jpg",
    musicPrompt: defaultMusicPrompt,
    imagePrompt: defaultImagePrompt,
    transition: transitionProfiles[0],
  },
  {
    id: "ember-focus",
    title: "Ember Focus Drive",
    bpm: 110,
    audioUrl: "/audio/demo.mp3",
    imageUrl: "/img/demo.jpg",
    musicPrompt: defaultMusicPrompt,
    imagePrompt: defaultImagePrompt,
    transition: transitionProfiles[1],
  },
  {
    id: "summit-rhythm",
    title: "Summit Rhythm Frame",
    bpm: 110,
    audioUrl: "/audio/demo.mp3",
    imageUrl: "/img/demo.jpg",
    musicPrompt: defaultMusicPrompt,
    imagePrompt: defaultImagePrompt,
    transition: transitionProfiles[2],
  },
  {
    id: "obsidian-session",
    title: "Obsidian Session Grid",
    bpm: 110,
    audioUrl: "/audio/demo.mp3",
    imageUrl: "/img/demo.jpg",
    musicPrompt: defaultMusicPrompt,
    imagePrompt: defaultImagePrompt,
    transition: transitionProfiles[3],
  },
  {
    id: "nocturne-executive",
    title: "Nocturne Executive Flow",
    bpm: 110,
    audioUrl: "/audio/demo.mp3",
    imageUrl: "/img/demo.jpg",
    musicPrompt: defaultMusicPrompt,
    imagePrompt: defaultImagePrompt,
    transition: transitionProfiles[4],
  },
];

export const bpmOptions = [90, 110, 120] as const;
