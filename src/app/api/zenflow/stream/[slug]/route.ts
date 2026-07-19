import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://taskflow-v2-pink.vercel.app",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Range",
} as const;

const BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL as string | undefined) ??
  "https://music-focus-environment.vercel.app";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const audioUrl = `${BASE_URL}/audio/${slug}.mp3`;

  const range = _request.headers.get("range");

  try {
    const audioRes = await fetch(audioUrl, {
      headers: range ? { Range: range } : {},
    });

    if (!audioRes.ok) {
      return new NextResponse("Track not found", { status: 404 });
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
      ...CORS_HEADERS,
    };

    if (range) {
      const contentRange = audioRes.headers.get("content-range");
      const contentLength = audioRes.headers.get("content-length");
      if (contentRange) headers["Content-Range"] = contentRange;
      if (contentLength) headers["Content-Length"] = contentLength;
      headers["Accept-Ranges"] = "bytes";
      return new NextResponse(new Uint8Array(arrayBuffer), {
        status: 206,
        headers,
      });
    }

    if (audioRes.headers.get("content-length")) {
      headers["Content-Length"] = audioRes.headers.get("content-length")!;
    }

    return new NextResponse(new Uint8Array(arrayBuffer), {
      status: 200,
      headers,
    });
  } catch {
    return new NextResponse("Track not found", { status: 404 });
  }
}
