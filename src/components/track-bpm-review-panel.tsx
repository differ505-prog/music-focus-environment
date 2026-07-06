'use client';

import { useMemo, useState } from "react";
import { Loader2, Radar, ShieldAlert } from "lucide-react";

import { bpmOptions, themePrograms, tracks as baseTracks } from "@/data/music-assets";
import { detectTrackBpmFromUrl } from "@/lib/track-bpm-detection";
import {
  buildTrackBpmReviewItems,
  clearTrackReviewOverride,
  extractAllowedBpms,
  readTrackBpmDetections,
  readTrackReviewOverrides,
  saveTrackBpmDetection,
  updateTrackReviewOverride,
} from "@/lib/track-review-store";
import type { Track } from "@/types/music";

import { useTrackReviewSync } from "@/hooks/use-track-review-sync";
import { ReviewItemShell, ReviewPanelShell, StatCard, StatGrid } from "@/components/review-panel-shell";
import { Chip } from "@/components/ui-system";
import { TapBpmButton } from "@/components/tap-bpm-button";

type TrackBpmReviewPanelProps = {
  tracks: Track[];
};

export function TrackBpmReviewPanel({ tracks }: TrackBpmReviewPanelProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressLabel, setScanProgressLabel] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const refreshTick = useTrackReviewSync();
  const baseTrackMap = useMemo(() => new Map(baseTracks.map((track) => [track.id, track] as const)), []);
  const programMap = useMemo(() => new Map(themePrograms.map((program) => [program.id, program] as const)), []);

  const detections = useMemo(() => readTrackBpmDetections(), [refreshTick]);
  const overrides = useMemo(() => readTrackReviewOverrides(), [refreshTick]);
  const reviewItems = useMemo(
    () => buildTrackBpmReviewItems(tracks, themePrograms, overrides, detections),
    [detections, overrides, refreshTick, tracks],
  );

  const handleScanAllTracks = async () => {
    if (isScanning) {
      return;
    }

    setIsScanning(true);
    setScanNotice(null);
    setScanProgressLabel(`準備掃描 ${tracks.length} 首曲目...`);

    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      let successCount = 0;
      let skippedCount = 0;
      let skippedOverrideCount = 0;
      let failedCount = 0;

      for (const [index, track] of tracks.entries()) {
        if (!track.media.audioUrl) {
          skippedCount += 1;
          continue;
        }

        if (overrides[track.id]?.bpm != null) {
          skippedOverrideCount += 1;
          continue;
        }

        const baseTrack = baseTrackMap.get(track.id) ?? track;
        const allowedBpms = extractAllowedBpms(
          baseTrack.themeProgramId ? (programMap.get(baseTrack.themeProgramId) ?? null) : null,
        );
        setScanProgressLabel(`${index + 1} / ${tracks.length} · ${track.title}`);
        try {
          const result = await detectTrackBpmFromUrl(track.media.audioUrl, bpmOptions, {
            metadataBpm: track.bpm,
            allowedBpms,
          });

          saveTrackBpmDetection({
            trackId: track.id,
            audioUrl: track.media.audioUrl,
            detectedBpm: result.estimatedBpm,
            rawDetectedBpm: result.rawDetectedBpm,
            confidence: result.confidence,
            laneSuggestion: result.laneSuggestion,
            peakCount: result.peakCount,
            sampleDurationSeconds: result.sampleDurationSeconds,
            detectedAt: new Date().toISOString(),
            resolvedByReference: result.resolvedByReference,
          });
          successCount += 1;
        } catch (error) {
          failedCount += 1;
          const message = error instanceof Error ? error.message : "未知錯誤";
          setScanNotice(`「${track.title}」掃描失敗：${message}`);
        }
      }

      const summary = [`完成 ${successCount} 首`];

      if (failedCount > 0) {
        summary.push(`失敗 ${failedCount} 首`);
      }

      if (skippedCount > 0) {
        summary.push(`跳過 ${skippedCount} 首`);
      }

      if (skippedOverrideCount > 0) {
        summary.push(`已校正略過 ${skippedOverrideCount} 首`);
      }

      const summaryLabel = `掃描完成 · ${summary.join(" / ")}`;
      setScanProgressLabel(summaryLabel);

      if (failedCount === 0 && skippedOverrideCount > 0) {
        setScanNotice(`略過 ${skippedOverrideCount} 首已手動校正的曲目（清除覆核後會再納入掃描）。`);
      } else if (failedCount === 0) {
        setScanNotice("全部可掃描曲目已完成 BPM 分析。");
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <ReviewPanelShell
      eyebrow="BPM 待覆核"
      title="抓出 metadata 與實際節拍不一致的歌"
      description="先掃描整個曲庫，再逐首決定要移到未分類、採用偵測 BPM，或忽略警告。"
      accentColor="rose"
      actions={
        <button
          type="button"
          onClick={() => void handleScanAllTracks()}
          disabled={isScanning}
          className="inline-flex items-center gap-3 rounded-full border border-rose-300/24 bg-rose-300/10 px-4 py-3 text-sm font-medium text-rose-50 transition hover:bg-rose-300/14 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          {isScanning ? "掃描中..." : "掃描全部曲目"}
        </button>
      }
      summaryCards={
        <>
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
        </>
      }
      notice={scanNotice}
      isEmpty={reviewItems.length === 0}
      emptyLabel="目前沒有待覆核項目。先掃描全部曲目，或用播放器播放幾首歌讓系統先抓到 BPM。"
    >
      {reviewItems.length > 0 && reviewItems.map((item) => {
            const isUncategorized = item.effectiveThemeProgramId === "uncategorized-lane";
            const confidencePercent = Math.round(item.detection.confidence * 100);
            const rawDetectedBpm = item.detection.rawDetectedBpm ?? item.detection.detectedBpm;
            const detectionWasResolved = rawDetectedBpm !== item.detection.detectedBpm;

            return (
              <ReviewItemShell key={`${item.track.id}-${item.detection.detectedAt}`} accentColor="rose">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                      {item.effectiveProgramTitle}
                      {item.allowedBpms.length > 0 ? ` · 允許 ${item.allowedBpms.join(" / ")} BPM` : ""}
                    </p>
                    <h3 className="mt-2 text-lg font-medium text-white">{item.track.title}</h3>
                  </div>
                  <Chip variant={item.canReturnToSuggestedRoute ? "emerald" : "rose"}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {item.canReturnToSuggestedRoute ? `可回 ${item.suggestedProgramTitle}` : `差 ${item.bpmDiff} BPM`}
                  </Chip>
                </div>

                <StatGrid>
                  <StatCard label="Metadata">
                    <p className="text-2xl font-semibold text-white">{item.effectiveBpm}</p>
                  </StatCard>
                  <StatCard label="偵測 BPM">
                    <p className="text-2xl font-semibold text-white">{item.detection.detectedBpm}</p>
                    {detectionWasResolved ? (
                      <p className="mt-1 text-xs text-white/48">原始脈衝 {rawDetectedBpm} BPM，已折算回路線節拍</p>
                    ) : null}
                  </StatCard>
                  <StatCard label="可信度">
                    <p className="text-2xl font-semibold text-white">{confidencePercent}%</p>
                  </StatCard>
                  <StatCard label="路線建議">
                    <p className="text-sm font-medium text-white">
                      {item.canReturnToSuggestedRoute
                        ? `建議放回 ${item.suggestedProgramTitle}`
                        : item.routeMismatch
                          ? "建議未分類"
                          : isUncategorized
                            ? "已在未分類"
                            : "原路線仍可接受"}
                    </p>
                  </StatCard>
                </StatGrid>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.canReturnToSuggestedRoute && item.suggestedThemeProgramId ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateTrackReviewOverride(item.track.id, {
                          themeProgramId: item.suggestedThemeProgramId ?? undefined,
                          ignoreBpmMismatch: false,
                        })
                      }
                      className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100/84 transition hover:bg-emerald-300/16"
                    >
                      放回 {item.suggestedProgramTitle}
                    </button>
                  ) : null}
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
                  <CustomBpmInput trackId={item.track.id} currentBpm={item.effectiveBpm} allowedBpms={item.allowedBpms} />
                  <TapBpmButton
                    onResult={(bpm) =>
                      updateTrackReviewOverride(item.track.id, {
                        bpm,
                        ignoreBpmMismatch: false,
                      })
                    }
                    currentBpm={item.effectiveBpm}
                    allowedBpms={item.allowedBpms}
                  />
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
              </ReviewItemShell>
            );
          })}
    </ReviewPanelShell>
  );
}

