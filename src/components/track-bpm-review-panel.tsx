'use client';

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Radar, ShieldAlert } from "lucide-react";

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
import { MoreMenu } from "@/components/more-menu";

type TrackBpmReviewPanelProps = {
  tracks: Track[];
};

type CustomBpmInputState = {
  trackId: string;
  draft: string;
  showConfirm: boolean;
};

export function TrackBpmReviewPanel({ tracks }: TrackBpmReviewPanelProps) {
  const refreshTick = useTrackReviewSync();
  const baseTrackMap = useMemo(() => new Map(baseTracks.map((track) => [track.id, track] as const)), []);
  const programMap = useMemo(() => new Map(themePrograms.map((program) => [program.id, program] as const)), []);

  const detections = useMemo(() => readTrackBpmDetections(), [refreshTick]);
  const overrides = useMemo(() => readTrackReviewOverrides(), [refreshTick]);
  const allReviewItems = useMemo(
    () => buildTrackBpmReviewItems(tracks, themePrograms, overrides, detections),
    [detections, overrides, refreshTick, tracks],
  );

  const tapItems = allReviewItems.filter((item) => item.isTapCorrected);
  const autoItems = allReviewItems.filter((item) => !item.isTapCorrected);
  const showTapSection = tapItems.length > 0;

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressLabel, setScanProgressLabel] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [customBpmState, setCustomBpmState] = useState<CustomBpmInputState | null>(null);
  const [tapCorrectedCollapsed, setTapCorrectedCollapsed] = useState(true);

  const handleScanAllTracks = useCallback(async () => {
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
        setScanNotice(`略過 ${skippedOverrideCount} 首已手動校正的曲目（清除覆核後會再納入掃描）`);
      } else if (failedCount === 0) {
        setScanNotice("全部可掃描曲目已完成 BPM 分析");
      }
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, overrides, programMap, baseTrackMap, tracks]);

  const renderReviewItem = (item: (typeof allReviewItems)[0]) => {
    const isUncategorized = item.effectiveThemeProgramId === "uncategorized-lane";
    const confidencePercent = Math.round(item.detection.confidence * 100);
    const rawDetectedBpm = item.detection.rawDetectedBpm ?? item.detection.detectedBpm;
    const detectionWasResolved = rawDetectedBpm !== item.detection.detectedBpm;

    const isCustomEditing = customBpmState?.trackId === item.track.id;

    const handleOpenCustom = () => {
      setCustomBpmState({ trackId: item.track.id, draft: String(item.effectiveBpm), showConfirm: false });
    };

    const handleCloseCustom = () => {
      if (customBpmState?.trackId === item.track.id) {
        setCustomBpmState(null);
      }
    };

    const handleApplyCustom = () => {
      const parsed = Number.parseFloat(customBpmState?.draft ?? String(item.effectiveBpm));
      if (Number.isFinite(parsed) && parsed > 0) {
        updateTrackReviewOverride(item.track.id, {
          bpm: Math.round(parsed),
          ignoreBpmMismatch: false,
        });
      }
      handleCloseCustom();
    };

    const handleCustomDraftChange = (value: string) => {
      setCustomBpmState((current) =>
        current ? { ...current, draft: value, showConfirm: true } : null,
      );
    };

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
              <p className="mt-1 text-xs text-white/48">原始脈衝 {Math.round(rawDetectedBpm)}，已折算</p>
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
            採用 {Math.round(item.detection.detectedBpm)}
          </button>
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

          <MoreMenu
            items={[
              ...(item.canReturnToSuggestedRoute && item.suggestedThemeProgramId
                ? []
                : [
                    {
                      label: "自訂 BPM",
                      onClick: handleOpenCustom,
                    },
                  ]),
              {
                label: "忽略警告",
                onClick: () => updateTrackReviewOverride(item.track.id, { ignoreBpmMismatch: true }),
              },
              {
                label: "清除覆核",
                onClick: () => clearTrackReviewOverride(item.track.id),
                variant: "danger",
              },
            ]}
          />
        </div>

        {isCustomEditing && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[18px] border border-white/10 bg-black/24 p-3">
            <label className="text-xs uppercase tracking-[0.24em] text-white/42" htmlFor={`custom-bpm-${item.track.id}`}>
              自訂 BPM
            </label>
            <input
              id={`custom-bpm-${item.track.id}`}
              type="number"
              inputMode="decimal"
              step="1"
              min="20"
              max="300"
              value={customBpmState?.draft ?? String(item.effectiveBpm)}
              onChange={(event) => handleCustomDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleApplyCustom();
                }

                if (event.key === "Escape") {
                  handleCloseCustom();
                }
              }}
              className="w-20 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
              placeholder="BPM"
              autoFocus
            />
            <button
              type="button"
              onClick={handleApplyCustom}
              className="rounded-full border border-cyan-300/30 bg-cyan-300/14 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/20"
            >
              寫入
            </button>
            <button
              type="button"
              onClick={handleCloseCustom}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/62 transition hover:border-white/18 hover:text-white"
            >
              取消
            </button>
          </div>
        )}
      </ReviewItemShell>
    );
  };

  return (
    <ReviewPanelShell
      eyebrow="BPM 待覆核"
      title="Metadata 與實際節拍不一致的曲目"
      description="比對偵測 BPM 與 metadata，逐首確認路線歸屬。"
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
          <StatCard label="待處理">
            <p className="text-3xl font-semibold text-white">{autoItems.length}</p>
          </StatCard>
          {showTapSection && (
            <StatCard label="Tap 校正">
              <p className="text-3xl font-semibold text-cyan-300">{tapItems.length}</p>
            </StatCard>
          )}
          <StatCard label="最近進度">
            <p className="text-sm leading-7 text-white/72">{scanProgressLabel ?? "尚未掃描"}</p>
          </StatCard>
        </>
      }
      notice={scanNotice}
      isEmpty={autoItems.length === 0 && !showTapSection}
      emptyLabel="掃描後開始逐首覆核"
    >
      {/* Auto-detect review items */}
      {autoItems.map(renderReviewItem)}

      {/* Tap-corrected section — collapsed by default */}
      {showTapSection && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setTapCorrectedCollapsed((prev) => !prev)}
            className="flex w-full items-center gap-3 rounded-[18px] border border-cyan-400/18 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100/80 transition hover:bg-cyan-400/12"
          >
            {tapCorrectedCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-cyan-300/70" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-cyan-300/70" />
            )}
            <span className="font-medium text-cyan-100">Tap 校正</span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-2 py-0.5 text-xs text-cyan-200/80">
              {tapItems.length} 首
            </span>
            <span className="ml-auto text-xs text-cyan-100/40">
              {tapCorrectedCollapsed ? "點此展開" : "點此折疊"}
            </span>
          </button>

          {!tapCorrectedCollapsed && (
            <div className="mt-3 space-y-3">
              {tapItems.map(renderReviewItem)}
            </div>
          )}
        </div>
      )}
    </ReviewPanelShell>
  );
}
