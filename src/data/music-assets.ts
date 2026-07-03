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

type TrackNarrativeSeed = {
  title: string;
  slug: string;
  musicalKey: string;
  energyLevel: number;
  moodTags: string[];
  descriptionZh: string;
  descriptionEn: string;
  themeScenario: string;
  bpm: number;
  durationSeconds?: number;
  media?: Partial<Track["media"]>;
  prompts?: Partial<Track["prompts"]>;
  createdAt?: string;
};

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
    bpm: 85,
    introCueSeconds: 0.24,
    sourceLufs: -14.22,
    tempoLockBars: 2,
    mixInPointSeconds: 18,
    mixOutPointSeconds: 288,
  }),
  createTransitionProfile({
    bpm: 85,
    introCueSeconds: 0.3,
    sourceLufs: -14.34,
    tempoLockBars: 2,
    mixInPointSeconds: 16,
    mixOutPointSeconds: 268,
  }),
  createTransitionProfile({
    bpm: 105,
    introCueSeconds: 0.22,
    sourceLufs: -14.48,
    tempoLockBars: 2,
    mixInPointSeconds: 18,
    mixOutPointSeconds: 266,
  }),
  createTransitionProfile({
    bpm: 105,
    introCueSeconds: 0.18,
    sourceLufs: -14.57,
    tempoLockBars: 2,
    mixInPointSeconds: 14,
    mixOutPointSeconds: 258,
  }),
  createTransitionProfile({
    bpm: 105,
    introCueSeconds: 0.26,
    sourceLufs: -14.41,
    tempoLockBars: 2,
    mixInPointSeconds: 20,
    mixOutPointSeconds: 325,
  }),
  createTransitionProfile({
    bpm: 105,
    introCueSeconds: 0.2,
    sourceLufs: -14.63,
    tempoLockBars: 2,
    mixInPointSeconds: 22,
    mixOutPointSeconds: 340,
  }),
];

