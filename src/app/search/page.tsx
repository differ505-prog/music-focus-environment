'use client';

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { AppSceneShell } from "@/components/app-scene-shell";
import { MediaCard } from "@/components/media-card";
import { usePlayback } from "@/components/playback-provider";
import { trackCollections, trackBatches } from "@/data/music-assets";
import { buildMergedBpmOptions } from "@/lib/bpm-lanes";
import { useRuntimeTracks } from "@/hooks/use-runtime-tracks";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  score: number;
};

const RECENT_SEARCHES_KEY = "omnisonic-recent-searches";

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  const existing = getRecentSearches();
  const next = [query, ...existing.filter((item) => item !== query)].slice(0, 8);
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

function removeRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  const existing = getRecentSearches();
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(existing.filter((item) => item !== query)));
}

function clearAllRecentSearches() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RECENT_SEARCHES_KEY);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function searchScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.includes(q)) return 70;

  const qTokens = tokenize(q);
  const tTokens = tokenize(t);
  const matched = qTokens.filter((qt) => tTokens.some((tt) => tt.startsWith(qt) || tt.includes(qt)));

  if (matched.length === qTokens.length) return 60;
  if (matched.length > 0) return (matched.length / qTokens.length) * 40;

  return 0;
}

export default function SearchPage() {
  const tracks = useRuntimeTracks();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [activeBpms, setActiveBpms] = useState<number[]>([]);
  const [activeMoods, setActiveMoods] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const { selectedIds, toggleAsset, playTrack } = usePlayback();

  const rawBpms = useMemo(() => Array.from(new Set(tracks.map((t) => t.bpm))).sort((a, b) => a - b), [tracks]);
  const bpmGroups = buildMergedBpmOptions(rawBpms, activeBpms);

  const allMoodTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const track of tracks) {
      for (const tag of track.moodTags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [tracks]);

  const results = useMemo<SearchResult[]>(() => {
    const trimmed = query.trim();
    const hasQuery = trimmed.length >= 2;

    const candidates = hasQuery
      ? tracks
          .map((track) => {
            const fields: Array<[string, number]> = [
              [track.title, 30],
              [track.copy.descriptionZh, 20],
              [track.copy.descriptionEn, 15],
              [track.copy.themeScenario, 10],
              [track.moodTags.join(" "), 15],
              [`${track.bpm} BPM`, 10],
            ];
            const maxScore = fields.reduce((sum, [, w]) => sum + w, 0);
            const rawScore = fields.reduce((sum, [field, weight]) => sum + searchScore(trimmed, field) * weight, 0);
            return { track, score: Math.round((rawScore / maxScore) * 100) };
          })
          .filter((item) => item.score >= 25)
          .sort((a, b) => b.score - a.score)
          .slice(0, 48)
          .map((item) => item.track)
      : tracks;

    const filtered = candidates.filter((track) => {
      const bpmMatch = activeBpms.length === 0 || activeBpms.includes(track.bpm);
      const moodMatch =
        activeMoods.length === 0 ||
        activeMoods.every((mood) => track.moodTags.some((tag) => tag.toLowerCase().includes(mood.toLowerCase())));
      return bpmMatch && moodMatch;
    });

    return filtered.map((track) => {
      const collectionTitle = track.collectionIds
        ?.map((id) => trackCollections.find((c) => c.id === id)?.title)
        .filter(Boolean)
        .join("、");

      return {
        id: track.id,
        title: track.title,
        subtitle: collectionTitle ?? "獨立曲目",
        score: 100,
      };
    });
  }, [query, tracks, activeBpms, activeMoods]);

  const hasResults = results.length > 0;
  const showEmpty = (query.trim().length >= 2 || activeBpms.length > 0 || activeMoods.length > 0) && !hasResults;
  const activeFilterCount = activeBpms.length + activeMoods.length;

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed.length < 2) return;
      addRecentSearch(trimmed);
      setRecentSearches(getRecentSearches());
    },
    [query],
  );

  const handleRecentClick = useCallback((term: string) => {
    setQuery(term);
  }, []);

  const handleRemoveRecent = useCallback(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearRecent = useCallback(() => {
    clearAllRecentSearches();
    setRecentSearches([]);
  }, []);

  const toggleBpms = useCallback((bpms: number[]) => {
    setActiveBpms((current) => {
      const newSet = new Set(current);
      const allActive = bpms.every((b) => newSet.has(b));
      if (allActive) {
        bpms.forEach((b) => newSet.delete(b));
      } else {
        bpms.forEach((b) => newSet.add(b));
      }
      return Array.from(newSet);
    });
  }, []);

  const toggleMood = useCallback((mood: string) => {
    setActiveMoods((current) =>
      current.includes(mood) ? current.filter((m) => m !== mood) : [...current, mood],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveBpms([]);
    setActiveMoods([]);
  }, []);

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  return (
    <AppSceneShell
      eyebrow="搜尋"
      title="搜尋音樂"
      description="找一首適合你現在狀態的音樂。"
      bottomPaddingClassName="pb-32 md:pb-40"
    >
      <div className="mt-6">
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/42" />
              <input
                type="search"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜尋標題、情緒、場景..."
                autoComplete="off"
                autoFocus
                className="w-full rounded-[28px] border border-white/10 bg-white/8 py-4 pl-14 pr-14 text-base text-white shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl placeholder:text-white/36 focus:border-fuchsia-400/32 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/16"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleSearch("")}
                  aria-label="清除搜尋"
                  className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/42 transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={`shrink-0 rounded-full border p-3 text-white transition ${
                showFilters || activeFilterCount > 0
                  ? "border-fuchsia-400/40 bg-fuchsia-400/18 text-fuchsia-50"
                  : "border-white/10 bg-white/8 hover:bg-white/12"
              }`}
              aria-label="切換篩選面板"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-400/50 bg-fuchsia-500 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </form>
      </div>

      {/* Facet Filters */}
      {showFilters ? (
        <div className="mt-4 rounded-[24px] border border-fuchsia-400/14 bg-black/20 p-5 backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-white/52">BPM 篩選</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-fuchsia-400/72 transition hover:text-fuchsia-300"
              >
                清除全部
              </button>
            )}
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {bpmGroups.map((group) => {
              const isActive = group.isSelected;
              const isPartial = group.isPartial;
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => toggleBpms(group.values)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-fuchsia-400/70 bg-fuchsia-400/18 text-fuchsia-50 shadow-[0_0_20px_rgba(217,70,239,0.2)]"
                      : isPartial
                        ? "border-amber-300/50 bg-amber-400/14 text-amber-100"
                        : "border-white/10 bg-white/8 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  }`}
                  aria-pressed={isActive}
                >
                  {group.type === "range" ? `${group.label} BPM` : `${group.label} BPM`}
                </button>
              );
            })}
          </div>

          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/52">情緒標籤</p>
          <div className="flex flex-wrap gap-2">
            {allMoodTags.map((mood) => {
              const isActive = activeMoods.includes(mood);
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => toggleMood(mood)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    isActive
                      ? "border-cyan-400/60 bg-cyan-400/14 text-cyan-50"
                      : "border-white/10 bg-white/6 text-white/64 hover:border-white/18 hover:bg-white/10 hover:text-white/80"
                  }`}
                  aria-pressed={isActive}
                >
                  {mood}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Results Count Bar */}
      {(query.trim().length >= 2 || activeFilterCount > 0) && hasResults ? (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-white/48">
            {activeFilterCount > 0
              ? `符合篩選 ${results.length} 首${query.trim().length >= 2 ? ` · 關鍵詞「${query.trim()}」` : ""}`
              : `找到 ${results.length} 個結果`}
          </p>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeBpms.map((bpm) => (
                <button
                  key={bpm}
                  type="button"
                  onClick={() => toggleBpms([bpm])}
                  className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/12 px-3 py-1 text-[11px] text-fuchsia-200 transition hover:border-fuchsia-400/60"
                >
                  {bpm} BPM
                  <X className="h-3 w-3" />
                </button>
              ))}
              {activeMoods.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => toggleMood(mood)}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/12 px-3 py-1 text-[11px] text-cyan-200 transition hover:border-cyan-400/60"
                >
                  {mood}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Results Grid */}
      {hasResults ? (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => {
            const track = trackMap.get(result.id);
            if (!track) return null;
            return (
              <MediaCard
                key={track.id}
                asset={track}
                checked={selectedIds.includes(track.id)}
                isCurrent={false}
                isNext={false}
                onToggle={toggleAsset}
                onPlayTrack={playTrack}
              />
            );
          })}
        </div>
      ) : null}

      {/* Empty State */}
      {showEmpty ? (
        <div className="mt-16 text-center">
          <div className="mx-auto max-w-sm rounded-[28px] border border-white/10 bg-white/6 p-8">
            <Search className="mx-auto mb-4 h-10 w-10 text-white/28" />
            <p className="font-serif text-xl text-white">找不到結果</p>
            <p className="mt-3 text-sm leading-6 text-white/56">
              {activeFilterCount > 0
                ? "沒有曲目同時符合所有選取的 BPM 或情緒條件，試著減少篩選。"
                : `找不到「${query.trim()}」相關的曲目。`}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["專注", "放鬆", "90 BPM", "110 BPM"].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setQuery(suggestion);
                    setActiveBpms([]);
                    setActiveMoods([]);
                  }}
                  className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/62 transition hover:border-fuchsia-400/24 hover:bg-fuchsia-400/10 hover:text-fuchsia-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Recent Searches */}
      {recentSearches.length > 0 && !query && activeFilterCount === 0 ? (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-white/48">最近搜尋</p>
            <button
              type="button"
              onClick={handleClearRecent}
              className="text-xs text-white/36 transition hover:text-white/56"
            >
              清除全部
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleRecentClick(term)}
                className="group relative rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72 transition hover:border-fuchsia-400/24 hover:bg-fuchsia-400/10 hover:text-fuchsia-50"
              >
                <span className="pr-6">{term}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentSearch(term);
                    handleRemoveRecent();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-white/36 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Browse Collections (when no query) */}
      {!query && activeFilterCount === 0 ? (
        <div className="mt-10">
          <p className="mb-5 text-xs uppercase tracking-[0.3em] text-white/48">瀏覽系列</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {trackCollections.map((collection) => (
              <Link
                key={collection.id}
                href={`/collections/${collection.id}`}
                className="group rounded-[24px] border border-white/10 bg-white/6 p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-400/20 hover:bg-fuchsia-400/8"
              >
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/48">{collection.label}</p>
                <h3 className="mt-2 font-serif text-2xl text-white">{collection.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/62">{collection.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/52">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{collection.heroMetric}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    BPM {collection.bpmFocus.join(" / ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/48">瀏覽批次</p>
            <div className="flex flex-wrap gap-2">
              {trackBatches.map((batch) => (
                <Link
                  key={batch.id}
                  href="/"
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72 transition hover:border-cyan-400/24 hover:bg-cyan-400/10 hover:text-cyan-50"
                >
                  {batch.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AppSceneShell>
  );
}
