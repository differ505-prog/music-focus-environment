import type { MixEvent, MixSession, ThemeProgram, Track, TrackTransitionProfile } from "@/types/music";
import { bpmLaneOptions } from "@/lib/bpm-lanes";

function buildMusicPrompt(bpm: number) {
  return `Instrumental deep chillwave, melodic techno, dark atmospheric electronic, steady driving bassline, focused deep work rhythm for CEO mindset, tempo ${bpm} BPM, constant tempo, subtle background fireplace crackling sounds, ambient, no vocals, cinematic, sophisticated.`;
}

export const defaultMusicPrompt = buildMusicPrompt(110);

export const defaultImagePrompt =
  "Cinematic interior shot of a luxurious modern mansion in the mountains. Massive floor-to-ceiling windows revealing a dark, dense, and misty pine forest outside. A warm, roaring fireplace is burning in the living room. Sleek, sophisticated CEO workspace with a dark wood desk, moody ambient lighting, photorealistic, 8k resolution, architectural photography, cozy yet powerful and focused atmosphere.";

export const defaultVideoPrompt =
  "Slow cinematic dolly shot inside a luxurious mountain mansion at night. Floor-to-ceiling windows show a dark misty pine forest outside. Warm fireplace flicker fills a sophisticated CEO workspace with dark wood desk, subtle ambient lighting, photorealistic motion, premium architectural film look, calm and focused atmosphere.";

export const generatedSceneImageUrl = `https://core-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(defaultImagePrompt)}&image_size=landscape_16_9`;

const targetLufs = -14.5;

function dbToGain(db: number) {
  return Number(Math.pow(10, db / 20).toFixed(3));
}

function createTransitionProfile(profile: {
  bpm: number;
  introCueSeconds: number;
  sourceLufs: number;
  tempoLockBars: number;
  mixInPointSeconds: number;
  mixOutPointSeconds: number;
}): TrackTransitionProfile {
  const normalizationGainDb = Number((targetLufs - profile.sourceLufs).toFixed(2));
  const beatDurationSeconds = Number((60 / profile.bpm).toFixed(3));
  const crossfadeSeconds = Number((beatDurationSeconds * profile.tempoLockBars * 4).toFixed(2));

  return {
    ...profile,
    outroMixWindowSeconds: crossfadeSeconds,
    crossfadeSeconds,
    targetGain: dbToGain(normalizationGainDb),
    targetLufs,
    normalizationGainDb,
    fadeCurve: "equal_power",
    beatDurationSeconds,
  };
}