const trackNarratives: TrackNarrativeSeed[] = [
  {
    title: "Skyline Ember Ledger",
    slug: "skyline-ember-ledger",
    musicalKey: "B Minor",
    energyLevel: 6.7,
    moodTags: ["skyline", "firelight", "deep-work"],
    descriptionZh: "高樓夜景與壁爐火光交疊出的 85 BPM 深度工作節奏，適合寫作、規劃與長時間低壓沉浸。",
    descriptionEn: "An 85 BPM executive focus groove shaped by city-light tension and fireplace warmth, designed for writing, planning, and extended low-pressure immersion.",
    themeScenario: "高樓書桌前的深色辦公室裡，城市燈海鋪在窗外，火光把節奏壓進更安靜、更穩定的夜間專注狀態。",
    bpm: 85,
    durationSeconds: 320,
    media: {
      audioUrl: "/audio/skyline-ember-ledger.mp3",
      coverImageUrl: "/img/skyline-ember-ledger-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental deep focus electronic, dark premium atmosphere, 85 BPM exact tempo, steady low-pressure groove, warm fireplace texture, subtle nocturnal skyline ambience, no vocals, loop-friendly, smooth equal-power crossfade ready, sophisticated, restrained and executive.",
      imagePrompt:
        "Photorealistic executive office at night with a dark desk, warm fireplace on the left, floor-to-ceiling glass revealing a vast city skyline, low-key cinematic lighting, premium dark mode aesthetic, calm, disciplined and deeply focused atmosphere.",
      videoPrompt:
        "Slow cinematic shot inside a dark premium executive office at night, warm fireplace glow, wide glass windows overlooking a city skyline, subtle motion, low-key lighting, disciplined deep work atmosphere.",
      generationPrompt:
        "情境：高樓夜景、深色辦公室、黑木桌面、壁爐火光、長時間低壓深度工作。BPM 固定 85，不可漂移；需支援 long-loop、no vocals、equal-power crossfade、低干擾且沉著的 CEO Deep Focus 聽感。",
    },
    createdAt: "2026-07-02T22:45:00.000Z",
  },
  {
    title: "Harbor Afterglow Study",
    slug: "harbor-afterglow-study",
    musicalKey: "D Minor",
    energyLevel: 6.4,
    moodTags: ["harbor", "night-study", "glassmorphism"],
    descriptionZh: "河岸夜景、壁爐暖光與低亮客廳所構成的 85 BPM 夜讀節奏，適合閱讀、整理與靜態思考。",
    descriptionEn: "An 85 BPM late-night study loop with harbor lights, fireplace warmth, and a restrained lounge atmosphere for reading, reflection, and deliberate note-taking.",
    themeScenario: "面向河岸燈火的深色客廳中，沙發、酒杯與燭光維持安靜秩序，讓思緒在穩定節拍裡延長停留。",
    bpm: 85,
    durationSeconds: 299,
    media: {
      audioUrl: "/audio/harbor-afterglow-study.mp3",
      coverImageUrl: "/img/harbor-afterglow-study-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental deep work electronic, 85 BPM exact tempo, warm low-saturation groove, fireplace ambience, distant harbor night atmosphere, no vocals, long-form loop friendly, soft but stable pulse, elegant and controlled.",
      imagePrompt:
        "Photorealistic dark luxury lounge at night with a fireplace, sofa, candlelit marble table, floor-to-ceiling windows overlooking a harbor skyline, moody cinematic lighting, calm premium deep work atmosphere.",
      videoPrompt:
        "Slow cinematic interior shot of a dark luxury lounge at night, fireplace flicker, harbor skyline beyond large windows, candlelight reflections, subtle motion, quiet late-night study atmosphere.",
      generationPrompt:
        "情境：河岸夜景、深色客廳、沙發、燭光、壁爐暖光與夜讀工作。BPM 固定 85，不可漂移；需支援閱讀型沉浸、long-loop、no vocals、equal-power crossfade 與穩定低壓節奏。",
    },
    createdAt: "2026-07-02T22:52:00.000Z",
  },
  {
    title: "Obsidian Lake Focus",
    slug: "obsidian-lake-focus",
    musicalKey: "F Minor",
    energyLevel: 4.1,
    moodTags: ["misty-lake", "dark-forest", "105-bpm"],
    descriptionZh:
      "薄霧冷湖與針葉林包圍出的 105 BPM 心流迴圈，節奏穩定、情緒克制，適合深夜決策、模型審閱與長時間策略思考。",
    descriptionEn:
      "A 105 BPM executive focus loop shaped by a misty cold lake, dark coniferous forest, and sealed architectural calm, built for deep strategy sessions and uninterrupted analytical work.",
    themeScenario:
      "黑曜湖畔的極簡辦公桌前，霧氣沿著森林邊界緩慢推進，厚玻璃隔開外界雜訊，只留下冷靜、穩定而持續前進的專注脈衝。",
    bpm: 105,
    durationSeconds: 298,
    media: {
      audioUrl: "/audio/misty-lake-loop.mp3",
      coverImageUrl: "/img/misty-lake-loop-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "105 BPM, Nordic electronica, dark ambient, low-end atmospheric drone, highly sophisticated and premium, instrumental. Built on a stable, understated downtempo groove perfect for CEO deep work. Energy level 4/10. Lush, evolving dark synthesizer pads evoke a misty, deep cold lake and dark coniferous forest solitude. The rhythm is anchored by a warm, continuous bassline pulse and subtle, organic textures acting as minimal percussion. Spatial, echoing soundscapes create a feeling of being insulated behind thick glass. The arrangement is completely flat in its dynamic range, ensuring a seamless flow, long-looping readiness, and perfectly smooth crossfades. No vocals, no vocal chops, no festival drop, no flashy lead hooks, no busy drum fills.",
      imagePrompt:
        "Photorealistic executive lakeside cabin workspace at blue-hour, mist hovering over a dark cold lake, coniferous forest silhouettes, floor-to-ceiling glass, matte black steel, walnut desk, warm amber task lamp, dark premium atmosphere, minimalist CEO deep work mood.",
      videoPrompt:
        "Slow cinematic interior shot of a dark luxury lakeside office, mist moving across a cold lake beyond tall glass windows, warm desk lamp and restrained fireplace glow, premium architectural motion, controlled and deeply focused atmosphere.",
      generationPrompt:
        "情境：黑曜湖畔、深色森林、厚玻璃隔音、冷霧湖面與長時間高強度策略思考。BPM 固定 105，不可漂移；需支援 long-loop、no vocals、equal-power crossfade、平直動態範圍與北歐冷調電子氛圍。",
    },
    createdAt: "2026-07-03T11:45:00.000Z",
  },
  {
    title: "Walnut Command Drift",
    slug: "walnut-command-drift",
    musicalKey: "C Minor",
    energyLevel: 4.3,
    moodTags: ["walnut-cabin", "deliberate-control", "105-bpm"],
    descriptionZh:
      "胡桃木桌面、暗色石材與深湖倒影構成的 105 BPM 穩態節拍，適合財務模型、組織決策與需要冷靜推進的長工時工作。",
    descriptionEn:
      "A 105 BPM control-driven loop with walnut textures, matte stone surfaces, and a deep-water backdrop, designed for financial modeling, executive planning, and extended decision-heavy focus.",
    themeScenario:
      "在胡桃木與啞光黑鋼構成的湖畔辦公室裡，低頻像水面下的穩定暗流持續推動思緒，讓理性決策維持絕對掌控與低干擾節奏。",
    bpm: 105,
    durationSeconds: 290,
    media: {
      audioUrl: "/audio/walnut-drift-loop.mp3",
      coverImageUrl: "/img/walnut-drift-loop-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "105 BPM, minimal dub techno, deep organic downtempo, dark atmospheric, premium and sophisticated, instrumental only. A steady, loop-friendly groove designed for long-form deep focus and high-intensity strategic thinking. Energy level 4/10 with sustained low-mid energy. Features a continuous, rolling sub-bassline overlay and muffled, intricate micro-percussion that evokes a sense of absolute detachment. Cinematic, dark drone pads provide a sanctuary of peace, featuring long reverb tails that mimic spatial echoes inside a matte black and walnut wood cabin. The track maintains a constant, hypnotic momentum with zero sudden changes, tailored for smooth crossfades and infinite looping. No vocals, no vocal chops, no festival drop, no flashy lead hooks, no busy drum fills.",
      imagePrompt:
        "Photorealistic dark executive office by a cold forest lake, matte black stone fireplace, walnut wood desk, leather chair, subtle amber lamp glow, floor-to-ceiling glass, heavy quiet atmosphere, premium CEO deep work aesthetic.",
      videoPrompt:
        "Slow cinematic dolly inside a walnut-and-black-steel lakeside office, fireplace reflections, dark water outside panoramic glass, restrained ambient motion, high-end deep work atmosphere.",
      generationPrompt:
        "情境：胡桃木桌面、啞光黑鋼、冷湖倒影、厚實牆面與高強度理性思考。BPM 固定 105，不可漂移；需維持持續低中頻能量、micro-percussion、steady sub-bass overlay、no vocals 與 smooth crossfade-ready 的 CEO Deep Focus 聽感。",
    },
    createdAt: "2026-07-03T11:52:00.000Z",
  },
  {
    title: "Lakeside Ember Terrace",
    slug: "lakeside-ember-terrace",
    musicalKey: "A Minor",
    energyLevel: 4.4,
    moodTags: ["ember-terrace", "lakehouse", "105-bpm"],
    descriptionZh:
      "湖畔露台、火光倒影與潮濕石材鋪陳出的 105 BPM 專注節拍，適合長時段規劃、審稿與需要柔和推進感的高密度工作。",
    descriptionEn:
      "A 105 BPM executive terrace loop balancing lake reflections, ember glow, and restrained propulsion, ideal for long planning sessions, editorial review, and steady high-focus work.",
    themeScenario:
      "半戶外的湖畔露台被冷霧與火光包圍，石材地面映著橘色餘燼，節拍在開闊空間裡維持安靜但持續的推進力。",
    bpm: 105,
    durationSeconds: 357,
    media: {
      audioUrl: "/audio/lakeside-ember-terrace.mp3",
      coverImageUrl: "/img/lakeside-ember-terrace-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "105 BPM, dark atmospheric downtempo, premium executive night ambience, instrumental only. Stable low-mid pulse for long-form focus with subtle ember warmth, wet stone reflections, and open-air lakeside spaciousness. Energy level 4/10, no vocals, no dramatic drops, no busy fills, no sudden dynamic spikes. Continuous bass support, clean restrained percussion, long-loop ready, smooth equal-power crossfade, calm but persistent decision-making momentum.",
      imagePrompt:
        "Photorealistic luxury lakeside terrace at night, dark stone flooring with reflective moisture, open fire pit, fireplace glow, deep forest lake beyond glass edge, warm amber accents, premium dark mode executive atmosphere.",
      videoPrompt:
        "Slow cinematic movement across a dark luxury lakeside terrace at night, soft firelight reflections on wet stone, cold mist above a still lake, restrained premium ambience, long-form deep focus atmosphere.",
      generationPrompt:
        "情境：湖畔露台、濕潤石材、火光倒影、半戶外安靜包覆感與長時間規劃工作。BPM 固定 105，不可漂移；需維持 steady pulse、open-air spaciousness、no vocals、smooth crossfade-ready 與低中頻穩定推進。",
    },
    createdAt: "2026-07-03T12:03:00.000Z",
  },
  {
    title: "Midnight Library Ledger",
    slug: "midnight-library-ledger",
    musicalKey: "E Minor",
    energyLevel: 4.2,
    moodTags: ["midnight-library", "ledger-room", "105-bpm"],
    descriptionZh:
      "雙層書牆、湖景落地窗與暖色吊燈構成的 105 BPM 理性心流，特別適合財務整理、寫作校對與需要秩序感的深夜工作。",
    descriptionEn:
      "A 105 BPM rational-focus loop built for midnight accounting, editing, and structured deep work, framed by towering bookshelves, lake-view glass, and warm pendant light.",
    themeScenario:
      "高挑書房在深夜燈光下維持安靜秩序，窗外霧湖延伸出深度空間感，讓節拍像一條穩定帳本線般持續推進而不打擾思路。",
    bpm: 105,
    durationSeconds: 373,
    media: {
      audioUrl: "/audio/midnight-library-ledger.mp3",
      coverImageUrl: "/img/midnight-library-ledger-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "105 BPM, minimal dub techno, dark academic ambient, premium instrumental focus loop. Controlled pulse, disciplined sub-bass, micro-percussion, and long reverb tails suited for structured midnight work. Energy level 4/10. No vocals, no dramatic transitions, no bright hooks, no festival dynamics. Designed for writing, ledger review, smooth crossfades, and uninterrupted executive concentration.",
      imagePrompt:
        "Photorealistic dark luxury library office at night with double-height bookshelves, warm pendant lights, fireplace, leather seating, walnut desk, and floor-to-ceiling windows overlooking a misty forest lake, premium CEO deep work mood.",
      videoPrompt:
        "Slow cinematic shot inside a tall dark library office at night, warm pendant lights above a walnut desk, fireplace glow, misty lake beyond vast glass windows, premium focused atmosphere with restrained movement.",
      generationPrompt:
        "情境：深夜書房、雙層書牆、暖色吊燈、霧湖窗景與財務帳本式理性工作。BPM 固定 105，不可漂移；需維持 dark academic、micro-percussion、steady sub-bass、no vocals 與 long-loop crossfade-ready 的秩序感。",
    },
    createdAt: "2026-07-03T12:08:00.000Z",
  },
] as const;

