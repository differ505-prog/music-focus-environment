import { getBpmCompatibility } from "@/lib/bpm-lanes";
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
  const configuredBpmMap = new Map(programs.map((program) => [program.id, extractBpms(program.bpmDisplay)] as const));

  const routeEntries = programs.map((program) => {
    const configuredBpms = configuredBpmMap.get(program.id) ?? [];
    const programTracks = trackList.filter(
      (track) => track.themeProgramId === program.id && configuredBpms.includes(track.bpm),
    );
    const subroutes = configuredBpms.map((bpm) => {
      const bpmTracks = programTracks.filter((track) => track.bpm === bpm);

      return {
        bpm,
        tracks: bpmTracks,
        totalMinutes: Math.max(1, Math.round(bpmTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
      };
    });

    return {
      program,
      programTracks,
      configuredBpms,
      subroutes,
      totalMinutes: Math.max(1, Math.round(programTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
    };
  });

  const uncategorizedTracks = trackList.filter((track) => {
    const configuredBpms = configuredBpmMap.get(track.themeProgramId ?? "");

    if (!configuredBpms) {
      return true;
    }

    return !configuredBpms.includes(track.bpm);
  });

  if (uncategorizedTracks.length === 0) {
    return routeEntries;
  }

  const uncategorizedBpms = Array.from(new Set(uncategorizedTracks.map((track) => track.bpm))).sort((left, right) => left - right);

  return [
    ...routeEntries,
    {
      program: buildUncategorizedProgram(uncategorizedBpms),
      programTracks: uncategorizedTracks,
      configuredBpms: uncategorizedBpms,
      subroutes: uncategorizedBpms.map((bpm) => {
        const bpmTracks = uncategorizedTracks.filter((track) => track.bpm === bpm);

        return {
          bpm,
          tracks: bpmTracks,
          totalMinutes: Math.max(1, Math.round(bpmTracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60)),
        };
      }),
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
