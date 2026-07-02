import type { MixEvent, MixSession, Track, TrackTransitionProfile } from "@/types/music";

export const defaultMusicPrompt =
  "Instrumental deep chillwave, melodic techno, dark atmospheric electronic, steady driving bassline, focused deep work rhythm for CEO mindset, tempo 110 BPM, constant tempo, subtle background fireplace crackling sounds, ambient, no vocals, cinematic, sophisticated.";

export const defaultImagePrompt =
  "Cinematic interior shot of a luxurious modern mansion in the mountains. Massive floor-to-ceiling windows revealing a dark, dense, and misty pine forest outside. A warm, roaring fireplace is burning in the living room. Sleek, sophisticated CEO workspace with a dark wood desk, moody ambient lighting, photorealistic, 8k resolution, architectural photography, cozy yet powerful and focused atmosphere.";

export const defaultVideoPrompt =
  "Slow cinematic dolly shot inside a luxurious mountain mansion at night. Floor-to-ceiling windows show a dark misty pine forest outside. Warm fireplace flicker fills a sophisticated CEO workspace with dark wood desk, subtle ambient lighting, photorealistic motion, premium architectural film look, calm and focused atmosphere.";

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
  mixInPointSeconds: number;
  mixOutPointSeconds: number;
}): TrackTransitionProfile {
  const normalizationGainDb = Number((targetLufs - profile.sourceLufs).toFixed(2));

  return {
    ...profile,
    targetGain: dbToGain(normalizationGainDb),
    targetLufs,
    normalizationGainDb,
    fadeCurve: "equal_power",
  };
}

const transitionProfiles: TrackTransitionProfile[] = [
  createTransitionProfile({
    introCueSeconds: 0.12,
    outroMixWindowSeconds: 4.36,
    crossfadeSeconds: 4.36,
    sourceLufs: -13.95,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
    mixInPointSeconds: 16,
    mixOutPointSeconds: 170,
  }),
  createTransitionProfile({
    introCueSeconds: 0.28,
    outroMixWindowSeconds: 4.14,
    crossfadeSeconds: 4.14,
    sourceLufs: -14.08,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
    mixInPointSeconds: 12,
    mixOutPointSeconds: 167,
  }),
  createTransitionProfile({
    introCueSeconds: 0.08,
    outroMixWindowSeconds: 4.36,
    crossfadeSeconds: 4.36,
    sourceLufs: -13.78,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
    mixInPointSeconds: 18,
    mixOutPointSeconds: 176,
  }),
  createTransitionProfile({
    introCueSeconds: 0.2,
    outroMixWindowSeconds: 4.5,
    crossfadeSeconds: 4.2,
    sourceLufs: -14.02,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
    mixInPointSeconds: 14,
    mixOutPointSeconds: 168,
  }),
  createTransitionProfile({
    introCueSeconds: 0.16,
    outroMixWindowSeconds: tempoLockedCrossfadeSeconds,
    crossfadeSeconds: tempoLockedCrossfadeSeconds,
    sourceLufs: -13.7,
    tempoLockBars: 2,
    beatDurationSeconds: 0.545,
    mixInPointSeconds: 20,
    mixOutPointSeconds: 178,
  }),
];

const trackNarratives = [
  {
    title: "Aurora Strategy Loop",
    slug: "aurora-strategy-loop",
    musicalKey: "D Minor",
    energyLevel: 7.2,
    moodTags: ["deep-work", "night-drive", "executive"],
    descriptionZh: "深夜決策節奏，適合需要穩定節拍與冷靜推進感的專注時段。",
    descriptionEn: "A disciplined night-work groove built for focused executive planning and steady strategic momentum.",
    themeScenario: "山中豪宅書房，壁爐旁的 CEO 深夜規劃季度策略。",
  },
  {
    title: "Ember Focus Drive",
    slug: "ember-focus-drive",
    musicalKey: "F Minor",
    energyLevel: 7.6,
    moodTags: ["focus", "fireplace", "flow-state"],
    descriptionZh: "帶有壁爐暖度的推進型節奏，適合長時間 coding 與深度思考。",
    descriptionEn: "A warm but driven rhythm tuned for long coding blocks, deliberate thinking, and protected flow.",
    themeScenario: "壁爐火光映在深木桌面上，專注處理高壓但需要沉著的工作。",
  },
  {
    title: "Summit Rhythm Frame",
    slug: "summit-rhythm-frame",
    musicalKey: "A Minor",
    energyLevel: 7.8,
    moodTags: ["summit", "clarity", "creative"],
    descriptionZh: "視野打開後的穩定上升感，適合創作、統整與切入重要決策。",
    descriptionEn: "An expansive, upward pulse that supports ideation, synthesis, and high-stakes decision framing.",
    themeScenario: "站在山景玻璃前整理創作框架，視野遼闊但節奏仍然緊實。",
  },
  {
    title: "Obsidian Session Grid",
    slug: "obsidian-session-grid",
    musicalKey: "C Minor",
    energyLevel: 8,
    moodTags: ["obsidian", "systems", "discipline"],
    descriptionZh: "偏理性與系統感的深色節奏，適合規劃流程、檢查清單與工作系統化。",
    descriptionEn: "A darker systems-minded pulse for operational reviews, checklists, and disciplined execution sessions.",
    themeScenario: "黑曜石色調的工作室內，逐項對齊流程、節點與目標。",
  },
  {
    title: "Nocturne Executive Flow",
    slug: "nocturne-executive-flow",
    musicalKey: "E Minor",
    energyLevel: 7.4,
    moodTags: ["nocturne", "cinematic", "executive"],
    descriptionZh: "夜色中帶電影感的專注流，適合寫作、企劃與長時段沉浸工作。",
    descriptionEn: "A cinematic nocturne for writing, planning, and immersive work sessions that need refined tension.",
    themeScenario: "夜色壓低了外界聲響，只剩火光、森林與室內低頻節奏。",
  },
] as const;

