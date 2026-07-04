import type {
  MixEvent,
  MixSession,
  SessionPreset,
  ThemeProgram,
  Track,
  TrackBatch,
  TrackCollection,
  TrackTransitionProfile,
} from "@/types/music";
import { bpmLaneOptions } from "@/lib/bpm-lanes";

function buildMusicPrompt(bpm: number) {
  return `Instrumental deep chillwave, melodic techno, dark atmospheric electronic, steady driving bassline, focused deep work rhythm for CEO mindset, tempo ${bpm} BPM, constant tempo, subtle background fireplace crackling sounds, ambient, no vocals, cinematic, sophisticated.`;
}

export const defaultMusicPrompt = buildMusicPrompt(105);

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
  themeProgramId?: string;
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
  createTransitionProfile({
    bpm: 85,
    introCueSeconds: 0.24,
    sourceLufs: -14.27,
    tempoLockBars: 2,
    mixInPointSeconds: 18,
    mixOutPointSeconds: 332,
  }),
  createTransitionProfile({
    bpm: 85,
    introCueSeconds: 0.28,
    sourceLufs: -14.39,
    tempoLockBars: 2,
    mixInPointSeconds: 20,
    mixOutPointSeconds: 340,
  }),
  createTransitionProfile({
    bpm: 85,
    introCueSeconds: 0.22,
    sourceLufs: -14.31,
    tempoLockBars: 2,
    mixInPointSeconds: 16,
    mixOutPointSeconds: 240,
  }),
  createTransitionProfile({
    bpm: 85,
    introCueSeconds: 0.26,
    sourceLufs: -14.46,
    tempoLockBars: 2,
    mixInPointSeconds: 16,
    mixOutPointSeconds: 220,
  }),
];

function createFallbackTransitionProfile(item: TrackNarrativeSeed): TrackTransitionProfile {
  const durationSeconds = item.durationSeconds ?? 240;
  const tempoLockBars = item.bpm >= 170 ? 4 : 2;
  const introCueSeconds = item.bpm >= 170 ? 0.12 : 0.24;
  const mixInPointSeconds = item.bpm >= 170 ? 8 : item.bpm >= 120 ? 12 : 16;
  const outroBufferSeconds = Math.max(Number((60 / item.bpm).toFixed(3)) * tempoLockBars * 4, 12);
  const mixOutPointSeconds = Math.max(
    Math.min(durationSeconds - outroBufferSeconds, durationSeconds - 1),
    mixInPointSeconds + 16,
  );

  return createTransitionProfile({
    bpm: item.bpm,
    introCueSeconds,
    sourceLufs: item.bpm >= 170 ? -14.2 : item.bpm >= 120 ? -14.28 : -14.4,
    tempoLockBars,
    mixInPointSeconds,
    mixOutPointSeconds: Number(mixOutPointSeconds.toFixed(2)),
  });
}

