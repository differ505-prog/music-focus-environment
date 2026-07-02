import type { MusicAsset } from "@/types/music";

export const defaultMusicPrompt =
  "Instrumental deep chillwave, melodic techno, dark atmospheric electronic, steady driving bassline, focused deep work rhythm for CEO mindset, tempo 110 BPM, constant tempo, subtle background fireplace crackling sounds, ambient, no vocals, cinematic, sophisticated.";

export const defaultImagePrompt =
  "Cinematic interior shot of a luxurious modern mansion in the mountains. Massive floor-to-ceiling windows revealing a dark, dense, and misty pine forest outside. A warm, roaring fireplace is burning in the living room. Sleek, sophisticated CEO workspace with a dark wood desk, moody ambient lighting, photorealistic, 8k resolution, architectural photography, cozy yet powerful and focused atmosphere.";

export const generatedSceneImageUrl = `https://core-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(defaultImagePrompt)}&image_size=landscape_16_9`;

const tempoLockedCrossfadeSeconds = 4.36;

const transitionProfiles: MusicAsset["transition"][] = [
  {
    introCueSeconds: 0.12,
    outroMixWindowSeconds: 4.36,
    crossfadeSeconds: 4.36,
    targetGain: 0.94,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  },
  {
    introCueSeconds: 0.28,
    outroMixWindowSeconds: 4.14,
    crossfadeSeconds: 4.14,
    targetGain: 0.96,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  },
  {
    introCueSeconds: 0.08,
    outroMixWindowSeconds: 4.36,
    crossfadeSeconds: 4.36,
    targetGain: 0.92,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  },
  {
    introCueSeconds: 0.2,
    outroMixWindowSeconds: 4.5,
    crossfadeSeconds: 4.2,
    targetGain: 0.95,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  },
  {
    introCueSeconds: 0.16,
    outroMixWindowSeconds: tempoLockedCrossfadeSeconds,
    crossfadeSeconds: tempoLockedCrossfadeSeconds,
    targetGain: 0.93,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
  },
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
