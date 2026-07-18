import { NextResponse } from "next/server";

import { tracks as allTracks } from "@/data/music-assets";

const OMNISONIC_BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL as string | undefined) ??
  "https://music-focus-environment.vercel.app";

export type ZenFlowTrack = {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  durationSeconds: number;
  descriptionZh: string;
  descriptionEn: string;
  audioUrl: string;
};

export async function GET() {
  const publishedTracks = allTracks.filter(
    (track) =>
      track.status === "published" &&
      track.bpm >= 80 &&
      track.bpm <= 94,
  );

  const zenFlowTracks: ZenFlowTrack[] = publishedTracks.map((track) => ({
    id: track.id,
    slug: track.slug,
    title: track.title,
    bpm: track.bpm,
    durationSeconds: track.durationSeconds,
    descriptionZh: track.copy.descriptionZh,
    descriptionEn: track.copy.descriptionEn,
    audioUrl: `${OMNISONIC_BASE_URL}/api/zenflow/stream/${track.slug}`,
  }));

  return new NextResponse(JSON.stringify({ tracks: zenFlowTracks }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "https://taskflow-v2-pink.vercel.app",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