export const tracks: Track[] = trackNarratives.map((item, index) => ({
  id: item.slug.replace(/-/g, "-"),
  slug: item.slug,
  title: item.title,
  bpm: 110,
  durationSeconds: 198 + index * 4,
  musicalKey: item.musicalKey,
  energyLevel: item.energyLevel,
  moodTags: [...item.moodTags],
  status: "published",
  media: {
    audioUrl: "/audio/demo.mp3",
    coverImageUrl: "/img/demo.jpg",
    backgroundVideoUrl: "/video/demo.mp4",
  },
  copy: {
    descriptionZh: item.descriptionZh,
    descriptionEn: item.descriptionEn,
    themeScenario: item.themeScenario,
  },
  prompts: {
    musicPrompt: defaultMusicPrompt,
    imagePrompt: defaultImagePrompt,
    videoPrompt: defaultVideoPrompt,
    generationPrompt: `情境：${item.themeScenario}。請先萃取情境關鍵字，再依此生成歌名、背景圖片、背景影片、中文敘述、英文敘述與同風格音樂提示詞。`,
  },
  transition: transitionProfiles[index],
  createdAt: `2026-07-0${index + 1}T21:00:00.000Z`,
}));

export const mixSessions: MixSession[] = [
  {
    id: "session-private-001",
    listenerMode: "private_studio",
    startedAt: "2026-07-02T20:00:00.000Z",
    endedAt: "2026-07-02T20:46:00.000Z",
    trackSequence: [tracks[0].id, tracks[2].id, tracks[4].id],
    savedMixTitle: "CEO Night Sprint",
    completionRate: 0.94,
  },
  {
    id: "session-public-101",
    listenerMode: "public_mix",
    startedAt: "2026-07-02T21:12:00.000Z",
    endedAt: "2026-07-02T21:58:00.000Z",
    trackSequence: [tracks[1].id, tracks[3].id, tracks[4].id],
    savedMixTitle: "Fireplace Flow Stack",
    completionRate: 0.89,
  },
  {
    id: "session-public-102",
    listenerMode: "public_mix",
    startedAt: "2026-07-02T22:06:00.000Z",
    endedAt: "2026-07-02T22:38:00.000Z",
    trackSequence: [tracks[0].id, tracks[1].id, tracks[3].id, tracks[4].id],
    completionRate: 0.81,
  },
];

