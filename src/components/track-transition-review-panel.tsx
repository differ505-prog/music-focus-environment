'use client';

import { useEffect, useMemo, useState } from "react";
import { Loader2, Waves } from "lucide-react";

import { tracks as baseTracks } from "@/data/music-assets";
import { detectTrackMixInSuggestionFromUrl } from "@/lib/track-transition-detection";
import {
  buildTrackTransitionReviewItems,
  clearTrackReviewOverride,
  getTrackReviewStorageEventName,
  readTrackMixInSuggestions,
  readTrackReviewOverrides,
  saveTrackMixInSuggestion,
  updateTrackReviewOverride,
  updateTrackReviewOverrides,
} from "@/lib/track-review-store";
import type { Track } from "@/types/music";

type TrackTransitionReviewPanelProps = {
  tracks: Track[];
};

function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

export function TrackTransitionReviewPanel({ tracks }: TrackTransitionReviewPanelProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressLabel, setScanProgressLabel] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const baseTrackMap = useMemo(() => new Map(baseTracks.map((track) => [track.id, track] as const)), []);

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

  const suggestions = useMemo(() => readTrackMixInSuggestions(), [refreshTick]);
  const overrides = useMemo(() => readTrackReviewOverrides(), [refreshTick]);
  const reviewItems = useMemo(
    () => buildTrackTransitionReviewItems(tracks, overrides, suggestions),
    [overrides, refreshTick, suggestions, tracks],
  );
  const pendingApplyItems = useMemo(
    () => reviewItems.filter((item) => item.diffSeconds >= 0.01),
    [reviewItems],
  );
  const pendingRestoreItems = useMemo(
    () => reviewItems.filter((item) => overrides[item.track.id]?.mixInPointSeconds != null),
    [overrides, reviewItems],
  );

  const handleScanAllTracks = async () => {
    if (isScanning) {
      return;
    }

    setIsScanning(true);
    setScanNotice(null);
    setScanProgressLabel(`準備分析 ${tracks.length} 首曲目的接歌進點...`);

    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      let successCount = 0;
      let failedCount = 0;

      for (const [index, track] of tracks.entries()) {
        if (!track.media.audioUrl) {
          continue;
        }

        const baseTrack = baseTrackMap.get(track.id) ?? track;
        setScanProgressLabel(`${index + 1} / ${tracks.length} · ${track.title}`);

        try {
          const result = await detectTrackMixInSuggestionFromUrl(track.media.audioUrl, {
            metadataBpm: track.bpm,
            introCueSeconds: baseTrack.transition.introCueSeconds,
          });

          saveTrackMixInSuggestion({
            trackId: track.id,
            audioUrl: track.media.audioUrl,
            suggestedMixInSeconds: result.suggestedMixInSeconds,
            confidence: result.confidence,
            analysisWindowSeconds: result.analysisWindowSeconds,
            beatAligned: result.beatAligned,
            summary: result.summary,
            analyzedAt: new Date().toISOString(),
          });
          successCount += 1;
        } catch (error) {
          failedCount += 1;
          const message = error instanceof Error ? error.message : "未知錯誤";
          setScanNotice(`「${track.title}」接歌進點分析失敗：${message}`);
        }
      }

      setScanProgressLabel(`分析完成 · ${successCount} 首成功${failedCount > 0 ? ` / ${failedCount} 首失敗` : ""}`);

      if (failedCount === 0) {
        setScanNotice("全部曲目的建議進點已完成分析。");
      }
    } finally {
      setIsScanning(false);
      setRefreshTick((current) => current + 1);
    }
  };

  const handleApplyAllSuggestions = () => {
    if (pendingApplyItems.length === 0) {
      return;
    }

    updateTrackReviewOverrides(
      pendingApplyItems.map((item) => ({
        trackId: item.track.id,
        patch: {
          mixInPointSeconds: item.suggestion.suggestedMixInSeconds,
        },
      })),
    );

    setScanNotice(`已一鍵採用 ${pendingApplyItems.length} 首曲目的建議 Mix In。`);
  };

  const handleRestoreAllMixIns = () => {
    if (pendingRestoreItems.length === 0) {
      return;
    }

    updateTrackReviewOverrides(
      pendingRestoreItems.map((item) => ({
        trackId: item.track.id,
        patch: {
          mixInPointSeconds: undefined,
        },
      })),
    );

    setScanNotice(`已一鍵還原 ${pendingRestoreItems.length} 首曲目的 Base Mix In。`);
  };

  return (
    <section className="rounded-[28px] border border-cyan-300/16 bg-black/20 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/58">接歌進點建議</p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">自動抓比較有節拍感的進場位置</h2>
          <p className="mt-3 text-sm leading-7 text-white/68">
            系統會分析每首歌前段的能量與 onset，給出建議 Mix In，讓你對照目前 metadata 再決定是否採用。
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleRestoreAllMixIns}
            disabled={isScanning || pendingRestoreItems.length === 0}
            className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
          >
            一鍵還原全部 Base Mix In
            {pendingRestoreItems.length > 0 ? ` (${pendingRestoreItems.length})` : ""}
          </button>
          <button
            type="button"
            onClick={handleApplyAllSuggestions}
            disabled={isScanning || pendingApplyItems.length === 0}
            className="inline-flex items-center gap-3 rounded-full border border-fuchsia-300/24 bg-fuchsia-300/10 px-4 py-3 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            一鍵採用全部建議
            {pendingApplyItems.length > 0 ? ` (${pendingApplyItems.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => void handleScanAllTracks()}
            disabled={isScanning}
            className="inline-flex items-center gap-3 rounded-full border border-cyan-300/24 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Waves className="h-4 w-4" />}
            {isScanning ? "分析中..." : "掃描接歌進點"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">已分析</p>
          <p className="mt-3 text-3xl font-semibold text-white">{reviewItems.length}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">最近進度</p>
          <p className="mt-3 text-sm leading-7 text-white/72">{scanProgressLabel ?? "尚未開始分析。"}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">操作建議</p>
          <p className="mt-3 text-sm leading-7 text-white/72">
            差距超過 1 秒的進點先人工試聽，再決定是否採用建議值。
          </p>
          <p className="mt-2 text-xs text-white/46">目前可一鍵採用 {pendingApplyItems.length} 首。</p>
          <p className="mt-1 text-xs text-white/46">目前可一鍵還原 {pendingRestoreItems.length} 首。</p>
        </div>
      </div>

      {scanNotice ? (
        <div className="mt-4 rounded-[20px] border border-cyan-300/16 bg-cyan-300/8 px-4 py-3 text-sm text-cyan-100/88">
          {scanNotice}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {reviewItems.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm leading-7 text-white/48">
            先掃描接歌進點，系統才會顯示每首歌的建議 Mix In。
          </div>
        ) : (
          reviewItems.map((item) => {
            const confidencePercent = Math.round(item.suggestion.confidence * 100);
            const diffToneClass =
              item.diffSeconds <= 1
                ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-100/88"
                : item.diffSeconds <= 3
                  ? "border-amber-300/18 bg-amber-300/10 text-amber-100/88"
                  : "border-rose-300/18 bg-rose-300/10 text-rose-100/88";

            return (
              <article
                key={`${item.track.id}-${item.suggestion.analyzedAt}`}
                className="rounded-[22px] border border-cyan-300/14 bg-[#080811]/86 p-4 text-sm text-white/74"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                      {item.track.bpm} BPM · Base {formatSeconds(item.baseMixInPointSeconds)}
                    </p>
                    <h3 className="mt-2 text-lg font-medium text-white">{item.track.title}</h3>
                  </div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${diffToneClass}`}>
                    差 {formatSeconds(item.diffSeconds)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">目前 Mix In</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatSeconds(item.effectiveMixInPointSeconds)}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">系統建議</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatSeconds(item.suggestion.suggestedMixInSeconds)}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">可信度</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{confidencePercent}%</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">特性</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {item.suggestion.beatAligned ? "已對齊節拍格" : "未對齊節拍格"}
                    </p>
                    <p className="mt-1 text-xs text-white/48">分析窗 {formatSeconds(item.suggestion.analysisWindowSeconds)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-white/8 bg-black/24 p-3 text-sm leading-6 text-white/68">
                  {item.suggestion.summary}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateTrackReviewOverride(item.track.id, {
                        mixInPointSeconds: item.suggestion.suggestedMixInSeconds,
                      })
                    }
                    className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/16"
                  >
                    採用建議 {formatSeconds(item.suggestion.suggestedMixInSeconds)}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTrackReviewOverride(item.track.id, {
                        mixInPointSeconds: undefined,
                      })
                    }
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/74 transition hover:bg-white/12"
                  >
                    還原 Base Mix In
                  </button>
                  <button
                    type="button"
                    onClick={() => clearTrackReviewOverride(item.track.id)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/62 transition hover:border-white/18 hover:text-white"
                  >
                    清除該曲覆核
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
