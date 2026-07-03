'use client';

import { useMemo, useState } from "react";
import { Loader2, Upload, Waves } from "lucide-react";

import { bpmOptions } from "@/data/music-assets";
import { analyzeAudioBufferForBpm, type BpmAnalysis } from "@/lib/bpm-analyzer";

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
    <section className="rounded-[28px] border border-amber-300/16 bg-black/20 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-100/58">BPM Analyzer Lab</p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">匯入後半自動 BPM 校正</h2>
          <p className="mt-3 text-sm leading-7 text-white/68">
            先把音檔拖進來，系統會先估 BPM、提示信心值，再讓你用 x2、÷2 或手動改值確認後寫回上架流程。這是高效率而非盲信演算法的工作台。
          </p>
        </div>

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
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">推薦工作流</p>
          <p className="mt-3 text-sm leading-7 text-white/72">
            1. 上傳音檔 2. 看建議 BPM 與信心值 3. 用 x2 / ÷2 修正倍速誤判 4. 參考車道建議寫回 Track。
          </p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">車道範圍</p>
          <p className="mt-3 text-sm leading-7 text-white/72">{bpmOptions.join(" / ")} BPM</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">狀態摘要</p>
          <p className="mt-3 text-sm leading-7 text-white/72">
            {summary
              ? `已分析 ${summary.fileCount} 首，其中 ${summary.exactLaneCount} 首已直接落在建議車道。`
              : "尚未分析音檔。"}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-[18px] border border-rose-300/18 bg-rose-300/10 p-4 text-sm text-rose-100/88">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {items.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm leading-7 text-white/48">
            上傳本機音檔後，這裡會顯示建議 BPM、候選值、信心分數與車道建議。
          </div>
        ) : (
          items.map((item) => {
            const nearestLane = bpmOptions.reduce((closest, candidate) => {
              return Math.abs(candidate - item.adjustedBpm) < Math.abs(closest - item.adjustedBpm)
                ? candidate
                : closest;
            }, bpmOptions[0]);

            return (
              <article
                key={item.id}
                className="rounded-[22px] border border-white/10 bg-[#050811]/82 p-4 text-sm text-white/74"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{item.fileSizeLabel}</p>
                    <h3 className="mt-2 text-lg font-medium text-white">{item.fileName}</h3>
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
                    {item.durationSeconds}s
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">建議 BPM</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.result.estimatedBpm}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">信心值</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatConfidence(item.result.confidence)}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">建議車道</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.result.laneSuggestion}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Peak 數</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.result.peakCount}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-amber-300/12 bg-[#151108]/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">人工確認區</p>
                      <p className="mt-2 text-sm leading-6 text-amber-50/76">
                        若偵測到倍速誤判，可用 x2 / ÷2 快速修正；確認後以最近車道作為上架 BPM 參考。
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
                        對齊車道 {nearestLane}
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
                      最近車道：{nearestLane}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-white/8 bg-black/24 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">候選 BPM</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.result.candidates.map((candidate) => (
                      <span
                        key={`${item.id}-${candidate.bpm}`}
                        className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/16 bg-fuchsia-400/10 px-3 py-1 text-xs text-fuchsia-50/84"
                      >
                        <Waves className="h-3.5 w-3.5" />
                        {candidate.bpm} BPM
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