const trackNarratives: TrackNarrativeSeed[] = [
  {
    title: "Skyline Ember Ledger",
    slug: "skyline-ember-ledger",
    musicalKey: "B Minor",
    energyLevel: 6.7,
    moodTags: ["高樓夜景", "壁爐火光", "深度工作"],
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
    moodTags: ["河岸夜景", "夜讀", "霧面光感"],
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
    moodTags: ["霧湖", "森林", "105 BPM"],
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
    moodTags: ["胡桃木", "理性推進", "105 BPM"],
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
    moodTags: ["露台火光", "湖畔空間", "105 BPM"],
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
    moodTags: ["深夜書房", "秩序感", "105 BPM"],
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
  {
    title: "Cityglass Night Ledger",
    slug: "cityglass-night-ledger",
    musicalKey: "B Minor",
    energyLevel: 6.2,
    moodTags: ["城市天際線", "黑玻璃桌面", "夜間寫作"],
    descriptionZh:
      "城市燈海、黑玻璃桌面與暖色火光構成的 85 BPM 夜間專注循環，適合寫作、規劃與安靜決策。",
    descriptionEn:
      "An 85 BPM late-night focus loop shaped by city lights, black-glass surfaces, and warm firelight, ideal for writing, planning, and quiet decision-making.",
    themeScenario:
      "高樓辦公室俯瞰整座城市，黑色桌面與窗外密集燈點形成清晰秩序，讓節拍維持冷靜、乾淨且可長時間循環。",
    bpm: 85,
    durationSeconds: 364,
    media: {
      audioUrl: "/audio/cityglass-night-ledger.mp3",
      coverImageUrl: "/img/cityglass-night-ledger-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental deep focus electronic, 85 BPM exact tempo, dark premium skyline atmosphere, black-glass executive office mood, warm fireplace accents, no vocals, loop-friendly, smooth equal-power crossfade ready, disciplined and low-distraction.",
      imagePrompt:
        "Photorealistic executive office at midnight with a black glass desk, leather chair, fireplace glow, floor-to-ceiling windows opening to a vast city skyline, cinematic low-key lighting, calm premium deep work mood.",
      videoPrompt: "",
      generationPrompt:
        "情境：午夜城市天際線、黑玻璃桌面、壁爐火光與安靜決策工作。BPM 固定 85，不可漂移；需支援 no vocals、long-loop、equal-power crossfade 與克制穩定的夜間專注聽感。",
    },
    createdAt: "2026-07-04T00:18:00.000Z",
  },
  {
    title: "Huangpu Afterhours Bridge",
    slug: "huangpu-afterhours-bridge",
    musicalKey: "D Minor",
    energyLevel: 6.4,
    moodTags: ["江景夜色", "橋影燈火", "夜間專注"],
    descriptionZh:
      "江面燈火與橋影節奏構成的 85 BPM 夜間專注曲，適合寫作、整理與低壓長工時工作。",
    descriptionEn:
      "An 85 BPM late-night focus track shaped by river reflections, bridge lights, and restrained executive calm for writing, organizing, and extended low-pressure work.",
    themeScenario:
      "深色辦公室面向黃浦江夜景，橋梁與碼頭燈火在玻璃外維持穩定秩序，讓節拍保持冷靜、平順且不打擾思路。",
    bpm: 85,
    durationSeconds: 373,
    media: {
      audioUrl: "/audio/huangpu-afterhours-bridge.mp3",
      coverImageUrl: "/img/huangpu-afterhours-bridge-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental deep work electronic, 85 BPM exact tempo, premium dark executive atmosphere, gentle riverfront pulse, distant bridge-light ambience, no vocals, loop-friendly, low-distraction arrangement, smooth equal-power crossfade ready, restrained and controlled.",
      imagePrompt:
        "Photorealistic premium executive office at night overlooking the Huangpu river, distant illuminated bridge, dark wood interior, black desk, fireplace glow, floor-to-ceiling glass, calm luxury deep work atmosphere, cinematic low-key lighting.",
      videoPrompt: "",
      generationPrompt:
        "情境：黃浦江夜景、橋影燈火、深色辦公室、壁爐暖光與低壓長時間專注。BPM 固定 85，不可漂移；需支援 long-loop、no vocals、equal-power crossfade、穩定節奏與沉著的夜間工作聽感。",
    },
    createdAt: "2026-07-04T00:20:00.000Z",
  },
  {
    title: "Walnut River Focus",
    slug: "walnut-river-focus",
    musicalKey: "F Minor",
    energyLevel: 6.1,
    moodTags: ["胡桃木桌面", "河面反光", "理性工作"],
    descriptionZh:
      "胡桃木桌面、河岸倒影與壁爐火光交織出的 85 BPM 穩態節拍，適合規劃、審稿與長時段理性推進。",
    descriptionEn:
      "An 85 BPM steady-focus groove built from walnut textures, riverside reflections, and fireplace warmth, tailored for planning, review, and deliberate long-form execution.",
    themeScenario:
      "胡桃木辦公桌前的深色空間面向寧靜河面，光線低亮而克制，節拍像長時間記帳一樣穩定推進，不搶注意力。",
    bpm: 85,
    durationSeconds: 273,
    media: {
      audioUrl: "/audio/walnut-river-focus.mp3",
      coverImageUrl: "/img/walnut-river-focus-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental executive focus electronic, 85 BPM exact tempo, warm walnut-toned groove, dark riverside ambience, fireplace texture, no vocals, long-form loop friendly, soft but stable pulse, elegant, premium, and smooth equal-power crossfade ready.",
      imagePrompt:
        "Photorealistic dark luxury office with a walnut desk, black leather chair, fireplace on the side, panoramic river view at night, subtle city reflections on the water, cinematic lighting, premium deep work atmosphere.",
      videoPrompt: "",
      generationPrompt:
        "情境：胡桃木桌面、深色室內、河面反光、壁爐暖光與理性長工時工作。BPM 固定 85，不可漂移；需維持穩定低壓節奏、long-loop、no vocals、smooth crossfade-ready 與安靜高級的專注感。",
    },
    createdAt: "2026-07-04T00:22:00.000Z",
  },
  {
    title: "Blackglass Skyline Study",
    slug: "blackglass-skyline-study",
    musicalKey: "C Minor",
    energyLevel: 6,
    moodTags: ["深色辦公室", "水岸夜景", "安靜沉浸"],
    descriptionZh:
      "水岸夜景與深色辦公室交疊出的 85 BPM 夜讀節奏，適合閱讀、校稿與低干擾的靜態思考。",
    descriptionEn:
      "An 85 BPM late-night study groove blending waterfront skyline reflections with a dark executive interior, built for reading, editing, and low-distraction reflection.",
    themeScenario:
      "深色辦公室面向水岸城市夜景，桌燈與壁爐只保留必要亮度，節拍在安靜空間中緩慢推進，適合長時間沉浸。",
    bpm: 85,
    durationSeconds: 252,
    media: {
      audioUrl: "/audio/blackglass-skyline-study.mp3",
      coverImageUrl: "/img/blackglass-skyline-study-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental late-night study electronic, 85 BPM exact tempo, dark waterfront ambience, smooth low-pressure groove, premium executive calm, no vocals, long-loop ready, subtle harmonic motion, elegant and equal-power crossfade friendly.",
      imagePrompt:
        "Photorealistic dark executive office at night with a black desk, leather seating, fireplace glow, panoramic windows overlooking waterfront city lights, minimal lamp lighting, cinematic premium study atmosphere.",
      videoPrompt: "",
      generationPrompt:
        "情境：深色辦公室、水岸夜景、桌燈、壁爐暖光與安靜夜讀工作。BPM 固定 85，不可漂移；需支援閱讀型沉浸、long-loop、no vocals、equal-power crossfade 與柔和穩定節拍。",
    },
    createdAt: "2026-07-04T00:24:00.000Z",
  },
  {
    title: "The Initiation",
    slug: "the-initiation",
    musicalKey: "A Minor",
    energyLevel: 5.8,
    moodTags: ["冷藍螢幕光", "碳纖桌墊", "沉浸啟動"],
    descriptionZh:
      "冷藍螢幕光、深色桌面與極度克制的空間光線構成的 125 BPM 進場心流曲，適合開工前切換、收束注意力與快速進入深度工作。",
    descriptionEn:
      "A 125 BPM flow-entry track shaped by cold screen light, dark desk textures, and rigorously controlled lighting, built for switching into deep work with immediate calm and precision.",
    themeScenario:
      "極簡豪宅裡的深色辦公桌只保留筆電螢幕冷光作為主光源，壁爐與夜景退到遠景，讓思緒在第一個循環就完成收束並沉進安靜心流。",
    bpm: 125,
    durationSeconds: 287,
    media: {
      audioUrl: "/audio/the-initiation.mp3",
      coverImageUrl: "/img/the-initiation-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental deep focus electronic, 125 BPM exact tempo, cold screen glow, dark minimalist mansion workspace, carbon fiber desk texture, tightly controlled pulse, no vocals, loop-friendly, smooth equal-power crossfade ready, premium and restrained, designed for entering flow with absolute calm.",
      imagePrompt:
        "A photorealistic, close-up perspective of a luxurious workspace in a minimalist mansion at night, designed for dark mode friendly aesthetics. A sleek dark wood desk features a single MacBook emitting a crisp, cold blue screen glow that illuminates a carbon fiber desk pad. Geometric shadows fall across matte metal accessories. In the blurred background, floor-to-ceiling glass windows reveal a distant night skyline and a modern, low-profile linear fireplace emitting a very subtle, moody ember glow. Absolute clarity, deep focus atmosphere, extremely controlled lighting, architectural photography, completely devoid of neon lights, 8k resolution, highly detailed.",
      videoPrompt:
        "Slow cinematic close-up of a dark luxury desk at night, crisp blue laptop glow washing across a carbon fiber desk pad, geometric shadow movement over matte metal accessories, distant skyline and restrained fireplace blur in the background, premium deep focus atmosphere, no neon.",
      generationPrompt:
        "情境：絕對冷靜、螢幕冷光、碳纖桌墊、遠景壁爐與夜景。BPM 固定 125，不可漂移；需支援進場沉浸、long-loop、no vocals、smooth crossfade 與極度克制的深夜行政專注感。",
    },
    themeProgramId: "uncategorized-lane",
    createdAt: "2026-07-04T13:37:24.000Z",
  },
  {
    title: "Deep Submersion",
    slug: "deep-submersion",
    musicalKey: "F Minor",
    energyLevel: 6.1,
    moodTags: ["玻璃反射", "清水模", "極簡運算"],
    descriptionZh:
      "玻璃反射、清水模與外部超跑倒影構成的 85 BPM 深潛專注循環，適合高密度推演、深夜運算與長時間不被打斷的理性工作。",
    descriptionEn:
      "An 85 BPM deep-focus loop built from glass reflections, polished concrete, and the shadow of latent power, designed for extended analytical work, overnight computation, and uninterrupted executive processing.",
    themeScenario:
      "凌晨三點的豪宅工作區被玻璃與深色混凝土包圍，螢幕冷光壓住所有情緒，只留下低調但持續推進的底層動能。",
    bpm: 85,
    durationSeconds: 406,
    media: {
      audioUrl: "/audio/deep-submersion.mp3",
      coverImageUrl: "/img/deep-submersion-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental minimal techno for deep focus, 85 BPM exact tempo, dark polished concrete atmosphere, glass reflections, authoritative low-end propulsion, no vocals, no flashy lead, no festival drop, loop-friendly, smooth equal-power crossfade ready, premium and severely restrained.",
      imagePrompt:
        "Photorealistic architectural interior photography of a dark, luxurious executive workspace at 3 AM. The composition is dominated by sleek glass partitions and dark polished concrete. A glowing laptop screen serves as the absolute focal point on a matte black desk. Through the expansive glass window, the limitless dark night skyline is visible, along with the faint, streamlined reflection of a matte black supercar parked outside. A dark walnut wood wall features a heavily tinted, moody glass fireplace with restrained flames. Authoritative steadiness, dark premium aesthetic, zero neon, moody but controlled, 8k, ultra-realistic.",
      videoPrompt:
        "Slow architectural camera drift through a dark executive workspace at 3 AM, sleek glass partitions, polished concrete reflections, laptop glow as the focal point, faint matte-black supercar reflection outside, restrained fireplace flames, premium controlled atmosphere, no neon.",
      generationPrompt:
        "情境：Minimal Techno、玻璃反射、清水模、超跑倒影與內斂動能。BPM 固定 85，不可漂移；需維持 no vocals、no flashy lead、long-loop、smooth crossfade 與極深沉的行政心流感。",
    },
    createdAt: "2026-07-04T13:37:50.000Z",
  },
  {
    title: "Strategic Warmth",
    slug: "strategic-warmth",
    musicalKey: "D Minor",
    energyLevel: 5.9,
    moodTags: ["木質火光", "權威沉穩", "長時推演"],
    descriptionZh:
      "木質牆面、壁爐暖光與深色辦公室平衡出的 85 BPM 權威型專注曲，適合長時間決策、審稿與需要心理支撐的高壓工作。",
    descriptionEn:
      "An 85 BPM executive-focus track balancing dark wood, restrained fireplace warmth, and calm architectural tension, built for long-form decision-making, review, and composed authority under pressure.",
    themeScenario:
      "晚間書房裡，筆電冷光與壁爐暖光維持微妙平衡，空間依舊深色克制，但多了一層讓決策更穩的底氣與餘裕。",
    bpm: 85,
    durationSeconds: 235,
    media: {
      audioUrl: "/audio/strategic-warmth.mp3",
      coverImageUrl: "/img/strategic-warmth-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental executive deep work electronic, 85 BPM exact tempo, dark ribbed wood and fireplace warmth, controlled low-pressure groove, premium authority, no vocals, no busy fills, loop-friendly, elegant and smooth equal-power crossfade ready, emotionally supportive but restrained.",
      imagePrompt:
        "A photorealistic, medium-wide shot of a high-end executive study immersed in a late-night deep work session. A sophisticated balance of dark ribbed wood paneling and carbon fiber elements. The primary light source is the sharp glow of a laptop screen on a premium desk, beautifully contrasted by the warm, controlled flames of a contemporary fireplace integrated into the wall. Expansive glass windows frame a muted, moody night skyline. The scene exudes isolated secrecy and restrained momentum, perfect for a dark mode interface, avoiding any bright or entertainment-style lighting, cinematic lighting, 8k, photorealism.",
      videoPrompt:
        "Slow cinematic medium-wide shot inside a dark executive study at night, laptop glow on a premium desk contrasted with controlled fireplace flames, muted skyline beyond expansive glass, ribbed wood textures, restrained premium movement, no bright entertainment lighting.",
      generationPrompt:
        "情境：木質調、壁爐火光、權威沉穩與高壓長工時決策。BPM 固定 85，不可漂移；需維持 no vocals、穩定低壓節奏、long-loop、smooth crossfade 與克制但有支撐感的夜間工作氛圍。",
    },
    createdAt: "2026-07-04T13:38:42.000Z",
  },
  {
    title: "Infinite Loop",
    slug: "infinite-loop",
    musicalKey: "E Minor",
    energyLevel: 5.6,
    moodTags: ["無邊界黑夜", "廣角空間", "長迴圈"],
    descriptionZh:
      "把工作區、夜景、跑車與壁爐整合成同一個黑夜空間的 85 BPM 長迴圈曲，適合長時沉浸、夜間規劃與幾乎無感的平滑連續播放。",
    descriptionEn:
      "An 85 BPM long-loop focus track that merges workspace, skyline, fireplace, and shadowed supercar into one seamless nocturnal field, built for expansive immersion and smooth continuous playback.",
    themeScenario:
      "廣角視野裡，桌面、玻璃外的城市與黑夜中的車身剪影被收進同一個靜默場域，節拍像沒有邊界的夜色一樣緩慢延伸。",
    bpm: 85,
    durationSeconds: 6,
    media: {
      audioUrl: "/audio/infinite-loop.mp3",
      coverImageUrl: "/img/infinite-loop-cover.png",
      backgroundVideoUrl: "",
    },
    prompts: {
      musicPrompt:
        "Instrumental cinematic deep focus electronic, 85 BPM exact tempo, expansive dark luxury workspace, geometric shadows, distant skyline silence, no vocals, no bright hooks, loop-friendly, smooth equal-power crossfade ready, intimate yet vast, designed for seamless long-form immersion.",
      imagePrompt:
        "A photorealistic, cinematic wide shot of an ultra-luxury minimalist workspace merging with the limitless night. Floor-to-ceiling glass windows look out onto a sleeping city skyline and the shadowy, aggressive silhouette of a streamlined supercar parked in the dark courtyard. Inside, a clean dark wood desk with a subtly glowing MacBook sits adjacent to a minimal, moody fireplace with low embers. The lighting is extremely controlled, emphasizing geometric shadows and premium matte metal textures. Dark mode friendly, expansive yet intimate, absolute silence, no neon, high-end editorial photography, 8k resolution.",
      videoPrompt:
        "Slow cinematic wide shot of an ultra-luxury minimalist workspace at night, subtle laptop glow, low ember fireplace, shadowed supercar silhouette outside floor-to-ceiling glass, geometric shadows across matte surfaces, expansive but intimate deep focus atmosphere, no neon.",
      generationPrompt:
        "情境：Cinematic Soundscape、無邊界黑夜、廣角空間、夜景與跑車剪影。BPM 固定 85，不可漂移；需支援 long-loop、smooth crossfade、no vocals、低干擾與無痕延伸的深夜沉浸感。",
    },
    createdAt: "2026-07-04T13:39:43.000Z",
  },
] as const;

const trackCollectionsSeed = [
  {
    id: "featured-obsidian-waters",
    label: "精選系列",
    title: "黑曜湖畔",
    summary: "冷靜穩定的深度專注組曲。",
    description: "適合整組播放，快速進入長時間專注。",
    heroMetric: "4 首 105 BPM 心流曲",
    bpmFocus: [105],
    trackIds: [
      "obsidian-lake-focus",
      "walnut-command-drift",
      "lakeside-ember-terrace",
      "midnight-library-ledger",
    ],
    tone: "fuchsia",
  },
  {
    id: "night-ledger-series",
    label: "深夜理帳",
    title: "深夜理帳",
    summary: "適合寫作、校對與整理。",
    description: "低干擾，適合夜間長時間工作。",
    heroMetric: "8 首夜間工作曲",
    bpmFocus: [85, 105],
    trackIds: [
      "skyline-ember-ledger",
      "harbor-afterglow-study",
      "walnut-command-drift",
      "midnight-library-ledger",
      "cityglass-night-ledger",
      "huangpu-afterhours-bridge",
      "walnut-river-focus",
      "blackglass-skyline-study",
    ],
    tone: "cyan",
  },
  {
    id: "architectural-calm",
    label: "空間沉浸",
    title: "空間靜域",
    summary: "安靜有包覆感的空間系曲目。",
    description: "讓空間更安靜，專注更穩。",
    heroMetric: "玻璃 x 石材 x 火光",
    bpmFocus: [85, 105],
    trackIds: [
      "skyline-ember-ledger",
      "harbor-afterglow-study",
      "obsidian-lake-focus",
      "lakeside-ember-terrace",
      "cityglass-night-ledger",
      "huangpu-afterhours-bridge",
      "walnut-river-focus",
      "blackglass-skyline-study",
    ],
    tone: "amber",
  },
] as const;

const trackBatchesSeed = [
  {
    id: "batch-2026-07-03-obsidian",
    label: "07.03 上架",
    title: "黑曜湖畔 105 BPM 上架",
    summary: "本輪上架的 4 首 105 BPM 深度專注曲目。",
    themeProgramId: "ceo-focus-lanes",
    publishedAt: "2026-07-03T12:08:00.000Z",
    trackIds: [
      "obsidian-lake-focus",
      "walnut-command-drift",
      "lakeside-ember-terrace",
      "midnight-library-ledger",
    ],
  },
  {
    id: "batch-2026-07-02-nightfall",
    label: "07.02 上架",
    title: "深夜理帳首波上架",
    summary: "首批 85 BPM 夜間專注曲目。",
    themeProgramId: "ceo-focus-lanes",
    publishedAt: "2026-07-02T22:52:00.000Z",
    trackIds: ["skyline-ember-ledger", "harbor-afterglow-study"],
  },
  {
    id: "batch-2026-07-04-riverfront",
    label: "07.04 上架",
    title: "河景夜讀 85 BPM 上架",
    summary: "本輪上架的 4 首 85 BPM 夜間專注曲目。",
    themeProgramId: "ceo-focus-lanes",
    publishedAt: "2026-07-04T00:24:00.000Z",
    trackIds: [
      "cityglass-night-ledger",
      "huangpu-afterhours-bridge",
      "walnut-river-focus",
      "blackglass-skyline-study",
    ],
  },
  {
    id: "batch-2026-07-04-mansion",
    label: "07.04 上架",
    title: "豪宅冷光 85 BPM 上架",
    summary: "本輪上架的 4 首深夜行政專注曲目。",
    themeProgramId: "ceo-focus-lanes",
    publishedAt: "2026-07-04T13:39:43.000Z",
    trackIds: ["the-initiation", "deep-submersion", "strategic-warmth", "infinite-loop"],
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
  transition: transitionProfiles[index] ?? createFallbackTransitionProfile(item),
  themeProgramId: item.themeProgramId ?? (item.bpm === 180 ? "slow-jog-180" : "ceo-focus-lanes"),
  collectionIds: trackCollectionsSeed
    .filter((collection) => (collection.trackIds as readonly string[]).includes(item.slug))
    .map((collection) => collection.id),
  batchId: trackBatchesSeed.find((batch) => (batch.trackIds as readonly string[]).includes(item.slug))?.id,
  featured: item.bpm === 105,
  createdAt: item.createdAt ?? `2026-07-0${index + 1}T21:00:00.000Z`,
}));

