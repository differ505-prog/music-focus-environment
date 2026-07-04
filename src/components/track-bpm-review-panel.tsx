'use client';

import { useEffect, useMemo, useState } from "react";
import { Loader2, Radar, ShieldAlert } from "lucide-react";

import { bpmOptions, themePrograms } from "@/data/music-assets";
import { detectTrackBpmFromUrl } from "@/lib/track-bpm-detection";
import {
  buildTrackBpmReviewItems,
  clearTrackReviewOverride,
  getTrackReviewStorageEventName,
  readTrackBpmDetections,
  readTrackReviewOverrides,
  saveTrackBpmDetection,
  updateTrackReviewOverride,
} from "@/lib/track-review-store";
import type { Track } from "@/types/music";

type TrackBpmReviewPanelProps = {
  tracks: Track[];
};

export function TrackBpmReviewPanel({ tracks }: TrackBpmReviewPanelProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressLabel, setScanProgressLabel] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const eventName = getTrackReviewStorageEventName();
    const refresh = () => setRefreshTick((current) => current + 1);

    window.addEventListener(eventName, refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const detections = useMemo(() => readTrackBpmDetections(), [refreshTick]);
  const overrides = useMemo(() => readTrackReviewOverrides(), [refreshTick]);
  const reviewItems = useMemo(
    () => buildTrackBpmReviewItems(tracks, themePrograms, overrides, detections),
    [detections, overrides, refreshTick, tracks],
  );

  const handleScanAllTracks = async () => {
    setIsScanning(true);

    try {
      for (const [index, track] of tracks.entries()) {
        if (!track.media.audioUrl) {
          continue;
        }

        setScanProgressLabel(`${index + 1} / ${tracks.length} · ${track.title}`);
        const result = await detectTrackBpmFromUrl(track.media.audioUrl, bpmOptions);

        saveTrackBpmDetection({
          trackId: track.id,
          audioUrl: track.media.audioUrl,
          detectedBpm: result.estimatedBpm,
          confidence: result.confidence,
          laneSuggestion: result.laneSuggestion,
          peakCount: result.peakCount,
          sampleDurationSeconds: result.sampleDurationSeconds,
          detectedAt: new Date().toISOString(),
        });
      }
    } finally {
      setScanProgressLabel(null);
      setIsScanning(false);
      setRefreshTick((current) => current + 1);
    }
  };

  return (
    <section className="rounded-[28px] border border-rose-300/16 bg-black/20 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.32em] text-rose-100/58">BPM 待覆核</p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">抓出 metadata 與實際節拍不一致的歌</h2>
          <p className="mt-3 text-sm leading-7 text-white/68">
            先掃描整個曲庫，再逐首決定要移到未分類、採用偵測 BPM，或忽略警告。
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleScanAllTracks()}
          disabled={isScanning}
          className="inline-flex items-center gap-3 rounded-full border border-rose-300/24 bg-rose-300/10 px-4 py-3 text-sm font-medium text-rose-50 transition hover:bg-rose-300/14 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          {isScanning ? "掃描中..." : "掃描全部曲目"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">待處理</p>
          <p className="mt-3 text-3xl font-semibold text-white">{reviewItems.length}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">最近進度</p>
          <p className="mt-3 text-sm leading-7 text-white/72">{scanProgressLabel ?? "尚未開始掃描或已掃描完成。"}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">建議</p>
          <p className="mt-3 text-sm leading-7 text-white/72">
            差距明顯且不在原路線允許 BPM 內的歌，先移到未分類，再決定是否採用偵測值。
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {reviewItems.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm leading-7 text-white/48">
            目前沒有待覆核項目。先掃描全部曲目，或用播放器播放幾首歌讓系統先抓到 BPM。
          </div>
        ) : (
          reviewItems.map((item) => {
            const isUncategorized = item.effectiveThemeProgramId === "uncategorized-lane";
            const confidencePercent = Math.round(item.detection.confidence * 100);

            return (
              <article
                key={`${item.track.id}-${item.detection.detectedAt}`}
                className="rounded-[22px] border border-rose-300/14 bg-[#080811]/86 p-4 text-sm text-white/74"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                      {item.effectiveProgramTitle}
                      {item.allowedBpms.length > 0 ? ` · 允許 ${item.allowedBpms.join(" / ")} BPM` : ""}
                    </p>
                    <h3 className="mt-2 text-lg font-medium text-white">{item.track.title}</h3>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/18 bg-rose-300/10 px-3 py-1 text-xs text-rose-100/88">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    差 {item.bpmDiff} BPM
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Metadata</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.effectiveBpm}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">偵測 BPM</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.detection.detectedBpm}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">可信度</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{confidencePercent}%</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">路線建議</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {item.routeMismatch ? "建議未分類" : isUncategorized ? "已在未分類" : "原路線仍可接受"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateTrackReviewOverride(item.track.id, { themeProgramId: "uncategorized-lane" })}
                    className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100/84 transition hover:bg-amber-300/16"
                  >
                    移到未分類
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTrackReviewOverride(item.track.id, {
                        bpm: item.detection.detectedBpm,
                        ignoreBpmMismatch: false,
                      })
                    }
                    className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/16"
                  >
                    採用 {item.detection.detectedBpm} BPM
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrackReviewOverride(item.track.id, { ignoreBpmMismatch: true })}
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/74 transition hover:bg-white/12"
                  >
                    忽略警告
                  </button>
                  <button
                    type="button"
                    onClick={() => clearTrackReviewOverride(item.track.id)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/62 transition hover:border-white/18 hover:text-white"
                  >
                    清除覆核
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
