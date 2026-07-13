import { classifyLane, getBpmCompatibility, LANE_FROM_THEME_PROGRAM } from "@/lib/bpm-lanes";
import type { BpmCompatibility } from "@/lib/bpm-lanes";
import type { MixEvent, MixSession, ThemeProgram, Track } from "@/types/music";

export type PublicRouteEntry = {
  program: ThemeProgram;
  programTracks: Track[];
  configuredBpms: number[];
  subroutes: Array<{
    bpm: number;
    tracks: Track[];
    totalMinutes: number;
  }>;
  totalMinutes: number;
};

/**
 * @deprecated Use `classifyLane()` instead. The new Studio View classifies
 * tracks purely by BPM via `LANE_TO_THEME_PROGRAM`; bpmDisplay string parsing
 * is no longer authoritative. Kept exported for backward compatibility only.
 */
export function extractBpms(bpmDisplay: string) {
  return Array.from(new Set((bpmDisplay.match(/\d+/g) ?? []).map(Number))).sort((left, right) => left - right);
}

function buildUncategorizedProgram(bpms: readonly number[]): ThemeProgram {
  return {
    id: "uncategorized-lane",
    label: "未分類",
    title: "未分類",
    bpmDisplay: bpms.length > 0 ? `${bpms.join(" / ")} BPM` : "待確認 BPM",
    summary: "這裡放暫時不落在既有主題車道、等待人工覆核的曲目。",
    audience: "管理與人工覆核",
    positioning: "先正常可見，再由人工決定是否歸入正式主題。",
    operatingPrinciples: [],
    layoutNotes: [],
    workflow: [],
    promptSeed: "",
    promptModules: [],
    acceptanceChecklist: [],
  };
}

export function buildPublicRouteEntries(programs: readonly ThemeProgram[], trackList: readonly Track[]): PublicRouteEntry[] {
  const programById = new Map(programs.map((program) => [program.id, program] as const));

  const trackByLane = new Map<number, Track[]>();
  const uncategorizedTracks: Track[] = [];

  for (const track of trackList) {
    const lane = classifyLane(track.bpm);
    if (lane === null) {
      uncategorizedTracks.push(track);
      continue;
    }
    const bucket = trackByLane.get(lane) ?? [];
    bucket.push(track);
    trackByLane.set(lane, bucket);
  }

  const routeEntries: PublicRouteEntry[] = [];
  for (const program of programs) {
    if (program.id === "uncategorized-lane") continue;
    const pivot = LANE_FROM_THEME_PROGRAM[program.id];
    if (pivot === undefined) continue;
    const programTracks = trackByLane.get(pivot) ?? [];
    const subroutes = [
      {
        bpm: pivot,
        tracks: programTracks,
        totalMinutes: Math.max(1, Math.round(programTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
      },
    ];
    routeEntries.push({
      program,
      programTracks,
      configuredBpms: [pivot],
      subroutes,
      totalMinutes: Math.max(1, Math.round(programTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
    });
  }

  if (uncategorizedTracks.length === 0) {
    return routeEntries;
  }

  const outsideLaneBpms = Array.from(
    new Set(uncategorizedTracks.map((track) => track.bpm)),
  ).sort((left, right) => left - right);

  void programById;

  return [
    ...routeEntries,
    {
      program: buildUncategorizedProgram(outsideLaneBpms),
      programTracks: uncategorizedTracks,
      configuredBpms: [],
      subroutes: [
        {
          bpm: 0,
          tracks: uncategorizedTracks,
          totalMinutes: Math.max(1, Math.round(uncategorizedTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
        },
      ],
      totalMinutes: Math.max(1, Math.round(uncategorizedTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
    },
  ];
}

export function buildBpmCompatibilityMap(
  trackList: readonly Track[],
  currentTrack: Track | null,
) {
  const entries = trackList.map((track) => {
    if (!currentTrack || currentTrack.id === track.id) {
      return [track.id, null] as const;
    }

    return [track.id, getBpmCompatibility(currentTrack.bpm, track.bpm)] as const;
  });

  return new Map<string, BpmCompatibility | null>(entries);
}

export function buildMixInsights(
  trackList: readonly Track[],
  sessions: readonly MixSession[],
  events: readonly MixEvent[],
) {
  const publicSessions = sessions.filter((session) => session.listenerMode === "public_mix");
  const savedMixCount = events.filter((event) => event.type === "save_mix").length;
  const avgCompletionRate = publicSessions.length
    ? Math.round((publicSessions.reduce((sum, session) => sum + session.completionRate, 0) / publicSessions.length) * 100)
    : 0;
  const trackMap = new Map(trackList.map((track) => [track.id, track]));
  const transitionCounter = new Map<string, { label: string; count: number }>();

  for (const event of events) {
    if (event.type !== "transition_complete" || !event.fromTrackId || !event.toTrackId) {
      continue;
    }

    const fromTrack = trackMap.get(event.fromTrackId);
    const toTrack = trackMap.get(event.toTrackId);
    const key = `${event.fromTrackId}:${event.toTrackId}`;
    const current = transitionCounter.get(key);
    const label = fromTrack && toTrack ? `${fromTrack.title} -> ${toTrack.title}` : key;

    transitionCounter.set(key, {
      label,
      count: (current?.count ?? 0) + 1,
    });
  }

  const topTransition =
    Array.from(transitionCounter.values()).sort((left, right) => right.count - left.count)[0] ?? null;

  return {
    publishedCount: trackList.filter((track) => track.status === "published").length,
    publicSessionCount: publicSessions.length,
    savedMixCount,
    avgCompletionRate,
    topTransitionLabel: topTransition?.label ?? "尚無資料",
    topTransitionCount: topTransition?.count ?? 0,
  };
}