type CustomBpmInputProps = {
  trackId: string;
  currentBpm: number;
  allowedBpms: number[];
};

function CustomBpmInput({ trackId, currentBpm, allowedBpms }: CustomBpmInputProps) {
  const [draft, setDraft] = useState<string>(String(currentBpm));
  const [showConfirm, setShowConfirm] = useState(false);

  const parsedValue = Number.parseFloat(draft);
  const isValidNumber = Number.isFinite(parsedValue) && parsedValue > 0;
  const hasChanged = isValidNumber && Math.abs(parsedValue - currentBpm) >= 0.5;
  const nearestLane = allowedBpms.length > 0
    ? allowedBpms.reduce((closest, candidate) =>
        Math.abs(candidate - parsedValue) < Math.abs(closest - parsedValue) ? candidate : closest,
      allowedBpms[0])
    : null;
  const isWithinLane = nearestLane !== null && Math.abs(nearestLane - parsedValue) <= 0.5;

  const handleApply = () => {
    if (!isValidNumber) {
      return;
    }
    updateTrackReviewOverride(trackId, {
      bpm: Math.round(parsedValue * 10) / 10,
      ignoreBpmMismatch: false,
    });
    setShowConfirm(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && hasChanged) {
      event.preventDefault();
      handleApply();
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min="20"
        max="300"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setShowConfirm(true);
        }}
        onKeyDown={handleKeyDown}
        aria-label="自訂 BPM 數值"
        className="w-20 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/36 focus:border-white/30 focus:outline-none"
        placeholder="BPM"
      />
      {showConfirm && hasChanged && isValidNumber ? (
        <button
          type="button"
          onClick={handleApply}
          className={`rounded-full border px-3 py-2 text-xs transition ${
            isWithinLane
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/84 hover:bg-emerald-300/16"
              : "border-amber-300/20 bg-amber-300/10 text-amber-100/84 hover:bg-amber-300/16"
          }`}
        >
          {isWithinLane
            ? `套用 ${parsedValue.toFixed(1)}（符合路線）`
            : nearestLane !== null
              ? `套用 ${parsedValue.toFixed(1)}（會超出路線，最近 ${nearestLane}）`
              : `套用 ${parsedValue.toFixed(1)}`}
        </button>
      ) : null}
    </div>
  );
}
