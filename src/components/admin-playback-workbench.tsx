'use client';

import { Headphones } from "lucide-react";

import { Chip } from "@/components/ui-system";
import {
  ReviewPanelShell,
  StatCard,
  StatGrid,
} from "@/components/review-panel-shell";

import { usePlayback } from "@/components/playback-provider";
import { useTrackReviewSync } from "@/hooks/use-track-review-sync";
import { LiveBpmOverrideCard } from "@/components/live-bpm-override-card";

import type { ThemeProgram } from "@/types/music";
import { readTrackReviewOverrides } from "@/lib/track-review-store";

type AdminPlaybackWorkbenchProps = {
  programs: ThemeProgram[];
};

function summarizeOverrideCount(trackId: string | null): number {
  if (!trackId) {
    return 0;
  }

  const overrides = readTrackReviewOverrides();
  return overrides[trackId] ? 1 : 0;
}

export function AdminPlaybackWorkbench({ programs }: AdminPlaybackWorkbenchProps) {
  const { currentTrack, playback } = usePlayback();
  const refreshTick = useTrackReviewSync();

  const sessionSummary = currentTrack
    ? playback.isCrossfading
      ? "Crossfade 進行中"
      : playback.isPlaying
        ? "穩定播放中"
        : "待命"
    : "等待選歌";

  void refreshTick;

  return (
    <ReviewPanelShell
      accentColor="cyan"
      eyebrow="後台播放工作台"
      title="邊聽邊校正的工作台"
      description="前台 GlobalPlayer 與現在播放的歌曲共用。當按下 Tap BPM 或寫入自訂 BPM，前台下次載入就會直接套用整理後的結果。"
      summaryCards={
        <>
          <StatCard label="現在播放">
            <p className="text-2xl font-semibold text-white">
              {currentTrack ? currentTrack.title : "尚未播放"}
            </p>
            <p className="mt-1 text-xs text-white/48">{sessionSummary}</p>
          </StatCard>
          <StatCard label="目前路線">
            <p className="text-2xl font-semibold text-white">
              {currentTrack?.themeProgramId
                ? programs.find((program) => program.id === currentTrack.themeProgramId)?.title ?? "未分類路線"
                : "未指派"}
            </p>
            <p className="mt-1 text-xs text-white/48">與 metadata BPM 同步顯示</p>
          </StatCard>
          <StatCard label="本曲覆寫">
            <p className="text-2xl font-semibold text-white">{summarizeOverrideCount(currentTrack?.id ?? null)}</p>
            <p className="mt-1 text-xs text-white/48">已寫入 localStorage 的覆核決策</p>
          </StatCard>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-cyan-300/14 bg-cyan-300/8 p-4">
        <div className="flex items-center gap-3">
          <Headphones className="h-5 w-5 text-cyan-100/86" />
          <p className="text-sm leading-6 text-cyan-100/86">
            從卡片按「播放」或使用前台播放列切歌，這裡會自動同步目前曲目，並打開即時校正工具。
          </p>
        </div>
        <Chip variant="cyan">
          前台播放 ↔ 後台工作台 雙向同步
        </Chip>
      </div>

      <StatGrid>
        <StatCard label="即時 BPM 工具">
          <p className="text-sm leading-6 text-white/72">
            用 Tap BPM、自訂數字、或採用偵測結果寫入覆寫，前台會立刻同步。
          </p>
        </StatCard>
        <StatCard label="何時取消覆寫">
          <p className="text-sm leading-6 text-white/72">
            覺得 metadata 比較準、或換路線之後音效更順，按「取消本次覆寫」即可。
          </p>
        </StatCard>
        <StatCard label="批量建議">
          <p className="text-sm leading-6 text-white/72">
            整輪播完一遍就能把 4-8 首待校曲目跑完，全部寫入後回到 BPM 覆核面板看是否有遺漏。
          </p>
        </StatCard>
      </StatGrid>

      <LiveBpmOverrideCard currentTrack={currentTrack} programs={programs} />
    </ReviewPanelShell>
  );
}