export const tracks: Track[] = trackNarratives.map((item, index) => ({
  id: item.slug.replace(/-/g, "-"),
  slug: item.slug,
  title: item.title,
  bpm: item.bpm,
  durationSeconds: item.durationSeconds ?? 198 + index * 4,
  musicalKey: item.musicalKey,
  energyLevel: item.energyLevel,
  moodTags: [...item.moodTags],
  status: "published",
  media: {
    audioUrl: item.media?.audioUrl ?? "",
    coverImageUrl: item.media?.coverImageUrl ?? "/img/demo.jpg",
    backgroundVideoUrl: item.media?.backgroundVideoUrl ?? "",
  },
  copy: {
    descriptionZh: item.descriptionZh,
    descriptionEn: item.descriptionEn,
    themeScenario: item.themeScenario,
  },
  prompts: {
    musicPrompt: item.prompts?.musicPrompt ?? buildMusicPrompt(item.bpm),
    imagePrompt: item.prompts?.imagePrompt ?? defaultImagePrompt,
    videoPrompt: item.prompts?.videoPrompt ?? defaultVideoPrompt,
    generationPrompt:
      item.prompts?.generationPrompt ??
      `情境：${item.themeScenario}。BPM 必須從 ${bpmLaneOptions.join(" / ")} 中擇一，再依此生成歌名、背景圖片、背景影片、中文敘述、英文敘述與同風格音樂提示詞。`,
  },
  transition: transitionProfiles[index],
  createdAt: item.createdAt ?? `2026-07-0${index + 1}T21:00:00.000Z`,
}));