const transitionProfiles: TrackTransitionProfile[] = [
  createTransitionProfile({
    bpm: 110,
    introCueSeconds: 0.12,
    sourceLufs: -13.95,
    tempoLockBars: 2,
    mixInPointSeconds: 16,
    mixOutPointSeconds: 170,
  }),
  createTransitionProfile({
    bpm: 85,
    introCueSeconds: 0.28,
    sourceLufs: -14.08,
    tempoLockBars: 2,
    mixInPointSeconds: 12,
    mixOutPointSeconds: 167,
  }),
  createTransitionProfile({
    bpm: 110,
    introCueSeconds: 0.08,
    sourceLufs: -13.78,
    tempoLockBars: 2,
    mixInPointSeconds: 18,
    mixOutPointSeconds: 176,
  }),
  createTransitionProfile({
    bpm: 115,
    introCueSeconds: 0.2,
    sourceLufs: -14.02,
    tempoLockBars: 2,
    mixInPointSeconds: 14,
    mixOutPointSeconds: 168,
  }),
  createTransitionProfile({
    bpm: 120,
    introCueSeconds: 0.16,
    sourceLufs: -13.7,
    tempoLockBars: 2,
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
    bpm: 110,
  },
  {
    title: "Ember Focus Drive",
    slug: "ember-focus-drive",
    musicalKey: "F Minor",
    energyLevel: 6.8,
    moodTags: ["slow-focus", "fireplace", "flow-state"],
    descriptionZh: "更慢、更穩的深度工作節奏，適合低壓長時段閱讀、研究與沉靜整理。",
    descriptionEn: "A slower cadence for research, deliberate reading, and calm long-form focus without rushing the mind.",
    themeScenario: "壁爐火光映在深木桌面上，以更慢的呼吸節奏整理資訊、閱讀與思考。",
    bpm: 85,
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
    bpm: 110,
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
    bpm: 115,
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
    bpm: 120,
  },
] as const;

export const tracks: Track[] = trackNarratives.map((item, index) => ({
  id: item.slug.replace(/-/g, "-"),
  slug: item.slug,
  title: item.title,
  bpm: item.bpm,
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
    musicPrompt: buildMusicPrompt(item.bpm),
    imagePrompt: defaultImagePrompt,
    videoPrompt: defaultVideoPrompt,
    generationPrompt: `情境：${item.themeScenario}。BPM 必須從 ${bpmLaneOptions.join(" / ")} 中擇一，再依此生成歌名、背景圖片、背景影片、中文敘述、英文敘述與同風格音樂提示詞。`,
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

export const bpmOptions = bpmLaneOptions;

export const themePrograms: ThemeProgram[] = [
  {
    id: "ceo-focus-lanes",
    label: "CEO Deep Focus",
    title: "多車道深度專注主題",
    bpmDisplay: "85 / 100 / 105 / 110 / 115 / 120 BPM",
    summary:
      "主打夜間決策、寫作、coding 與高密度思考，維持可平順接歌的 BPM 車道與穩定情緒弧線。",
    audience: "深度工作、策略規劃、長時間沉浸專注",
    positioning:
      "以低干擾、高質感、長時段沉浸為核心，先用少量抽象母題建立 CEO 場景，再依 BPM 車道拆出可量產的專注型內容資產。",
    operatingPrinciples: [
      "共用骨架固定 long-loop、no vocals、equal-power crossfade、LUFS 正規化與 dark premium 美學，不讓品質規格在主題切換時漂移。",
      "BPM 只能走 85 / 100 / 105 / 110 / 115 / 120 六條車道，85 專責慢速沉浸，其餘車道維持可接歌策略。",
      "先做情緒與場景，再做音樂 prompt；禁止只換 BPM 不換聲音世界觀，避免生成出節奏對但氣質錯的內容。",
    ],
    layoutNotes: [
      "前台主視覺維持深黑玻璃與霓虹紫冷青藍，卡片資訊偏精準、理性、低干擾。",
      "播放器以播放清單、Crossfade、BPM 相容提示為核心，強調無痕切換。",
      "後台工作流保留低輸入母題設計與固定 BPM 選擇題，方便規律上架。",
    ],
    workflow: [
      {
        id: "Focus 01",
        title: "情境母題",
        detail: "輸入豪宅書房、壁爐、玻璃、夜景、決策感等抽象詞，交由 LLM 補完整體情境。",
        deliverable: "得到可直接進入後續生成的主題 brief，含情緒、使用場景、BPM 車道與轉場氛圍。",
      },
      {
        id: "Focus 02",
        title: "BPM 車道決策",
        detail: "只允許 85 / 100 / 105 / 110 / 115 / 120，85 負責慢速深度工作，其餘車道維持原本可接歌策略。",
        deliverable: "鎖定單一 BPM 與 energy level，避免同一首歌同時帶多個節奏意圖。",
      },
      {
        id: "Focus 03",
        title: "音樂與視覺生成",
        detail: "同步產出 loop 友善的電子音樂 prompt、封面圖 prompt、背景影片 prompt。",
        deliverable: "取得可直接丟進 AI 工具的音樂、封面與背景影片素材提示詞。",
      },
      {
        id: "Focus 04",
        title: "Track 上架與接歌校正",
        detail: "整理 metadata、transition profile、LUFS 與 crossfade cue，再進後台收數據。",
        deliverable: "完成 Track JSON、transition metadata 與上架文案，進入網站與數據迭代。",
      },
    ],
    promptSeed:
      "高級豪宅書房、玻璃窗外霧林、低亮壁爐、深夜季度規劃、冷靜推進、沉著高壓、黑曜石木質、CEO deep work",
    promptModules: [
      {
        id: "Module 01",
        title: "主題母版 Brief",
        purpose: "把少量抽象線索擴寫成可執行的 CEO Deep Focus 生產 brief。",
        template: `你是一位高端沉浸式音樂企劃師。

請根據我提供的少量線索，輸出一份 CEO Deep Focus 主題 brief。

必須輸出：
1. themeScenario
2. 核心情緒 3-5 個
3. 使用場景
4. 建議 BPM（只能從 85 / 100 / 105 / 110 / 115 / 120 擇一）
5. 建議 energy level（1-10）
6. 視覺關鍵字
7. 音樂風格關鍵字
8. 前後接歌氛圍描述

固定規則：
- 走 dark premium、deep work、low distraction
- 不要反問，直接補足缺漏
- 內容需支援 long-loop 與平順 crossfade

輸入線索：
【貼上抽象畫面、材質、情緒、時間感】`,
      },
      {
        id: "Module 02",
        title: "音樂 Prompt 模組",
        purpose: "把 brief 轉為可直接生成的英文音樂提示詞。",
        outputSlots: 2,
        outputSlotLabels: ["候選 Prompt 01", "候選 Prompt 02"],
        template: `You are a professional AI music prompt designer.

Generate 2 English prompts for CEO Deep Focus instrumental electronic music.

Requirements:
- dark atmospheric
- premium and sophisticated
- stable groove for long-form focus
- no vocals
- loop-friendly
- smooth crossfade ready
- keep the BPM exactly the same as the brief

Negative constraints:
- no festival drop
- no flashy lead hook
- no busy drum fills
- no vocal chops

Brief:
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 03",
        title: "視覺 Prompt 模組",
        purpose: "同步建立封面與背景動態素材，讓主題視覺保持一致。",
        template: `你是一位高端品牌視覺 prompt 設計師。

請根據 CEO Deep Focus brief 產出：
1. 2 組封面圖英文 prompt
2. 2 組背景影片英文 prompt

要求：
- photorealistic
- dark mode friendly
- luxurious workspace
- glass, wood, fireplace, night skyline
- moody but controlled
- 避免過亮霓虹與過度娛樂感

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "上架 JSON 模組",
        purpose: "把生成結果整理成網站可直接使用的 Track 資產。",
        template: `你是一位 TypeScript 音樂資料整理助手。

請把以下資料整理成 Track JSON 與 transition 補充欄位：
- title
- slug
- bpm
- musicalKey
- energyLevel
- moodTags
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
- transition.introCueSeconds
- transition.mixInPointSeconds
- transition.mixOutPointSeconds

規則：
- 只輸出 JSON
- 欄位不可省略
- transition 需符合該 BPM 車道的平順接歌邏輯

原始資料：
【貼上已選 prompt、音檔資訊、封面、影片與描述】`,
      },
    ],
    acceptanceChecklist: [
      {
        id: "Check 01",
        title: "主題辨識成立",
        detail: "聽感應偏沉著、理性、深夜專注，而不是夜店、電玩或過度戲劇化。",
      },
      {
        id: "Check 02",
        title: "BPM 車道正確",
        detail: "必須落在既定六條車道，且 85 BPM 只能用於慢速沉浸與閱讀型內容。",
      },
      {
        id: "Check 03",
        title: "可循環可接歌",
        detail: "段落密度穩定、無突兀 break，轉場 metadata 足以支撐 equal-power crossfade。",
      },
      {
        id: "Check 04",
        title: "上架資料完整",
        detail: "封面、背景影片、描述、提示詞與 transition 欄位全部齊備，可直接進站。",
      },
    ],
  },
  {
    id: "slow-jog-180",
    label: "BPM 180 Slow Jog",
    title: "180 慢跑節奏主題",
    bpmDisplay: "180 BPM",
    summary:
      "主打穩定步頻、輕推進、戶外夜跑與耐力慢跑場景，重點不是夜店接歌，而是步伐鎖定與續航感。",
    audience: "慢跑、跑步機、夜跑暖身、低壓耐力訓練",
    positioning:
      "不是聽放鬆的，這本質上是一個 BPM 180 的節拍器 (Metronome)。必須嚴格鎖定步頻，每一拍都要對齊腳步，作為維持長距離 cadence 的高強度實用工具。",
    operatingPrinciples: [
      "共用骨架延續 no vocals、long-loop、平順轉場與 dark premium 視覺，但聽感絕對不能放鬆，必須有 relentless 的推進感。",
      "所有 prompt 與 metadata 固定 180 BPM，不做多車道，確保跑步時身體節奏不被拉扯。",
      "優先描述腳步鎖定 (cadence lock)、節拍器般精準 (metronomic precision) 與高度功能性 (functional tool)。",
    ],
    layoutNotes: [
      "前台新增獨立主題卡，視覺偏霓虹跑道、城市夜霧、呼吸節奏線，而不是豪宅壁爐。",
      "資訊排版要把步頻、跑感、適用距離、建議配速感放在前段，讓運動情境一眼成立。",
      "後台 workflow 應固定 180 BPM，不走多車道，而是強調 cadence 穩定、低人聲、長時循環。",
    ],
    workflow: [
      {
        id: "Run 01",
        title: "跑步情境母題",
        detail: "輸入夜跑路面、城市霓虹、微汗、冷風、腳步節奏、穩定呼吸等抽象詞，生成完整跑步場景。",
        deliverable: "得到可直接用於跑步音樂生成的場景 brief，含步頻感、呼吸節奏與使用場景。",
      },
      {
        id: "Run 02",
        title: "180 BPM 固定策略",
        detail: "所有 prompt 與 metadata 鎖定 180 BPM，不允許自由變動，確保步頻一致。",
        deliverable: "將同一首歌的 cadence 與 metadata 固定在單一跑步節奏上。",
      },
      {
        id: "Run 03",
        title: "跑感導向生成",
        detail: "音樂 prompt 需強調 steady cadence、light propulsion、long-run friendly、no vocals、clean transient。",
        deliverable: "產出真正服務跑步的音樂、封面與影片提示詞，而不是泛用電子曲風。",
      },
      {
        id: "Run 04",
        title: "跑步版面與上架",
        detail: "卡片與後台要突出步頻、公里感、運動用途與視覺場景，形成與專注主題不同的內容線。",
        deliverable: "整理出可直接上架的運動型 Track 與對應情境文案。",
      },
    ],
    promptSeed:
      "180 BPM slow jog, neon city night run, wet asphalt reflections, cool air, even cadence, light propulsion, endurance focus, no vocals",
    promptModules: [
      {
        id: "Module 01",
        title: "跑步主題 Brief",
        purpose: "把少量跑步意象整理成固定 180 BPM 的運動生產 brief。",
        template: `你是一位跑步音樂內容策劃師。

請根據我提供的抽象線索，輸出一份 BPM 180 Slow Jog brief。

必須輸出：
1. themeScenario
2. 核心情緒 3-5 個
3. 使用場景
4. BPM（固定 180，不可改）
5. 建議 energy level（1-10）
6. 跑感關鍵字
7. 視覺關鍵字
8. 前後接歌氛圍描述

固定規則：
- 這不是用來放鬆的音樂，而是一個高度功能性的 BPM 180 節拍器
- 以 strict cadence lock、metronomic precision、functional workout tool 為主
- 從頭到尾必須有清晰且不間斷的鼓點，禁止無節拍的 Intro/Outro
- 不要反問，直接補足缺漏
- 必須讓跑者每一步都能踩在拍子上

輸入線索：
【貼上跑道、城市、呼吸、體感、時間感】`,
      },
      {
        id: "Module 02",
        title: "跑感音樂 Prompt",
        purpose: "建立專屬於 180 慢跑的英文音樂生成模板。",
        template: `You are a professional AI music prompt designer for running playlists.

Generate 1 English prompt for a BPM 180 Slow Jog instrumental track.

Requirements:
- exact 180 BPM
- strict cadence lock, metronomic precision
- highly functional running tool, NOT for relaxing
- relentless four-on-the-floor or continuous drum beat from start to finish
- immediate rhythm lock, NO ambient intros or beatless outros
- clean transient, strong attack on beats
- no vocals
- loop-friendly for long runs

Negative constraints:
- no chillout elements
- no relaxing or ambient textures
- no syncopation that disrupts footing
- no beatless sections
- no ambient intro/outro
- no chaotic percussion switch
- no heavy EDM drop
- no distracting melody spotlight
- no spoken word

Brief:
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 03",
        title: "跑步視覺 Prompt",
        purpose: "讓封面與背景影片直接服務夜跑與耐力訓練情境。",
        template: `你是一位運動場景視覺 prompt 設計師。

請根據 BPM 180 Slow Jog brief 產出：
1. 2 組封面圖英文 prompt
2. 2 組背景影片英文 prompt

要求：
- photorealistic
- neon city night run
- wet asphalt reflections
- cold air, controlled breathing, forward motion
- 不要豪宅、壁爐、商務書房意象

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "運動上架 JSON",
        purpose: "把跑步內容整理成可直接貼入專案的資產資料。",
        template: `你是一位 TypeScript 運動音樂資料整理助手。

請把以下資料整理成 Track JSON 與運動用途補充描述：
- title
- slug
- bpm
- musicalKey
- energyLevel
- moodTags
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
- transition.introCueSeconds
- transition.mixInPointSeconds
- transition.mixOutPointSeconds

規則：
- 只輸出 JSON
- BPM 必須為 180
- 文案需突出 cadence、耐力、夜跑或跑步機用途

原始資料：
【貼上已選 prompt、音檔資訊、封面、影片與描述】`,
      },
    ],
    acceptanceChecklist: [
      {
        id: "Check 01",
        title: "純功能性節拍器",
        detail: "這不是用來聽放鬆的。每一步都必須有明確鼓點對齊（Metronomic），沒有讓人想放慢腳步的 chill/ambient 感。",
      },
      {
        id: "Check 02",
        title: "180 BPM 鎖定",
        detail: "所有 metadata、prompt 與最終標示都必須維持 180 BPM，不接受偏移。",
      },
      {
        id: "Check 03",
        title: "長跑友善",
        detail: "loop 感穩定、低人聲、低驚嚇點，適合長時間重複播放與連續轉場。",
      },
      {
        id: "Check 04",
        title: "主題視覺分流",
        detail: "封面與影片需呈現夜跑、城市、路面反光等意象，不可混入 CEO 書房語彙。",
      },
    ],
  },
];
