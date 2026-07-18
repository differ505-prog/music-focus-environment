import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const audioPath = `${process.cwd()}/public/audio/${slug}.mp3`;

  let fileSize: number;
  let fileHandle: import("fs").promises.FileHandle;

  try {
    fileHandle = await import("fs").then((fs) => fs.promises.open(audioPath, "r"));
    const stat = await fileHandle.stat();
    fileSize = stat.size;
  } catch {
    return new NextResponse("Track not found", { status: 404 });
  }

  const range = _request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const fileBuffer = Buffer.alloc(chunkSize);
    await fileHandle.read(fileBuffer, 0, chunkSize, start);
    await fileHandle.close();

    return new NextResponse(fileBuffer, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const CHUNK_SIZE = 1024 * 1024;
  const stream = new ReadableStream({
    async start(controller) {
      let offset = 0;
      try {
        while (offset < fileSize) {
          const chunk = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize - offset));
          await fileHandle.read(chunk, 0, chunk.length, offset);
          controller.enqueue(chunk);
          offset += chunk.length;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        await fileHandle.close();
      }
    },
    cancel() {
      fileHandle.close().catch(() => {});
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
