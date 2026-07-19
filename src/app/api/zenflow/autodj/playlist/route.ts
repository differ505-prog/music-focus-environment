import { NextResponse } from "next/server";
import { tracks as allTracks } from "@/data/music-assets";
import { buildAutoDjQueue, createAutoDjSessionPlan } from "@/lib/auto-dj";

const OMNISONIC_BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL as string | undefined) ??
  "https://music-focus-environment.vercel.app";

const ALLOWED_ORIGIN =
  (process.env.ZENFLOW_ALLOWED_ORIGIN as string | undefined) ??
  "https://taskflow-v2-pink.vercel.app";

/** Strip noisy fields that ZenFlowProvider doesn't need to transfer */
function serializeTrack(track: (typeof allTracks)[number]) {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    bpm: track.bpm,
    durationSeconds: track.durationSeconds,
    musicalKey: track.musicalKey,
    energyLevel: track.energyLevel,
    moodTags: track.moodTags,
    status: track.status,
    media: {
      audioUrl: track.media.audioUrl
        ? `${OMNISONIC_BASE_URL}/api/zenflow/stream/${track.slug}`
        : "",
      coverImageUrl: track.media.coverImageUrl,
      backgroundVideoUrl: track.media.backgroundVideoUrl,
    },
    copy: track.copy,
    transition: track.transition,
    featured: track.featured,
    createdAt: track.createdAt,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currentTrackId = searchParams.get("currentTrackId") ?? null;
  const nextTrackId = searchParams.get("nextTrackId") ?? null;

  const publishedTracks = allTracks.filter(
    (track) =>
      track.status === "published" &&
      track.bpm >= 80 &&
      track.bpm <= 94,
  );

  const orderedIds = buildAutoDjQueue(publishedTracks, currentTrackId ?? undefined);
  const orderedTracks = orderedIds
    .map((id) => publishedTracks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t != null);

  const sessionPlan = createAutoDjSessionPlan(
    orderedTracks,
    currentTrackId,
    nextTrackId,
  );

  return NextResponse.json(
    {
      tracks: orderedTracks.map(serializeTrack),
      sessionPlan,
      generatedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=10, stale-while-revalidate=60",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
