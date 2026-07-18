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
  // 只回傳 85 BPM（CEO Deep Focus）lane 的已發布曲目
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

  return NextResponse.json(
    { tracks: zenFlowTracks },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