export const trackCollections: TrackCollection[] = trackCollectionsSeed.map((collection) => ({
  ...collection,
  trackIds: [...collection.trackIds],
  bpmFocus: [...collection.bpmFocus],
}));

export const trackBatches: TrackBatch[] = trackBatchesSeed.map((batch) => ({
  ...batch,
  trackIds: [...batch.trackIds],
}));

export const sessionPresets: SessionPreset[] = [
  {
    id: "preset-focus-60",
    label: "60 分鐘快進",
    title: "黑曜湖畔短程專注",
    summary: "60 分鐘進入專注。",
    description: "適合開工前暖身。",
    durationMinutes: 60,
    collectionId: "featured-obsidian-waters",
    trackIds: ["obsidian-lake-focus", "walnut-command-drift"],
  },
  {
    id: "preset-ledger-90",
    label: "90 分鐘夜間工作",
    title: "深夜理帳長段工作",
    summary: "90 分鐘夜間工作組。",
    description: "適合閱讀、編輯與整理。",
    durationMinutes: 90,
    collectionId: "night-ledger-series",
    trackIds: ["skyline-ember-ledger", "harbor-afterglow-study", "midnight-library-ledger"],
  },
  {
    id: "preset-architectural-75",
    label: "75 分鐘空間沉浸",
    title: "空間靜域工作場",
    summary: "讓工作節奏更穩。",
    description: "適合寫作與發想。",
    durationMinutes: 75,
    collectionId: "architectural-calm",
    trackIds: ["harbor-afterglow-study", "obsidian-lake-focus", "lakeside-ember-terrace"],
  },
];

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
    label: "專注心流",
    title: "深度專注心流",
    bpmDisplay: "85 / 105 / 120 BPM",
    summary:
      "穩定推進的深度專注節奏，適合決策、深度工作與長時間專注。",
    audience: "深度工作、策略規劃、長時間沉浸專注",
    positioning:
      "以低干擾、高質感、長時段沉浸為核心，先用少量抽象母題建立 CEO 場景，再依 BPM 車道建立專注歌單。",
    operatingPrinciples: [
      "共用骨架固定 long-loop、no vocals、equal-power crossfade、LUFS 正規化與 dark premium 美學，不讓品質規格在主題切換時漂移。",
      "BPM 只能走 85 / 105 / 120 三條車道，85 專責慢速沉浸，其餘車道聚焦高密度思考、決策與 coding。",
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
        detail: "只允許 85 / 105 / 120，85 負責慢速沉浸，其餘車道聚焦高密度思考、決策與 coding。",
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
        template: `你是一位高端沉浸式音樂企劃師。

請根據我提供的少量線索，輸出一份「深度專注心流（CEO Deep Focus）」主題 brief。

必須輸出：
1. themeScenario
2. 核心情緒 3-5 個
3. 使用場景
4. 建議 BPM（只能從 85 / 105 / 120 擇一）
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
          "系統會自動沿用前置設定的 Brief、音樂 Prompt、圖片 Prompt；你只需補上外部資源與必要欄位。",
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
        detail: "必須落在既定四條車道，且 85 BPM 只用於慢速沉浸，其餘車道聚焦高密度思考、決策與 coding。",
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
    label: "慢跑步頻",
    title: "180 慢跑節奏",
    bpmDisplay: "180 BPM",
    summary:
      "鎖定步頻的慢跑節奏，適合夜跑、跑步機與耐力訓練。",
    audience: "慢跑、跑步機、夜跑暖身、低壓耐力訓練",
    positioning:
      "鎖定 180 BPM，對齊跑步步頻與呼吸節奏，作為維持長距離 cadence 的實用工具。",
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
          "系統會自動沿用前置設定的跑步 Brief、音樂 Prompt、圖片 Prompt；你只需補上外部資源與必要欄位。",
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
  {
    id: "beach-bar-dj",
    label: "海灘酒吧",
    title: "海灘露天酒吧",
    bpmDisplay: "115 / 120 BPM",
    summary:
      "適合戶外派對與輕鬆社交。",
    audience: "海灘酒吧、露天派對、黃昏酒精社交、開放式 lounge 與微舞池情境",
    positioning:
      "不是 festival 主舞台，也不是純 chill lounge，而是 open-air beach bar DJ set：要有律動、有空氣、有 sunset glamour，同時仍保持可長時間播放與平順接歌的商業型場景音樂。",
    operatingPrinciples: [
      "BPM 只走 115 / 120 兩條車道，維持可 mix 的舞池感與 beach lounge 之間的商業平衡。",
      "聲音核心是 warm house groove、nu disco sheen、organic percussion、balearic beach texture，禁止過重 drop 或過硬工業感。",
      "視覺與文案必須同時成立海風、沙灘、琥珀日落、露天酒吧吧檯與 DJ booth 的空間敘事。",
    ],
    layoutNotes: [
      "前台視覺可走 sunset amber、teal ocean、wet wood deck、outdoor string lights，而不是 CEO 書房語彙。",
      "卡片資訊要優先呈現 sunset set、open-air groove、cocktail hour、DJ energy 等使用情境。",
      "後台 workflow 需保留對應的 prompt 模板，方便未來擴充 beach bar 系列內容。",
    ],
    workflow: [
      {
        id: "Beach 01",
        title: "海灘場景母題",
        detail: "輸入海風、木質露台、沙灘酒吧、金色日落、DJ booth、雞尾酒與人群溫度等抽象詞，生成完整夏夜場景。",
        deliverable: "得到可直接進入音樂與視覺生成的 beach bar brief，含時間感、情緒、BPM 與接歌氛圍。",
      },
      {
        id: "Beach 02",
        title: "DJ Groove 決策",
        detail: "只允許 115 / 120 BPM，讓內容維持可持續 mix 的戶外商業節奏，不走 festival 極端能量。",
        deliverable: "鎖定單一車道與 energy level，讓每首歌能融入同一組 open-air DJ set。",
      },
      {
        id: "Beach 03",
        title: "海風視覺與音樂生成",
        detail: "同步生成可商用的 beach bar DJ 音樂 prompt 與 sunset cover 視覺 prompt。",
        deliverable: "取得可直接丟進 AI 工具的音樂、封面與背景視覺素材提示詞。",
      },
      {
        id: "Beach 04",
        title: "上架與 Session 包裝",
        detail: "整理 metadata、transition 與系列包裝，把單首整成可直接啟動的 sunset DJ session。",
        deliverable: "完成 Track JSON、collection 語意與可前台呈現的 session 包裝文案。",
      },
    ],
    promptSeed:
      "open-air beach bar DJ, sunset amber sky, ocean breeze, teak deck, cocktail hour, warm house groove, balearic rhythm, outdoor string lights",
    promptModules: [
      {
        id: "Module 01",
        title: "海灘酒吧 Brief",
        purpose: "把少量夏夜意象整理成可執行的 open-air beach bar DJ 生產 brief。",
        autoAdvanceToNext: true,
        template: `你是一位海灘酒吧與商業場景音樂企劃師。

請根據我提供的少量線索，輸出一份 Beach Bar DJ 主題 brief。

必須輸出：
1. themeScenario
2. 核心情緒 3-5 個
3. 使用場景
4. 建議 BPM（只能從 115 / 120 擇一）
5. 建議 energy level（1-10）
6. 視覺關鍵字
7. 音樂風格關鍵字
8. 前後接歌氛圍描述

固定規則：
- 走 sunset glamour、open-air groove、commercial DJ set
- 不要反問，直接補足缺漏
- 內容需支援 long-loop 與平順 crossfade
- 禁止寫成大型 festival EDM 主舞台

輸入線索：
【貼上海風、木質露台、日落、酒吧、DJ booth、微醺人群】`,
      },
      {
        id: "Module 02",
        title: "Beach DJ 音樂 Prompt",
        purpose: "把 brief 轉為可直接生成的英文 open-air DJ prompt。",
        upstreamModuleIds: ["Module 01"],
        autoAdvanceToNext: true,
        quickLinks: [
          { label: "打開 Copilot", url: "https://copilot.microsoft.com/" },
          { label: "打開 Suno", url: "https://suno.com/create" },
        ],
        outputSlots: 2,
        outputSlotLabels: ["候選 Prompt 01", "候選 Prompt 02"],
        template: `You are a professional AI music prompt designer for open-air beach bar DJ sessions.

Generate 2 English prompts for instrumental beach bar DJ tracks.

Requirements:
- commercial beach bar groove
- balearic house / warm nu disco / organic sunset rhythm
- exact BPM same as the brief
- open-air atmosphere, ocean breeze feeling
- loop-friendly
- smooth crossfade ready
- no vocals

Negative constraints:
- no festival drop
- no aggressive big-room EDM
- no dark warehouse techno
- no chaotic percussion switch
- no vocal chops

Brief:
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 03",
        title: "Beach 視覺 Prompt",
        purpose: "建立海灘露天酒吧與 DJ booth 的系列視覺提示詞。",
        upstreamModuleIds: ["Module 01", "Module 02"],
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        template: `你是一位高端商業場景視覺 prompt 設計師。

目前這一輪流程會產出 4 首歌曲：
- Module 02 的候選 Prompt 01 會生成 2 首歌
- Module 02 的候選 Prompt 02 也會生成 2 首歌

請根據 Beach Bar DJ brief 與 2 組音樂 prompt 產出：
1. Song 01 封面圖英文 prompt
2. Song 02 封面圖英文 prompt
3. Song 03 封面圖英文 prompt
4. Song 04 封面圖英文 prompt

要求：
- photorealistic
- beach bar, sunset sky, ocean horizon, wood deck, string lights
- stylish open-air DJ booth
- warm amber / teal palette
- 每首歌都要是獨立 prompt，不可合併成一次生成多張
- 請明確標示 Song 01 / Song 02 / Song 03 / Song 04

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "Beach 上架 JSON",
        purpose: "把 beach bar DJ 生成結果整理成可直接上站的 Track 資產。",
        upstreamModuleIds: ["Module 01", "Module 02", "Module 03"],
        inputMode: "low_input_auto_context",
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        supplementalLabel: "少量補充資料",
        supplementalPlaceholder:
          "只補必要外部資訊，例如 audioUrl、coverImageUrl、durationSeconds，或你想指定的 title / slug。",
        autoAssembleNote:
          "這一步會自動沿用前面已儲存的 Beach Brief、音樂 Prompt、圖片 Prompt；你只補外部資源或少量指定欄位即可。",
        autoAssembleInstructions: [
          "請先檢查資料夾內同名歌曲是否其實是不同歌曲，不能只因檔名一樣就視為重複檔。",
          "若同名檔是不同歌曲，請為每一首重新命名，確保 title 與 slug 全部唯一。",
          "若本輪有 2 組音樂 prompt，預設要整理為 4 首歌的命名與上架資料。",
          "每首歌必須對應獨立封面 prompt，不可混用。",
        ],
        template: `你是一位 TypeScript 音樂資料整理助手。

請優先使用我上游已提供的 Beach Brief、音樂 prompt、封面 prompt，自動補完整體 Track JSON。

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
- BPM 只能是 115 或 120
- 若本輪素材實際包含 4 首歌，就輸出 4 份 Track JSON 陣列
- 欄位不可省略
- 若我有補充外部資源欄位，請直接覆蓋對應欄位

少量補充資料（可為空）：
【只貼外部資源或你想覆寫的欄位】`,
      },
    ],
    acceptanceChecklist: [
      {
        id: "Check 01",
        title: "海灘酒吧辨識成立",
        detail: "聽感應偏 sunset beach bar、戶外 DJ set 與商業 lounge groove，而不是大型 EDM 主舞台。",
      },
      {
        id: "Check 02",
        title: "車道控制正確",
        detail: "BPM 只能落在 115 / 120，確保整組內容可混音且不失去戶外派對的推進感。",
      },
      {
        id: "Check 03",
        title: "可長時播放",
        detail: "段落密度與 energy 必須支援 cocktail hour 到 night groove 的長時間連播。",
      },
      {
        id: "Check 04",
        title: "視覺與場景一致",
        detail: "封面與文案必須呈現海風、木質露台、日落燈串與 open-air DJ booth 的空間語彙。",
      },
    ],
  },
  {
    id: "city-pop-cruise",
    label: "城市夜色",
    title: "城市夜色 City Pop",
    bpmDisplay: "100 / 105 BPM",
    summary:
      "適合夜駕、散步與輕鬆工作。",
    audience: "夜間開車、都會微醺、晚間散步、城市夜讀與帶復古感的輕鬆工作場景",
    positioning:
      "不是純懷舊音樂收藏，也不是 Lo-fi 背景聲，而是兼具夜景敘事與商業播放性的 modern city pop line：要有暖色 synth、律動 bass、霓虹反光與都會浪漫感。",
    operatingPrinciples: [
      "BPM 只走 100 / 105，確保 city pop 能維持柔和律動與可長時間播放的夜色推進感。",
      "聲音需結合 glossy electric piano、warm synth pad、clean bass groove、soft disco drum，禁止過硬 techno 或過度爵士即興。",
      "視覺與文案必須同時成立海灣高架、霓虹反光、車窗夜景與昭和感現代化這組世界觀。",
    ],
    layoutNotes: [
      "前台視覺可走 navy / magenta / amber neon palette，帶城市濕地反光與夏夜巡航感。",
      "卡片資訊應優先呈現 drive、night breeze、retro urban glow、city lights 等使用語彙。",
      "後台 workflow 保留 prompt 模板與上架結構，方便後續規律擴充 city pop 系列。",
    ],
    workflow: [
      {
        id: "City 01",
        title: "夜色場景母題",
        detail: "輸入霓虹街景、海灣高架、車窗倒影、夏夜海風、便利商店燈光等抽象詞，生成完整 city pop 場景。",
        deliverable: "得到可直接進入音樂與視覺生成的 city pop brief，含情緒、時間感、BPM 與接歌氛圍。",
      },
      {
        id: "City 02",
        title: "Groove 車道決策",
        detail: "只允許 100 / 105 BPM，讓夜間巡航感與商業播放性保持在同一個舒服區間。",
        deliverable: "鎖定單一車道與 energy level，避免風格太軟或過度舞曲化。",
      },
      {
        id: "City 03",
        title: "City Pop 視覺與音樂生成",
        detail: "同步生成 modern city pop 音樂 prompt 與帶霓虹夜景的視覺 prompt。",
        deliverable: "取得可直接丟進 AI 工具的音樂、封面與背景視覺提示詞。",
      },
      {
        id: "City 04",
        title: "上架與夜色包裝",
        detail: "整理 metadata、transition 與 collection 語意，把單首整成可直接啟動的 night drive session。",
        deliverable: "完成 Track JSON、collection 語意與前台可展示的 session 包裝文案。",
      },
    ],
    promptSeed:
      "modern city pop, neon bay highway, night drive, coastal city lights, glossy electric piano, clean bass groove, summer breeze, retro urban glamour",
    promptModules: [
      {
        id: "Module 01",
        title: "City Pop Brief",
        purpose: "把少量夜色與城市意象整理成可執行的 city pop 生產 brief。",
        autoAdvanceToNext: true,
        template: `你是一位城市夜色與 city pop 音樂企劃師。

請根據我提供的少量線索，輸出一份 City Pop 主題 brief。

必須輸出：
1. themeScenario
2. 核心情緒 3-5 個
3. 使用場景
4. 建議 BPM（只能從 100 / 105 擇一）
5. 建議 energy level（1-10）
6. 視覺關鍵字
7. 音樂風格關鍵字
8. 前後接歌氛圍描述

固定規則：
- 走 urban romance、night drive、retro-modern glow
- 不要反問，直接補足缺漏
- 內容需支援 long-loop 與平順 crossfade
- 禁止寫成純 lo-fi、純 jazz fusion 或過度誇張的 disco 派對

輸入線索：
【貼上霓虹街景、海灣高架、車窗倒影、夏夜海風、都會浪漫】`,
      },
      {
        id: "Module 02",
        title: "City Pop 音樂 Prompt",
        purpose: "把 brief 轉為可直接生成的英文 modern city pop prompt。",
        upstreamModuleIds: ["Module 01"],
        autoAdvanceToNext: true,
        quickLinks: [
          { label: "打開 Copilot", url: "https://copilot.microsoft.com/" },
          { label: "打開 Suno", url: "https://suno.com/create" },
        ],
        outputSlots: 2,
        outputSlotLabels: ["候選 Prompt 01", "候選 Prompt 02"],
        template: `You are a professional AI music prompt designer for modern city pop playlists.

Generate 2 English prompts for instrumental city pop inspired tracks.

Requirements:
- modern city pop groove
- glossy electric piano, warm synths, clean bass groove
- exact BPM same as the brief
- night-drive atmosphere
- loop-friendly
- smooth crossfade ready
- no vocals

Negative constraints:
- no aggressive EDM drop
- no hard techno edge
- no chaotic jazz improvisation
- no vocal chops
- no lo-fi tape degradation as the main identity

Brief:
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 03",
        title: "City Pop 視覺 Prompt",
        purpose: "建立都會夜色與 city pop 世界觀的系列視覺提示詞。",
        upstreamModuleIds: ["Module 01", "Module 02"],
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        template: `你是一位高端商業場景視覺 prompt 設計師。

目前這一輪流程會產出 4 首歌曲：
- Module 02 的候選 Prompt 01 會生成 2 首歌
- Module 02 的候選 Prompt 02 也會生成 2 首歌

請根據 City Pop brief 與 2 組音樂 prompt 產出：
1. Song 01 封面圖英文 prompt
2. Song 02 封面圖英文 prompt
3. Song 03 封面圖英文 prompt
4. Song 04 封面圖英文 prompt

要求：
- photorealistic
- neon city lights, bay highway, summer night breeze, reflective windows
- modern-retro city pop tone
- 每首歌都要是獨立 prompt，不可合併成一次生成多張
- 請明確標示 Song 01 / Song 02 / Song 03 / Song 04

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "City Pop 上架 JSON",
        purpose: "把 city pop 生成結果整理成可直接上站的 Track 資產。",
        upstreamModuleIds: ["Module 01", "Module 02", "Module 03"],
        inputMode: "low_input_auto_context",
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        supplementalLabel: "少量補充資料",
        supplementalPlaceholder:
          "只補必要外部資訊，例如 audioUrl、coverImageUrl、durationSeconds，或你想指定的 title / slug。",
        autoAssembleNote:
          "這一步會自動沿用前面已儲存的 City Pop Brief、音樂 Prompt、圖片 Prompt；你只補外部資源或少量指定欄位即可。",
        autoAssembleInstructions: [
          "請先檢查資料夾內同名歌曲是否其實是不同歌曲，不能只因檔名一樣就視為重複檔。",
          "若同名檔是不同歌曲，請為每一首重新命名，確保 title 與 slug 全部唯一。",
          "若本輪有 2 組音樂 prompt，預設要整理為 4 首歌的命名與上架資料。",
          "每首歌必須對應獨立封面 prompt，不可混用。",
        ],
        template: `你是一位 TypeScript 音樂資料整理助手。

請優先使用我上游已提供的 City Pop Brief、音樂 prompt、封面 prompt，自動補完整體 Track JSON。

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
- BPM 只能是 100 或 105
- 若本輪素材實際包含 4 首歌，就輸出 4 份 Track JSON 陣列
- 欄位不可省略

少量補充資料（可為空）：
【只貼外部資源或你想覆寫的欄位】`,
      },
    ],
    acceptanceChecklist: [
      {
        id: "Check 01",
        title: "城市夜色辨識成立",
        detail: "聽感應偏 modern city pop、night drive 與都會浪漫感，而不是 lo-fi study 或 disco 舞池主場。",
      },
      {
        id: "Check 02",
        title: "車道控制正確",
        detail: "BPM 只能落在 100 / 105，確保 groove 輕盈、耐聽且保有可長時播放的城市節奏。",
      },
      {
        id: "Check 03",
        title: "可長時播放",
        detail: "段落密度、合成器光澤與節奏推進需支援夜讀、夜駕與晚間微工作場景。",
      },
      {
        id: "Check 04",
        title: "視覺與場景一致",
        detail: "封面與文案必須呈現霓虹街景、車窗反光、海灣高架與夏夜都會浪漫語彙。",
      },
    ],
  },
  {
    id: "exhibition-sonic-space",
    label: "展場聲景",
    title: "沉浸式展場聲景",
    bpmDisplay: "Ambient / 90 / 95 BPM",
    summary:
      "適合展覽、快閃與 showroom。",
    audience: "藝術展覽、品牌快閃、策展空間、設計展間、showroom 與沉浸式展示場域",
    positioning:
      "不是飯店大廳 BGM，也不是純 ambient 噪景，而是帶有策展感與商業展示適配性的展場音樂線：要有空間感、質地感與流動感，同時不能搶走作品本身的注意力。",
    operatingPrinciples: [
      "內容可走 Ambient 聲場方向，或 90 / 95 兩條弱脈衝車道，讓觀展步調與空間流動感維持在舒適、穩定且不急躁的區間。",
      "聲音核心需結合 ambient electronica、minimal pulse、gallery-grade texture、soft percussive motion，禁止強烈主旋律或情緒過度煽動。",
      "視覺與文案必須同時成立展牆、光束、留白動線、霧面材質、投影裝置與人流停留這組展場世界觀。",
    ],
    layoutNotes: [
      "前台視覺可走 chalk white、graphite、soft steel、museum light 與霧面空間材質，不要混入夜店或辦公室語彙。",
      "卡片資訊應優先呈現 gallery flow、slow circulation、installation mood、spatial texture 等展場情境。",
      "後台 workflow 需保留對應的 prompt 模板，方便後續延伸藝術展、品牌展與沉浸式展間等變體內容。",
    ],
    workflow: [
      {
        id: "Expo 01",
        title: "展場情境母題",
        detail: "輸入展牆、光束、留白空間、材質細節、觀展動線、裝置作品與安靜人流等抽象詞，生成完整展場 brief。",
        deliverable: "得到可直接進入音樂與視覺生成的展場音樂 brief，含空間感、節奏感、BPM 與接歌氛圍。",
      },
      {
        id: "Expo 02",
        title: "動線節奏決策",
        detail: "可選 Ambient 聲場方向，或 90 / 95 BPM 的弱脈衝版本，讓觀展停留與步行節奏穩定，不把空間推向 lounge 或舞池方向。",
        deliverable: "鎖定 Ambient 聲場方向，或鎖定 90 / 95 的單一弱脈衝車道與 energy level，確保整組內容能長時間支撐展場動線。",
      },
      {
        id: "Expo 03",
        title: "展場視覺與音樂生成",
        detail: "同步生成 exhibition soundscape 音樂 prompt 與帶展間材質感的封面視覺 prompt。",
        deliverable: "取得可直接丟進 AI 工具的音樂、封面與背景視覺提示詞。",
      },
      {
        id: "Expo 04",
        title: "上架與策展包裝",
        detail: "整理 metadata、transition 與 collection 語意，把單首整成可直接啟動的 exhibition session。",
        deliverable: "完成 Track JSON、collection 語意與前台可展示的展場包裝文案。",
      },
    ],
    promptSeed:
      "exhibition background music, gallery ambient pulse, museum-grade spatial texture, minimal electronica, soft installation lighting, matte surfaces, slow circulation, premium art space",
    promptModules: [
      {
        id: "Module 01",
        title: "展場 Brief",
        purpose: "把少量策展與空間意象整理成可執行的沉浸式展場聲景生產 brief。",
        autoAdvanceToNext: true,
        template: `你是一位策展展場與商業空間音樂企劃師。

請根據我提供的少量線索，輸出一份「沉浸式展場聲景」主題 brief。

必須輸出：
1. themeScenario
2. 核心情緒 3-5 個
3. 使用場景
4. 建議 BPM（只能從 Ambient / 90 / 95 擇一）
5. 建議 energy level（1-10）
6. 視覺關鍵字
7. 音樂風格關鍵字
8. 前後接歌氛圍描述

固定規則：
- 走 premium exhibition、gallery flow、spatial restraint
- 不要反問，直接補足缺漏
- 內容需支援 long-loop 與平順 crossfade
- 若選 Ambient，聲音可接近無拍或僅保留極弱脈衝；若要進站上架，metadata 仍需對應到 90 或 95 的弱脈衝設定
- 禁止寫成咖啡廳 BGM、飯店大廳鋼琴或夜店 lounge

輸入線索：
【貼上展牆、光束、留白空間、裝置作品、霧面材質、安靜人流】`,
      },
      {
        id: "Module 02",
        title: "展場音樂 Prompt",
        purpose: "把 brief 轉為可直接生成的英文 exhibition soundscape prompt。",
        upstreamModuleIds: ["Module 01"],
        autoAdvanceToNext: true,
        quickLinks: [
          { label: "打開 Copilot", url: "https://copilot.microsoft.com/" },
          { label: "打開 Suno", url: "https://suno.com/create" },
        ],
        outputSlots: 2,
        outputSlotLabels: ["候選 Prompt 01", "候選 Prompt 02"],
        template: `You are a professional AI music prompt designer for exhibition and gallery environments.

Generate 2 English prompts for instrumental exhibition background tracks.

Requirements:
- premium exhibition soundscape
- minimal electronica / spatial ambient pulse / beatless ambient option / subtle gallery rhythm
- if the brief chooses Ambient, keep it beatless or pulse-light; otherwise keep the BPM exactly the same as the brief
- loop-friendly
- smooth crossfade ready
- low-distraction
- no vocals

Negative constraints:
- no festival EDM
- no cinematic trailer climax
- no obvious pop hook
- no aggressive drums
- no vocal chops

Brief:
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 03",
        title: "展場視覺 Prompt",
        purpose: "建立展間空間感與策展語彙的系列視覺提示詞。",
        upstreamModuleIds: ["Module 01", "Module 02"],
        autoAdvanceToNext: true,
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        template: `你是一位高端商業場景視覺 prompt 設計師。

目前這一輪流程會產出 4 首歌曲：
- Module 02 的候選 Prompt 01 會生成 2 首歌
- Module 02 的候選 Prompt 02 也會生成 2 首歌

請根據 沉浸式展場聲景 brief 與 2 組音樂 prompt 產出：
1. Song 01 封面圖英文 prompt
2. Song 02 封面圖英文 prompt
3. Song 03 封面圖英文 prompt
4. Song 04 封面圖英文 prompt

要求：
- photorealistic
- exhibition wall, installation lighting, matte surfaces, gallery corridor, premium spatial mood
- 每首歌都要是獨立 prompt，不可合併成一次生成多張
- 請明確標示 Song 01 / Song 02 / Song 03 / Song 04

Brief：
【貼上 Module 01 結果】`,
      },
      {
        id: "Module 04",
        title: "展場上架 JSON",
        purpose: "把沉浸式展場聲景生成結果整理成可直接上站的 Track 資產。",
        upstreamModuleIds: ["Module 01", "Module 02", "Module 03"],
        inputMode: "low_input_auto_context",
        quickLinks: [{ label: "打開 Copilot", url: "https://copilot.microsoft.com/" }],
        supplementalLabel: "少量補充資料",
        supplementalPlaceholder:
          "只補必要外部資訊，例如 audioUrl、coverImageUrl、durationSeconds，或你想指定的 title / slug。",
        autoAssembleNote:
          "這一步會自動沿用前面已儲存的展場 Brief、音樂 Prompt、圖片 Prompt；你只補外部資源或少量指定欄位即可。",
        autoAssembleInstructions: [
          "請先檢查資料夾內同名歌曲是否其實是不同歌曲，不能只因檔名一樣就視為重複檔。",
          "若同名檔是不同歌曲，請為每一首重新命名，確保 title 與 slug 全部唯一。",
          "若本輪有 2 組音樂 prompt，預設要整理為 4 首歌的命名與上架資料。",
          "每首歌必須對應獨立封面 prompt，不可混用。",
        ],
        template: `你是一位 TypeScript 音樂資料整理助手。

請優先使用我上游已提供的沉浸式展場聲景 Brief、音樂 prompt、封面 prompt，自動補完整體 Track JSON。

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
- 若 Brief 為 Ambient，請仍以 90 或 95 的極弱脈衝填入 bpm 與 transition metadata，且在文案中明確說明它以 ambient soundscape 為主
- BPM 欄位只能是 90 或 95
- 若本輪素材實際包含 4 首歌，就輸出 4 份 Track JSON 陣列
- 欄位不可省略

少量補充資料（可為空）：
【只貼外部資源或你想覆寫的欄位】`,
      },
    ],
    acceptanceChecklist: [
      {
        id: "Check 01",
        title: "展場辨識成立",
        detail: "聽感應偏策展展場、沉浸式展示與高端空間氛圍，而不是飯店大廳、咖啡廳或 lounge 酒吧。",
      },
      {
        id: "Check 02",
        title: "車道控制正確",
        detail: "若走 Ambient，需保持近乎無拍或極弱脈衝；若走節拍版，BPM 只能落在 90 / 95，確保觀展步調穩定、耐聽且不搶作品注意力。",
      },
      {
        id: "Check 03",
        title: "可長時播放",
        detail: "段落密度、空間留白與微脈衝需支援整段展期中的長時間循環播放。",
      },
      {
        id: "Check 04",
        title: "視覺與場景一致",
        detail: "封面與文案必須呈現展牆、裝置燈光、霧面材質、動線留白與高級展間語彙。",
      },
    ],
  },
];