export const mixSessions: MixSession[] = [
  {
    id: "session-private-001",
    listenerMode: "private_studio",
    startedAt: "2026-07-02T20:00:00.000Z",
    endedAt: "2026-07-02T20:22:00.000Z",
    trackSequence: [tracks[0].id, tracks[1].id],
    savedMixTitle: "Skyline Harbor Focus",
    completionRate: 0.96,
  },
  {
    id: "session-public-101",
    listenerMode: "public_mix",
    startedAt: "2026-07-02T21:12:00.000Z",
    endedAt: "2026-07-02T21:42:00.000Z",
    trackSequence: [tracks[1].id, tracks[0].id],
    savedMixTitle: "Afterglow Return Loop",
    completionRate: 0.91,
  },
];

export const mixEvents: MixEvent[] = [
  {
    id: "event-001",
    sessionId: "session-private-001",
    type: "transition_complete",
    trackId: tracks[1].id,
    fromTrackId: tracks[0].id,
    toTrackId: tracks[1].id,
    value: 173,
    occurredAt: "2026-07-02T20:18:12.000Z",
  },
  {
    id: "event-002",
    sessionId: "session-public-101",
    type: "transition_complete",
    trackId: tracks[0].id,
    fromTrackId: tracks[1].id,
    toTrackId: tracks[0].id,
    value: 168,
    occurredAt: "2026-07-02T21:24:09.000Z",
  },
  {
    id: "event-003",
    sessionId: "session-public-101",
    type: "save_mix",
    trackId: tracks[0].id,
    value: 1,
    occurredAt: "2026-07-02T21:56:30.000Z",
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
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
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
        upstreamModuleIds: ["Module 01"],
        autoAdvanceToNext: true,
        quickLinks: [
          { label: "打開 Copilot", url: "https://copilot.microsoft.com/" },
          { label: "打開 Suno", url: "https://suno.com/create" },
        ],
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
        upstreamModuleIds: ["Module 01", "Module 02"],
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        template: `你是一位高端品牌視覺 prompt 設計師。

目前這一輪流程會產出 4 首歌曲：
- Module 02 的候選 Prompt 01 會生成 2 首歌
- Module 02 的候選 Prompt 02 也會生成 2 首歌

請根據 CEO Deep Focus brief 與 2 組音樂 prompt 產出：
1. Song 01 封面圖英文 prompt
2. Song 02 封面圖英文 prompt
3. Song 03 封面圖英文 prompt
4. Song 04 封面圖英文 prompt

要求：
- photorealistic
- dark mode friendly
- luxurious workspace
- glass, wood, fireplace, night skyline
- moody but controlled
- 避免過亮霓虹與過度娛樂感
- 每首歌都要是獨立 prompt，不可合併成「一次生成兩張圖」
- 請明確標示 Song 01 / Song 02 / Song 03 / Song 04
- 視覺語意需對應各首歌的微差異，不可只是改 1-2 個字

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "上架 JSON 模組",
        purpose: "把生成結果整理成網站可直接使用的 Track 資產。",
        upstreamModuleIds: ["Module 01", "Module 02", "Module 03"],
        inputMode: "low_input_auto_context",
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        supplementalLabel: "少量補充資料",
        supplementalPlaceholder:
          "只補必要外部資訊，例如 audioUrl、coverImageUrl、durationSeconds，或你想指定的 title / slug。",
        autoAssembleNote:
          "這一步不需要你重貼前面所有資料。系統會自動抓取已儲存的 Brief、音樂 Prompt、圖片 Prompt，並附上同名異曲檢查與改名 SOP；你只需少量補外部資源或特別指定欄位。",
        autoAssembleInstructions: [
          "請先檢查資料夾內同名歌曲是否其實是不同歌曲，不能只因檔名一樣就視為重複檔。",
          "若同名檔是不同歌曲，請為每一首重新命名，確保 title 與 slug 全部唯一，禁止沿用相同名稱。",
          "Suno 一個提示詞通常會產出 2 首歌；若本輪有 2 組音樂 prompt，預設要整理為 4 首歌的命名與上架資料。",
          "Module 03 若已提供 Song 01 到 Song 04 的獨立圖片 prompt，請一首歌對應一組 cover prompt，不可混用。",
        ],
        template: `你是一位 TypeScript 音樂資料整理助手。

請優先使用我上游已提供的 Brief、音樂 prompt、封面 prompt，自動補完整體 Track JSON。

若我有補充資料，只把它視為少量覆寫資訊，例如：
- audioUrl
- coverImageUrl
- durationSeconds
- 指定 title / slug

請整理成 Track JSON 與 transition 補充欄位：
- title
- slug
- bpm
- musicalKey
- energyLevel
- moodTags
- media.audioUrl
- media.coverImageUrl
- media.backgroundVideoUrl（若目前沒有影片素材可先填空字串）
- copy.descriptionZh
- copy.descriptionEn
- copy.themeScenario
- prompts.musicPrompt
- prompts.imagePrompt
- prompts.videoPrompt（若目前沒有影片提示詞可先填空字串）
- prompts.generationPrompt
- transition.introCueSeconds
- transition.mixInPointSeconds
- transition.mixOutPointSeconds

規則：
- 只輸出 JSON
- 若本輪素材實際包含 4 首歌，就輸出 4 份 Track JSON 陣列
- 欄位不可省略
- transition 需符合該 BPM 車道的平順接歌邏輯
- 若上游已有足夠資訊，請主動生成 title、slug、descriptionZh、descriptionEn、moodTags、musicalKey、energyLevel
- 若我有補充外部資源欄位，請直接覆蓋對應欄位
- 若發現同名檔其實是不同歌曲，必須先重新命名，再輸出對應的 title / slug，不可保留重複名稱

少量補充資料（可為空）：
【只貼外部資源或你想覆寫的欄位】`,
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
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
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
        upstreamModuleIds: ["Module 01"],
        autoAdvanceToNext: true,
        quickLinks: [
          { label: "打開 Copilot", url: "https://copilot.microsoft.com/" },
          { label: "打開 Suno", url: "https://suno.com/create" },
        ],
        outputSlots: 2,
        outputSlotLabels: ["候選 Prompt 01", "候選 Prompt 02"],
        template: `You are a professional AI music prompt designer for running playlists.

Generate 2 English prompts for BPM 180 Slow Jog instrumental tracks.

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
        upstreamModuleIds: ["Module 01", "Module 02"],
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        template: `你是一位運動場景視覺 prompt 設計師。

目前這一輪流程會產出 4 首歌曲：
- Module 02 的候選 Prompt 01 會生成 2 首歌
- Module 02 的候選 Prompt 02 也會生成 2 首歌

請根據 BPM 180 Slow Jog brief 與 2 組音樂 prompt 產出：
1. Song 01 封面圖英文 prompt
2. Song 02 封面圖英文 prompt
3. Song 03 封面圖英文 prompt
4. Song 04 封面圖英文 prompt

要求：
- photorealistic
- neon city night run
- wet asphalt reflections
- cold air, controlled breathing, forward motion
- 不要豪宅、壁爐、商務書房意象
- 每首歌都要是獨立 prompt，不可合併成「一次生成兩張圖」
- 請明確標示 Song 01 / Song 02 / Song 03 / Song 04
- 視覺語意需對應各首歌的微差異，不可只是改 1-2 個字

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "運動上架 JSON",
        purpose: "把跑步內容整理成可直接貼入專案的資產資料。",
        upstreamModuleIds: ["Module 01", "Module 02", "Module 03"],
        inputMode: "low_input_auto_context",
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        supplementalLabel: "少量補充資料",
        supplementalPlaceholder:
          "只補必要外部資訊，例如 audioUrl、coverImageUrl、durationSeconds，或你想指定的 title / slug。",
        autoAssembleNote:
          "這一步會自動沿用前面已儲存的跑步 Brief、音樂 Prompt、圖片 Prompt，並附上同名異曲檢查與改名 SOP。你只補外部資源或少量指定欄位即可。",
        autoAssembleInstructions: [
          "請先檢查資料夾內同名歌曲是否其實是不同歌曲，不能只因檔名一樣就視為重複檔。",
          "若同名檔是不同歌曲，請為每一首重新命名，確保 title 與 slug 全部唯一，禁止沿用相同名稱。",
          "Suno 一個提示詞通常會產出 2 首歌；若本輪有 2 組音樂 prompt，預設要整理為 4 首歌的命名與上架資料。",
          "Module 03 若已提供 Song 01 到 Song 04 的獨立圖片 prompt，請一首歌對應一組 cover prompt，不可混用。",
        ],
        template: `你是一位 TypeScript 運動音樂資料整理助手。

請優先使用我上游已提供的跑步 Brief、音樂 prompt、封面 prompt，自動補完整體 Track JSON。

若我有補充資料，只把它視為少量覆寫資訊，例如：
- audioUrl
- coverImageUrl
- durationSeconds
- 指定 title / slug

請把以下資料整理成 Track JSON 與運動用途補充描述：
- title
- slug
- bpm
- musicalKey
- energyLevel
- moodTags
- media.audioUrl
- media.coverImageUrl
- media.backgroundVideoUrl（若目前沒有影片素材可先填空字串）
- copy.descriptionZh
- copy.descriptionEn
- copy.themeScenario
- prompts.musicPrompt
- prompts.imagePrompt
- prompts.videoPrompt（若目前沒有影片提示詞可先填空字串）
- prompts.generationPrompt
- transition.introCueSeconds
- transition.mixInPointSeconds
- transition.mixOutPointSeconds

規則：
- 只輸出 JSON
- BPM 必須為 180
- 若本輪素材實際包含 4 首歌，就輸出 4 份 Track JSON 陣列
- 文案需突出 cadence、耐力、夜跑或跑步機用途
- 若上游已有足夠資訊，請主動生成 title、slug、descriptionZh、descriptionEn、moodTags、musicalKey、energyLevel
- 若我有補充外部資源欄位，請直接覆蓋對應欄位
- 若發現同名檔其實是不同歌曲，必須先重新命名，再輸出對應的 title / slug，不可保留重複名稱

少量補充資料（可為空）：
【只貼外部資源或你想覆寫的欄位】`,
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