export const mixEvents: MixEvent[] = [
  {
    id: "event-001",
    sessionId: "session-private-001",
    type: "transition_complete",
    trackId: tracks[2].id,
    fromTrackId: tracks[0].id,
    toTrackId: tracks[2].id,
    value: 173,
    occurredAt: "2026-07-02T20:18:12.000Z",
  },
  {
    id: "event-002",
    sessionId: "session-private-001",
    type: "transition_complete",
    trackId: tracks[4].id,
    fromTrackId: tracks[2].id,
    toTrackId: tracks[4].id,
    value: 179,
    occurredAt: "2026-07-02T20:31:40.000Z",
  },
  {
    id: "event-003",
    sessionId: "session-public-101",
    type: "transition_complete",
    trackId: tracks[3].id,
    fromTrackId: tracks[1].id,
    toTrackId: tracks[3].id,
    value: 168,
    occurredAt: "2026-07-02T21:24:09.000Z",
  },
  {
    id: "event-004",
    sessionId: "session-public-101",
    type: "save_mix",
    trackId: tracks[4].id,
    value: 1,
    occurredAt: "2026-07-02T21:56:30.000Z",
  },
  {
    id: "event-005",
    sessionId: "session-public-102",
    type: "transition_complete",
    trackId: tracks[1].id,
    fromTrackId: tracks[0].id,
    toTrackId: tracks[1].id,
    value: 171,
    occurredAt: "2026-07-02T22:14:43.000Z",
  },
  {
    id: "event-006",
    sessionId: "session-public-102",
    type: "transition_complete",
    trackId: tracks[3].id,
    fromTrackId: tracks[1].id,
    toTrackId: tracks[3].id,
    value: 166,
    occurredAt: "2026-07-02T22:21:56.000Z",
  },
  {
    id: "event-007",
    sessionId: "session-public-102",
    type: "transition_complete",
    trackId: tracks[4].id,
    fromTrackId: tracks[3].id,
    toTrackId: tracks[4].id,
    value: 181,
    occurredAt: "2026-07-02T22:29:18.000Z",
  },
];

export const bpmOptions = [90, 110, 120] as const;

export const promptWorkflowSteps = [
  {
    id: "Step 1",
    title: "情境母題設計",
    purpose: "先定義這首歌的世界觀、場景與情緒，後面所有素材都以此為母體。",
    prompt: `你是一位擅長設計高級沉浸式音樂情境的創意策劃師。

請根據我提供的核心想法，整理成可用於後續 AI 生成音樂、封面圖、背景影片與網站 metadata 的情境母題。

請輸出：
1. themeScenario
2. 核心情緒（3-5 個）
3. 使用場景
4. 建議 BPM 範圍
5. 建議 energy level（1-10）
6. 視覺關鍵字
7. 音樂風格關鍵字
8. 適合接歌的前後氛圍描述

核心想法：
【在這裡填你的想法】`,
  },
  {
    id: "Step 2",
    title: "音樂 Prompt 生成",
    purpose: "把情境母題轉成 AI 音樂工具可直接使用的英文 prompt。",
    prompt: `你是一位專業的 AI 音樂生成提示詞設計師。

請根據以下情境母題，產出 3 組高品質英文音樂生成 prompt，用於生成適合深度工作、可平順接歌的 instrumental 電子音樂。

目標：
- 無人聲
- 節奏穩定
- 可 long loop
- 適合 crossfade
- cinematic、dark atmospheric、premium、sophisticated

情境母題：
【貼上 Step 1 結果】`,
  },
  {
    id: "Step 3",
    title: "圖像與影片 Prompt",
    purpose: "同步產出封面圖與背景影片 prompt，確保同一首歌的視覺一致。",
    prompt: `你是一位高端品牌視覺與 cinematic motion prompt 設計師。

請根據以下情境母題，各產出：
1. 3 組英文封面圖 prompt
2. 3 組英文背景影片 prompt

要求：
- photorealistic
- dark mode friendly
- premium、moody、focused
- 適合山景豪宅、壁爐、CEO workspace 場景

情境母題：
【貼上 Step 1 結果】`,
  },
  {
    id: "Step 4",
    title: "歌曲 Metadata 生成",
    purpose: "產出歌名、描述、slug、mood tags 與音樂屬性，方便上站。",
    prompt: `你是一位高端音樂品牌內容編輯。

請根據以下情境母題與音樂方向，生成一組網站用歌曲 metadata。

請輸出：
1. title
2. slug
3. descriptionZh
4. descriptionEn
5. moodTags（5 個）
6. musicalKey 建議
7. energyLevel（1-10）
8. 建議 BPM

情境母題：
【貼上 Step 1 結果】

音樂方向：
【貼上 Step 2 選中的音樂 prompt】`,
  },
  {
    id: "Step 5",
    title: "Track JSON 整理",
    purpose: "把生成結果轉成可直接貼進專案的資料結構。",
    prompt: `你是一位 TypeScript 資料整理助手。

請把我提供的歌曲資料整理成符合下列欄位結構的 JSON 物件：
- id
- slug
- title
- bpm
- durationSeconds
- musicalKey
- energyLevel
- moodTags
- status
- media.audioUrl
- media.coverImageUrl
- media.backgroundVideoUrl
- copy.descriptionZh
- copy.descriptionEn
- copy.themeScenario
- prompts.musicPrompt
- prompts.imagePrompt
- prompts.videoPrompt
- prompts.generationPrompt

規則：
- 只輸出 JSON
- 不要加 markdown
- 不要省略欄位

原始資料：
【貼上歌名、描述、prompts、檔案路徑等】`,
  },
] as const;
