'use client';

import { useMemo, useState } from "react";
import { Loader2, Waves } from "lucide-react";

import { tracks as baseTracks } from "@/data/music-assets";
import {
  detectTrackMixInSuggestionFromUrl,
  detectTrackMixOutSuggestionFromUrl,
} from "@/lib/track-transition-detection";
import {
  buildTrackTransitionReviewItems,
  clearTrackReviewOverride,
  readTrackMixInSuggestions,
  readTrackMixOutSuggestions,
  readTrackReviewOverrides,
  saveTrackMixInSuggestion,
  saveTrackMixOutSuggestion,
  updateTrackReviewOverride,
  updateTrackReviewOverrides,
} from "@/lib/track-review-store";
import type { Track } from "@/types/music";

import { useTrackReviewSync } from "@/hooks/use-track-review-sync";
import { ReviewItemShell, ReviewPanelShell, StatCard, StatGrid } from "@/components/review-panel-shell";
import { Chip } from "@/components/ui-system";

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
  const refreshTick = useTrackReviewSync();
  const baseTrackMap = useMemo(() => new Map(baseTracks.map((track) => [track.id, track] as const)), []);

  const mixInSuggestions = useMemo(() => readTrackMixInSuggestions(), [refreshTick]);
  const mixOutSuggestions = useMemo(() => readTrackMixOutSuggestions(), [refreshTick]);
  const overrides = useMemo(() => readTrackReviewOverrides(), [refreshTick]);
  const reviewItems = useMemo(
    () => buildTrackTransitionReviewItems(tracks, overrides, mixInSuggestions, mixOutSuggestions),
    [overrides, refreshTick, mixInSuggestions, mixOutSuggestions, tracks],
  );
  const pendingApplyItems = useMemo(
    () => reviewItems.filter((item) => item.diffSeconds >= 0.01 || item.mixOutDiffSeconds >= 0.01),
    [reviewItems],
  );
  const pendingRestoreItems = useMemo(
    () =>
      reviewItems.filter(
        (item) =>
          overrides[item.track.id]?.mixInPointSeconds != null ||
          overrides[item.track.id]?.mixOutPointSeconds != null,
      ),
    [overrides, reviewItems],
  );

  const handleScanAllTracks = async () => {
    if (isScanning) {
      return;
    }

    setIsScanning(true);
    setScanNotice(null);
    setScanProgressLabel(`分析 ${tracks.length} 首曲目的接歌進點與出點`);

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
          const [mixInResult, mixOutResult] = await Promise.all([
            detectTrackMixInSuggestionFromUrl(track.media.audioUrl, {
              metadataBpm: track.bpm,
              introCueSeconds: baseTrack.transition.introCueSeconds,
            }).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : "未知錯誤";
              throw new Error(`Mix In 分析失敗：${message}`);
            }),
            detectTrackMixOutSuggestionFromUrl(track.media.audioUrl, {
              metadataBpm: track.bpm,
              introCueSeconds: baseTrack.transition.introCueSeconds,
            }).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : "未知錯誤";
              throw new Error(`Mix Out 分析失敗：${message}`);
            }),
          ]);

          const analyzedAt = new Date().toISOString();

          saveTrackMixInSuggestion({
            trackId: track.id,
            audioUrl: track.media.audioUrl,
            suggestedMixInSeconds: mixInResult.suggestedMixInSeconds,
            confidence: mixInResult.confidence,
            analysisWindowSeconds: mixInResult.analysisWindowSeconds,
            beatAligned: mixInResult.beatAligned,
            summary: mixInResult.summary,
            analyzedAt,
          });

          saveTrackMixOutSuggestion({
            trackId: track.id,
            audioUrl: track.media.audioUrl,
            suggestedMixOutSeconds: mixOutResult.suggestedMixOutSeconds,
            confidence: mixOutResult.confidence,
            analysisWindowSeconds: mixOutResult.analysisWindowSeconds,
            beatAligned: mixOutResult.beatAligned,
            summary: mixOutResult.summary,
            analyzedAt,
          });

          successCount += 1;
        } catch (error) {
          failedCount += 1;
          const message = error instanceof Error ? error.message : "未知錯誤";
          setScanNotice(`「${track.title}」接歌分析失敗：${message}`);
        }
      }

      setScanProgressLabel(`分析完成 · ${successCount} 首成功${failedCount > 0 ? ` / ${failedCount} 首失敗` : ""}`);

      if (failedCount === 0) {
        setScanNotice("全部曲目的建議進點與出點已完成分析");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyAllSuggestions = () => {
    if (pendingApplyItems.length === 0) {
      return;
    }

    const patches: Array<{ trackId: string; patch: Parameters<typeof updateTrackReviewOverride>[1] }> = [];

    for (const item of pendingApplyItems) {
      const patch: Parameters<typeof updateTrackReviewOverride>[1] = {};

      if (item.diffSeconds >= 0.01) {
        patch.mixInPointSeconds = item.suggestion.suggestedMixInSeconds;
      }

      if (item.mixOutSuggestion && item.mixOutDiffSeconds >= 0.01) {
        patch.mixOutPointSeconds = item.mixOutSuggestion.suggestedMixOutSeconds;
      }

      if (Object.keys(patch).length > 0) {
        patches.push({ trackId: item.track.id, patch });
      }
    }

    if (patches.length === 0) {
      return;
    }

    updateTrackReviewOverrides(patches);

    setScanNotice(`已一鍵採用 ${patches.length} 首曲目的接歌建議`);
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
          mixOutPointSeconds: undefined,
        },
      })),
    );

    setScanNotice(`已一鍵還原 ${pendingRestoreItems.length} 首曲目的 Base 進點與出點`);
  };

  return (
    <ReviewPanelShell
      eyebrow="接歌進點與出點建議"
      title="抓最有節拍感的進場與最佳出場位置"
      description="分析前段 onset 與尾段能量衰減，對照 metadata 決定是否採用。"
      accentColor="cyan"
      actions={
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleRestoreAllMixIns}
            disabled={isScanning || pendingRestoreItems.length === 0}
            className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
          >
            一鍵還原
            {pendingRestoreItems.length > 0 ? ` (${pendingRestoreItems.length})` : ""}
          </button>
          <button
            type="button"
            onClick={handleApplyAllSuggestions}
            disabled={isScanning || pendingApplyItems.length === 0}
            className="inline-flex items-center gap-3 rounded-full border border-fuchsia-300/24 bg-fuchsia-300/10 px-4 py-3 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            一鍵採用
            {pendingApplyItems.length > 0 ? ` (${pendingApplyItems.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => void handleScanAllTracks()}
            disabled={isScanning}
            className="inline-flex items-center gap-3 rounded-full border border-cyan-300/24 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Waves className="h-4 w-4" />}
            {isScanning ? "分析中..." : "掃描進點與出點"}
          </button>
        </div>
      }
      summaryCards={
        <>
          <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">已分析</p>
            <p className="mt-3 text-3xl font-semibold text-white">{reviewItems.length}</p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">最近進度</p>
            <p className="mt-3 text-sm leading-7 text-white/72">{scanProgressLabel ?? "尚未掃描"}</p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">待採用</p>
            <p className="mt-3 text-3xl font-semibold text-white">{pendingApplyItems.length}</p>
          </div>
        </>
      }
      notice={scanNotice}
      isEmpty={reviewItems.length === 0}
      emptyLabel="掃描後顯示建議"
    >
      {reviewItems.length > 0 && reviewItems.map((item) => {
            const mixInConfidencePercent = Math.round(item.suggestion.confidence * 100);
            const mixOutConfidencePercent = item.mixOutSuggestion
              ? Math.round(item.mixOutSuggestion.confidence * 100)
              : null;
            const maxDiffSeconds = Math.max(item.diffSeconds, item.mixOutDiffSeconds);

            return (
              <ReviewItemShell key={`${item.track.id}-${item.suggestion.analyzedAt}`} accentColor="cyan">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                      {item.track.bpm} BPM · Base In {formatSeconds(item.baseMixInPointSeconds)} · Base Out {formatSeconds(item.baseMixOutPointSeconds)}
                    </p>
                    <h3 className="mt-2 text-lg font-medium text-white">{item.track.title}</h3>
                  </div>
                  <Chip variant={maxDiffSeconds <= 1 ? "emerald" : maxDiffSeconds <= 3 ? "amber" : "rose"}>
                    差 {formatSeconds(maxDiffSeconds)}
                  </Chip>
                </div>

                <StatGrid>
                  <StatCard label="目前 Mix In">
                    <p className="text-2xl font-semibold text-white">{formatSeconds(item.effectiveMixInPointSeconds)}</p>
                  </StatCard>
                  <StatCard label="系統建議 In">
                    <p className="text-2xl font-semibold text-white">{formatSeconds(item.suggestion.suggestedMixInSeconds)}</p>
                  </StatCard>
                  <StatCard label="進點可信度">
                    <p className="text-2xl font-semibold text-white">{mixInConfidencePercent}%</p>
                  </StatCard>
                  <StatCard label="進點特性">
                    <p className="text-sm font-medium text-white">
                      {item.suggestion.beatAligned ? "已對齊節拍格" : "未對齊節拍格"}
                    </p>
                    <p className="mt-1 text-xs text-white/48">分析窗 {formatSeconds(item.suggestion.analysisWindowSeconds)}</p>
                  </StatCard>
                </StatGrid>

                <div className="mt-3 rounded-[18px] border border-white/8 bg-black/24 p-3 text-sm leading-6 text-white/68">
                  {item.suggestion.summary}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <StatGrid>
                    <StatCard label="目前 Mix Out">
                      <p className="text-2xl font-semibold text-white">{formatSeconds(item.effectiveMixOutPointSeconds)}</p>
                    </StatCard>
                    <StatCard label="系統建議 Out">
                      <p className="text-2xl font-semibold text-white">
                        {item.mixOutSuggestion ? formatSeconds(item.mixOutSuggestion.suggestedMixOutSeconds) : "—"}
                      </p>
                    </StatCard>
                    <StatCard label="出點可信度">
                      <p className="text-2xl font-semibold text-white">
                        {mixOutConfidencePercent != null ? `${mixOutConfidencePercent}%` : "—"}
                      </p>
                    </StatCard>
                    <StatCard label="出點特性">
                      <p className="text-sm font-medium text-white">
                        {item.mixOutSuggestion
                          ? item.mixOutSuggestion.beatAligned
                            ? "已對齊節拍格"
                            : "未對齊節拍格"
                          : "尚未分析"}
                      </p>
                      <p className="mt-1 text-xs text-white/48">
                        {item.mixOutSuggestion
                          ? `分析窗 ${formatSeconds(item.mixOutSuggestion.analysisWindowSeconds)}`
                          : "—"}
                      </p>
                    </StatCard>
                  </StatGrid>

                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3 text-sm leading-6 text-white/68">
                    {item.mixOutSuggestion?.summary ?? "尚未產生 Mix Out 建議，先按「掃描進點與出點」取得尾段偵測。"}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateTrackReviewOverride(item.track.id, {
                        mixInPointSeconds: item.suggestion.suggestedMixInSeconds,
                        ...(item.mixOutSuggestion
                          ? { mixOutPointSeconds: item.mixOutSuggestion.suggestedMixOutSeconds }
                          : {}),
                      })
                    }
                    className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/16"
                  >
                    採用建議
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTrackReviewOverride(item.track.id, {
                        mixInPointSeconds: undefined,
                        mixOutPointSeconds: undefined,
                      })
                    }
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/74 transition hover:bg-white/12"
                  >
                    還原 Base
                  </button>
                  <button
                    type="button"
                    onClick={() => clearTrackReviewOverride(item.track.id)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/62 transition hover:border-white/18 hover:text-white"
                  >
                    清除覆核
                  </button>
                </div>
              </ReviewItemShell>
            );
          })}
    </ReviewPanelShell>
  );
}