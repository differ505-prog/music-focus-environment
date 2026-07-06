'use client';

import { useCallback, useMemo } from "react";
import { ArrowRight, History } from "lucide-react";

import {
  buildTrackOverrideHistoryItems,
  clearTrackReviewOverride,
  type TrackOverrideHistoryItem,
} from "@/lib/track-review-store";

import { MoreMenu } from "@/components/more-menu";

import { useTrackReviewSync } from "@/hooks/use-track-review-sync";
import {
  ReviewItemShell,
  ReviewPanelShell,
  StatCard,
  StatGrid,
} from "@/components/review-panel-shell";
import { Chip } from "@/components/ui-system";

type OverrideHistoryListProps = Record<string, never>;

type OverrideKind = "bpm-detected" | "bpm-custom" | "bpm-tap" | "ignored" | "uncategorized" | "lane-restored";

function classifyOverrideKind(
  override: TrackOverrideHistoryItem,
): OverrideKind {
  if (override.override.ignoreBpmMismatch) {
    return "ignored";
  }

  if (override.override.themeProgramId === "uncategorized-lane") {
    return "uncategorized";
  }

  if (
    override.override.themeProgramId != null &&
    override.override.themeProgramId === override.baseThemeProgramId
  ) {
    return "lane-restored";
  }

  if (override.override.bpm != null && override.override.bpm !== override.baseBpm) {
    return "bpm-custom";
  }

  return "bpm-detected";
}

const kindLabelMap: Record<OverrideKind, { label: string; tone: "cyan" | "emerald" | "amber" | "rose" }> = {
  "bpm-detected": { label: "偵測 BPM", tone: "cyan" },
  "bpm-custom": { label: "手動輸入", tone: "cyan" },
  "bpm-tap": { label: "Tap BPM", tone: "cyan" },
  ignored: { label: "忽略警告", tone: "rose" },
  uncategorized: { label: "移到未分類", tone: "amber" },
  "lane-restored": { label: "放回原路線", tone: "emerald" },
};

