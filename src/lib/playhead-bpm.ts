import { analyzeAudioBufferForBpm, type BpmAnalysis } from "@/lib/bpm-analyzer";
import type { BpmAnalysisOptions } from "@/lib/bpm-analyzer";

const AUDIO_FETCH_TIMEOUT_MS = 20_000;

function buildAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const w = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };

  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (Ctor as new (opts?: unknown) => AudioContext)();
}

async function fetchAudioBuffer(audioUrl: string): Promise<AudioBuffer> {
  const ctx = buildAudioContext();
  if (!ctx) throw new Error("不支援 AudioContext");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(audioUrl, { signal: controller.signal });
    if (!response.ok) throw new Error("音檔載入失敗");
    const arrayBuffer = await response.arrayBuffer();
    clearTimeout(timeout);

    try {
      return await ctx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      void ctx.close().catch(() => {});
    }
  } catch (err) {
    clearTimeout(timeout);
    throw err instanceof Error ? err : new Error("BPM 解析失敗");
  }
}

export type PlayheadBpmResult = {
  analysis: BpmAnalysis;
  audioUrl: string;
  /** Offset (seconds) into the audio where analysis should begin */
  playheadSeconds?: number;
};

const _bufferCache = new Map<string, Promise<AudioBuffer>>();

/** 取得或建立音檔的 AudioBuffer（同一 URL 不重複 fetch）。 */
export async function getAudioBuffer(audioUrl: string): Promise<AudioBuffer> {
  if (!_bufferCache.has(audioUrl)) {
    _bufferCache.set(audioUrl, fetchAudioBuffer(audioUrl));
  }
  return _bufferCache.get(audioUrl)!;
}

/** 對已解碼的 AudioBuffer 分析 BPM。
 * @param buffer - decoded AudioBuffer
 * @param laneOptions - BPM lane values to match against
 * @param options - analysis options
 * @param playheadSeconds - start offset into the audio (defaults to 0 = from beginning)
 */
export function analyzePlayheadBpm(
  buffer: AudioBuffer,
  laneOptions: readonly number[],
  options: BpmAnalysisOptions = {},
  playheadSeconds: number = 0,
): BpmAnalysis {
  return analyzeAudioBufferForBpm(buffer, laneOptions, options, playheadSeconds);
}

/** 一步完成 URL → Buffer → BPM 分析。
 * @param playheadSeconds - start offset into the audio (defaults to 0 = from beginning)
 */
export async function analyzePlayheadBpmFromUrl(
  audioUrl: string,
  laneOptions: readonly number[],
  options: BpmAnalysisOptions = {},
  playheadSeconds: number = 0,
): Promise<PlayheadBpmResult> {
  const buffer = await getAudioBuffer(audioUrl);
  const analysis = analyzePlayheadBpm(buffer, laneOptions, options, playheadSeconds);
  return { analysis, audioUrl, playheadSeconds };
}

/** 清除指定 URL 的緩存（更換曲目時呼叫）。 */
export function clearPlayheadBpmCache(audioUrl?: string) {
  if (audioUrl) {
    _bufferCache.delete(audioUrl);
  } else {
    _bufferCache.clear();
  }
}
