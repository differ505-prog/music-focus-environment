'use client';

import { useState } from "react";
import { Headphones, Radio, Sliders } from "lucide-react";

import { ReviewPanelShell } from "@/components/review-panel-shell";
import { StatCard } from "@/components/review-panel-shell";

import { usePlayback } from "@/components/playback-provider";
import { useTrackReviewSync } from "@/hooks/use-track-review-sync";
import { LiveBpmOverrideCard } from "@/components/live-bpm-override-card";
import { OverrideHistoryList } from "@/components/override-history-list";

import type { ThemeProgram } from "@/types/music";
import { readTrackReviewOverrides } from "@/lib/track-review-store";

type AdminPlaybackWorkbenchProps = {
  programs: ThemeProgram[];
  tracks: Parameters<typeof OverrideHistoryList>[0];
};

type TabId = "summary" | "calibrate" | "history";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "summary", label: "摘要", icon: <Radio className="h-3.5 w-3.5" /> },
  { id: "calibrate", label: "即時校正", icon: <Sliders className="h-3.5 w-3.5" /> },
  { id: "history", label: "覆核紀錄", icon: <Headphones className="h-3.5 w-3.5" /> },
];

function summarizeOverrideCount(trackId: string | null): number {
  if (!trackId) {
    return 0;
  }

  const overrides = readTrackReviewOverrides();
  return overrides[trackId] ? 1 : 0;
}

export function AdminPlaybackWorkbench({ programs, tracks }: AdminPlaybackWorkbenchProps) {
  const { currentTrack, playback } = usePlayback();
  const refreshTick = useTrackReviewSync();
  const [activeTab, setActiveTab] = useState<TabId>("summary");

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
    >
      <div className="mt-4">
        <div className="flex gap-1 rounded-[20px] border border-white/8 bg-black/24 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[16px] px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border border-cyan-400/24 bg-cyan-400/14 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.12)]"
                  : "border border-transparent bg-transparent text-white/52 hover:border-white/10 hover:text-white/78"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "summary" ? (
            <div className="grid gap-4 md:grid-cols-3">
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
            </div>
          ) : null}

          {activeTab === "calibrate" ? (
            <div className="flex flex-col gap-4">
              {currentTrack ? (
                <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-cyan-300/14 bg-cyan-300/8 p-4">
                  <Headphones className="h-5 w-5 text-cyan-100/86 shrink-0" />
                  <p className="text-sm leading-6 text-cyan-100/86">
                    <span className="font-medium text-cyan-50">{currentTrack.title}</span> 正在播放，邊聽邊校正。
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-white/8 bg-white/4 p-4">
                  <p className="text-sm leading-6 text-white/52">
                    從卡片按「播放」或使用前台播放列切歌，這裡會自動同步目前曲目，並打開即時校正工具。
                  </p>
                </div>
              )}
              <LiveBpmOverrideCard currentTrack={currentTrack} programs={programs} />
            </div>
          ) : null}

          {activeTab === "history" ? (
            <OverrideHistoryList tracks={tracks} />
          ) : null}
        </div>
      </div>
    </ReviewPanelShell>
  );
}