function formatRelativeTime(reviewedAt: string | null): string {
  if (!reviewedAt) {
    return "時間未記錄";
  }

  const reviewedTime = Date.parse(reviewedAt);

  if (Number.isNaN(reviewedTime)) {
    return "時間未記錄";
  }

  const diffMs = Date.now() - reviewedTime;
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "剛剛";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘前`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} 小時前`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks < 4) {
    return `${diffWeeks} 週前`;
  }

  const diffMonths = Math.round(diffDays / 30);

  if (diffMonths < 12) {
    return `${diffMonths} 個月前`;
  }

  const diffYears = Math.round(diffDays / 365);
  return `${diffYears} 年前`;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} 秒`;
}

export function OverrideHistoryList(_props: OverrideHistoryListProps) {
  const refreshTick = useTrackReviewSync();
  const historyItems = useMemo(
    () => buildTrackOverrideHistoryItems(),
    [refreshTick],
  );

  const handleScrollToTrack = useCallback((trackId: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const target = document.querySelector<HTMLElement>(`[data-track-id="${trackId}"]`);

    if (!target) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-cyan-300/60", "ring-offset-2", "ring-offset-black/40");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-cyan-300/60", "ring-offset-2", "ring-offset-black/40");
    }, 1600);
  }, []);

  const handleClearOverride = useCallback((trackId: string, title: string) => {
    const isConfirmed = typeof window === "undefined" || window.confirm(`取消「${title}」的覆核紀錄？取消後若偵測結果與 metadata 不一致，會重新出現在 BPM 覆核面板。`);

    if (!isConfirmed) {
      return;
    }

    clearTrackReviewOverride(trackId);
  }, []);

  return (
    <ReviewPanelShell
      accentColor="cyan"
      eyebrow="覆核紀錄"
      title="我過去校正過的紀錄"
      description="列出所有已寫入 localStorage 的覆核決策，可以回頭檢查、取消、跳到對應歌曲卡片再次試聽。"
      summaryCards={
        <>
          <StatCard label="已覆核曲目">
            <p className="text-2xl font-semibold text-white">{historyItems.length}</p>
            <p className="mt-1 text-xs text-white/48">包含採用偵測值、手動輸入、忽略警告、移到未分類</p>
          </StatCard>
          <StatCard label="最新活動">
            <p className="text-2xl font-semibold text-white">
              {historyItems[0] ? formatRelativeTime(historyItems[0].reviewedAt) : "—"}
            </p>
            <p className="mt-1 text-xs text-white/48">依 reviewedAt 時間倒序排列</p>
          </StatCard>
          <StatCard label="對應卡片">
            <p className="text-2xl font-semibold text-white">{historyItems.length}</p>
            <p className="mt-1 text-xs text-white/48">點「跳到歌曲卡片」會平滑滾動並高亮 1.6 秒</p>
          </StatCard>
        </>
      }
      isEmpty={historyItems.length === 0}
      emptyLabel="目前沒有任何覆核紀錄。先在 BPM 覆核面板採用偵測值或忽略警告，紀錄就會出現在這裡。"
    >
      {historyItems.map((item) => {
        const kind = classifyOverrideKind(item.override as never);
        const kindInfo = kindLabelMap[kind];
        const bpmChanged = item.override.bpm != null && item.override.bpm !== item.baseBpm;
        const programChanged =
          item.override.themeProgramId != null && item.override.themeProgramId !== item.baseThemeProgramId;

        return (
          <ReviewItemShell key={`history-${item.track.id}`} accentColor="cyan">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                  {item.effectiveProgramTitle}
                  {item.baseThemeProgramId && item.baseThemeProgramId !== item.effectiveThemeProgramId ? (
                    <span className="ml-2 text-white/38">原路線：{item.baseProgramTitle}</span>
                  ) : null}
                </p>
                <h3 className="mt-2 text-lg font-medium text-white">{item.track.title}</h3>
              </div>
              <Chip variant={kindInfo.tone}>
                <History className="h-3.5 w-3.5" />
                {kindInfo.label}
              </Chip>
            </div>

            <StatGrid>
              {bpmChanged ? (
                <StatCard label="BPM 變更">
                  <p className="text-base font-medium text-white">
                    <span className="text-white/52">{item.baseBpm}</span>
                    <ArrowRight className="mx-2 inline h-3.5 w-3.5 align-middle text-white/52" />
                    <span className="text-cyan-100">{item.effectiveBpm}</span>
                  </p>
                  <p className="mt-1 text-xs text-white/48">現用 {item.effectiveBpm} BPM</p>
                </StatCard>
              ) : (
                <StatCard label="BPM">
                  <p className="text-2xl font-semibold text-white">{item.effectiveBpm}</p>
                  <p className="mt-1 text-xs text-white/48">未調整 BPM</p>
                </StatCard>
              )}
              <StatCard label="路線決策">
                <p className="text-sm font-medium text-white">
                  {programChanged
                    ? item.override.themeProgramId === "uncategorized-lane"
                      ? "已移到未分類"
                      : `已換至 ${item.effectiveProgramTitle}`
                    : "維持原路線"}
                </p>
                <p className="mt-1 text-xs text-white/48">
                  {programChanged ? `原本：${item.baseProgramTitle}` : "路線未變更"}
                </p>
              </StatCard>
              <StatCard label="Mix In">
                <p className="text-2xl font-semibold text-white">
                  {item.mixInChanged ? formatSeconds(item.effectiveMixInPointSeconds) : "—"}
                </p>
                <p className="mt-1 text-xs text-white/48">
                  {item.mixInChanged ? `原 ${formatSeconds(item.baseMixInPointSeconds)}` : "未調整 Mix In"}
                </p>
              </StatCard>
              <StatCard label="覆核時間">
                <p className="text-base font-medium text-white">{formatRelativeTime(item.reviewedAt)}</p>
                <p className="mt-1 text-xs text-white/48">localStorage 紀錄</p>
              </StatCard>
            </StatGrid>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleScrollToTrack(item.track.id)}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100/84 transition hover:bg-cyan-300/16"
              >
                跳到歌曲卡片
              </button>
              <MoreMenu
                items={[
                  {
                    label: "取消覆核紀錄",
                    onClick: () => handleClearOverride(item.track.id, item.track.title),
                    variant: "danger",
                  },
                ]}
              />
            </div>
          </ReviewItemShell>
        );
      })}
    </ReviewPanelShell>
  );
}