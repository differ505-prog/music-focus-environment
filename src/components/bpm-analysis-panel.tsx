'use client';

import { useMemo, useState } from "react";
import { Loader2, Upload, Waves } from "lucide-react";

import { bpmOptions } from "@/data/music-assets";
import { analyzeAudioBufferForBpm, type BpmAnalysis } from "@/lib/bpm-analyzer";

import { ReviewItemShell, ReviewPanelShell, StatCard, StatGrid } from "@/components/review-panel-shell";
import { Chip } from "@/components/ui-system";

type AnalysisItem = {
  id: string;
  fileName: string;
  fileSizeLabel: string;
  durationSeconds: number;
  result: BpmAnalysis;
  adjustedBpm: number;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function BpmAnalysisPanel() {
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    const exactLaneCount = items.filter((item) => item.adjustedBpm === item.result.laneSuggestion).length;

    return {
      fileCount: items.length,
      exactLaneCount,
    };
  }, [items]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const AudioContextClass = window.AudioContext;

      if (!AudioContextClass) {
        throw new Error("目前瀏覽器不支援 AudioContext，無法進行 BPM 分析。");
      }

      const context = new AudioContextClass();
      const nextItems: AnalysisItem[] = [];

      for (const file of Array.from(fileList)) {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
        const result = analyzeAudioBufferForBpm(audioBuffer, bpmOptions);

        nextItems.push({
          id: `${file.name}-${file.lastModified}`,
          fileName: file.name,
          fileSizeLabel: formatFileSize(file.size),
          durationSeconds: Number(audioBuffer.duration.toFixed(1)),
          result,
          adjustedBpm: result.estimatedBpm,
        });
      }

      await context.close();
      setItems(nextItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BPM 分析失敗，請改用其他音檔再試一次。";
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateAdjustedBpm = (id: string, bpm: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, adjustedBpm: Math.max(1, Math.round(bpm)) } : item)),
    );
  };

  return (
    <ReviewPanelShell
      eyebrow="BPM 檢查"
      title="匯入後確認 BPM"
      description="上傳音檔，系統估算 BPM，再以 x2 / ÷2 或手動校正。"
      accentColor="amber"
      actions={
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-amber-300/24 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-50 transition hover:bg-amber-300/14">
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isAnalyzing ? "分析中..." : "上傳音檔分析"}
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(event) => void handleFilesSelected(event.target.files)}
            className="hidden"
          />
        </label>
      }
      summaryCards={
        <>
          <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">使用步驟</p>
            <p className="mt-3 text-sm leading-7 text-white/72">上傳 → 估算 → x2/÷2 校正 → 寫回資料。</p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">可用範圍</p>
            <p className="mt-3 text-sm leading-7 text-white/72">{bpmOptions.join(" / ")} BPM</p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">狀態摘要</p>
            <p className="mt-3 text-sm leading-7 text-white/72">
              {summary
                ? `已分析 ${summary.fileCount} 首，其中 ${summary.exactLaneCount} 首已落在建議範圍。`
                : "尚未分析音檔。"}
            </p>
          </div>
        </>
      }
      notice={errorMessage}
      isEmpty={items.length === 0}
      emptyLabel="上傳音檔後，這裡會顯示估算 BPM、可信度與建議範圍。"
    >
      {items.length > 0 && items.map((item) => {
            const nearestLane = bpmOptions.reduce((closest, candidate) => {
              return Math.abs(candidate - item.adjustedBpm) < Math.abs(closest - item.adjustedBpm)
                ? candidate
                : closest;
            }, bpmOptions[0]);

            return (
              <ReviewItemShell key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{item.fileSizeLabel}</p>
                    <h3 className="mt-2 text-lg font-medium text-white">{item.fileName}</h3>
                  </div>
                  <Chip variant="cyan">{item.durationSeconds}s</Chip>
                </div>

                <StatGrid>
                  <StatCard label="建議 BPM">
                    <p className="text-2xl font-semibold text-white">{item.result.estimatedBpm}</p>
                  </StatCard>
                  <StatCard label="可信度">
                    <p className="text-2xl font-semibold text-white">{formatConfidence(item.result.confidence)}</p>
                  </StatCard>
                  <StatCard label="建議範圍">
                    <p className="text-2xl font-semibold text-white">{item.result.laneSuggestion}</p>
                  </StatCard>
                  <StatCard label="節拍點數">
                    <p className="text-2xl font-semibold text-white">{item.result.peakCount}</p>
                  </StatCard>
                </StatGrid>

                <div className="mt-4 rounded-[18px] border border-amber-300/12 bg-[#151108]/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">人工確認</p>
                      <p className="mt-2 text-sm leading-6 text-amber-50/76">
                        如果節奏抓錯，可用 x2 或 ÷2 修正。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateAdjustedBpm(item.id, item.adjustedBpm / 2)}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/74 transition hover:bg-white/12"
                      >
                        ÷2
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAdjustedBpm(item.id, item.adjustedBpm * 2)}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/74 transition hover:bg-white/12"
                      >
                        x2
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAdjustedBpm(item.id, nearestLane)}
                        className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/16"
                      >
                        對齊 {nearestLane}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/82">
                      目前確認 BPM：{item.adjustedBpm}
                    </div>
                    <label className="text-xs uppercase tracking-[0.2em] text-white/45">
                      手動輸入
                      <input
                        type="number"
                        min={1}
                        value={item.adjustedBpm}
                        onChange={(event) => updateAdjustedBpm(item.id, Number(event.target.value))}
                        className="ml-3 w-24 rounded-full border border-white/12 bg-[#04070c] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/30"
                      />
                    </label>
                    <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100/84">
                      最近建議：{nearestLane}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-white/8 bg-black/24 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">候選值</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.result.candidates.map((candidate) => (
                      <Chip key={`${item.id}-${candidate.bpm}`} variant="fuchsia">
                        <Waves className="h-3.5 w-3.5" />
                        {candidate.bpm} BPM
                      </Chip>
                    ))}
                  </div>
                </div>
              </ReviewItemShell>
            );
          })}
    </ReviewPanelShell>
  );
}
