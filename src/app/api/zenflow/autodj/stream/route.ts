import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { tracks as allTracks } from "@/data/music-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OMNISONIC_BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL as string | undefined) ??
  "https://music-focus-environment.vercel.app";

const CROSSFADE_SECONDS = 4.36;
const CHUNK_SECONDS = 5;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://taskflow-v2-pink.vercel.app",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Extract WAV header from raw bytes (first 44 bytes)
function extractWavHeader(header: Buffer): Buffer {
  return header.subarray(0, 44);
}

// Parse WAV fmt + data header (handles extra fact/chunk headers before 'data')
function findDataOffset(header: Buffer): number {
  // Standard: "RIFF" (0-3), size (4-7), "WAVE" (8-11), "fmt " (12-15), ...
  // Find 'data' marker
  for (let i = 12; i < header.length - 8; i++) {
    if (header[i] === 0x64 && header[i + 1] === 0x61 && header[i + 2] === 0x74 && header[i + 3] === 0x61) {
      return i + 8; // skip 'data' + size (4 bytes)
    }
  }
  return 44; // fallback
}

// Write 16-bit PCM WAV header
function makeWavHeader(dataSize: number, numChannels = 2, sampleRate = 44100, bitsPerSample = 16): Buffer {
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
  buf.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

// Crossfade two PCM buffers in-place (equal-power)
function crossfadeBuffers(
  out: Buffer,
  inp: Buffer,
  fadeOutStart: number, // sample index in out where fade-out begins
  fadeLen: number,
  outOffset: number, // where to write into out
): void {
  const numChannels = 2;
  for (let i = 0; i < fadeLen; i++) {
    const t = i / fadeLen;
    const outGain = Math.cos((t * Math.PI) / 2);
    const inGain = Math.sin((t * Math.PI) / 2);
    for (let ch = 0; ch < numChannels; ch++) {
      const outSample = out.readInt16LE(outOffset + (fadeOutStart + i) * numChannels * 2 + ch * 2);
      const inSample = inp.readInt16LE(i * numChannels * 2 + ch * 2);
      const mixed = outSample * outGain + inSample * inGain;
      out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mixed))), outOffset + (fadeOutStart + i) * numChannels * 2 + ch * 2);
    }
  }
}

export async function GET(_request: NextRequest) {
  // Build shuffled playlist (filter to 80-94 BPM like zenflow/tracks)
  const publishedTracks = allTracks.filter(
    (t) => t.status === "published" && t.bpm >= 80 && t.bpm <= 94,
  );
  const playlist = shuffle([...publishedTracks]);

  if (playlist.length === 0) {
    return new NextResponse("No tracks available", { status: 503, headers: CORS_HEADERS });
  }

  // ── Writable that collects bytes and emits chunks ─────────────────────────
  let headerSent = false;
  let bytesInCurrentChunk = 0;
  const CHUNK_SIZE = Math.round(44100 * 2 * 2 * CHUNK_SECONDS); // 5s of 44.1k stereo 16bit
  let currentChunk: Buffer[] = [];
  let currentTrackIndex = 0;
  let currentTrackEnded = false;
  let crossfadeBuffer: Buffer | null = null; // overlap from next track during crossfade
  let crossfadeWriteOffset = 0; // position in crossfadeOutput to write

  const sendChunk = (controller: ReadableStreamDefaultController<Uint8Array>, force = false) => {
    if (!force && bytesInCurrentChunk < CHUNK_SIZE) return;
    if (bytesInCurrentChunk === 0 && !force) return;

    let chunkData = Buffer.concat(currentChunk);
    const dataBytes = chunkData.length;
    const paddedSize = Math.ceil(dataBytes / (44100 * 4)) * (44100 * 4); // align to sample boundary

    // Pad to sample boundary
    if (dataBytes < paddedSize) {
      chunkData = Buffer.concat([chunkData, Buffer.alloc(paddedSize - dataBytes)]);
    }

    if (!headerSent) {
      const wavHeader = makeWavHeader(chunkData.length);
      controller.enqueue(new Uint8Array(Buffer.concat([wavHeader, chunkData])));
      headerSent = true;
    } else {
      controller.enqueue(new Uint8Array(chunkData));
    }

    currentChunk = [];
    bytesInCurrentChunk = 0;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Start ffmpeg for first track
      const startTrack = (trackIndex: number) => {
        currentTrackIndex = trackIndex;
        currentTrackEnded = false;
        const track = playlist[trackIndex];
        const audioUrl = `${OMNISONIC_BASE_URL}/audio/${track.slug}.mp3`;

        const ffmpeg = spawn("ffmpeg", [
          "-reconnect", "1",
          "-reconnect_streamed", "1",
          "-reconnect_delay_max", "5",
          "-i", audioUrl,
          "-f", "wav",
          "-ar", "44100",
          "-ac", "2",
          "-acodec", "pcm_s16le",
          "-",
        ]);

        ffmpeg.stdout.on("data", (chunk: Buffer) => {
          // First 44 bytes are WAV header — skip if not first track
          let data = chunk;
          if (headerSent && chunk.length >= 44) {
            data = chunk.subarray(findDataOffset(chunk));
          }

          // Append to current chunk
          currentChunk.push(data);
          bytesInCurrentChunk += data.length;

          // Check for crossfade trigger (remaining < crossfade window)
          // We approximate by watching chunk accumulation
          sendChunk(controller);
        });

        ffmpeg.stderr.on("data", () => {
          // ignore ffmpeg verbose output
        });

        ffmpeg.on("close", (code) => {
          if (code !== 0 && code !== null) {
            // Try next track on error
            currentTrackEnded = true;
          }
        });

        ffmpeg.on("error", () => {
          currentTrackEnded = true;
        });
      };

      startTrack(0);
    },

    async pull(controller) {
      // Drain current chunk
      sendChunk(controller, true);

      // Wait for track to finish
      while (!currentTrackEnded) {
        await new Promise((r) => setTimeout(r, 100));
      }

      // Move to next track
      const nextIndex = (currentTrackIndex + 1) % playlist.length;
      headerSent = false; // each new track's ffmpeg output starts with its own WAV header
      currentChunk = [];
      bytesInCurrentChunk = 0;

      // Restart with next track
      const track = playlist[nextIndex];
      const audioUrl = `${OMNISONIC_BASE_URL}/audio/${track.slug}.mp3`;

      const ffmpeg = spawn("ffmpeg", [
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        "-i", audioUrl,
        "-f", "wav",
        "-ar", "44100",
        "-ac", "2",
        "-acodec", "pcm_s16le",
        "-",
      ]);

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        let data = chunk;
        if (headerSent && chunk.length >= 44) {
          data = chunk.subarray(findDataOffset(chunk));
        }
        currentChunk.push(data);
        bytesInCurrentChunk += data.length;
        sendChunk(controller);
      });

      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", () => {
        currentTrackEnded = true;
      });
      ffmpeg.on("error", () => {
        currentTrackEnded = true;
      });

      currentTrackIndex = nextIndex;
      currentTrackEnded = false;

      // Small delay to let ffmpeg start outputting
      await new Promise((r) => setTimeout(r, 200));
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      ...CORS_HEADERS,
    },
  });
}
