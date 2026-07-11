/**
 * BPM User-Mappings 持久層
 *
 * 用途：當使用者手動「採用」某個 BPM（來自偵測或自訂）時，
 *       將該 mapping 寫入此層。之後偵測同一首曲目時，
 *       優先採用 user-confirmed BPM，而非重新分析。
 *
 * 與 detectedBpmCache 的差異：
 * - detectedBpmCache：系統自動分析結果（置信度門檻篩選）
 * - user-mappings：使用者主動確認的 BPM（最高優先級）
 */

const BPM_USER_MAPPINGS_STORAGE_KEY = "bpm-user-mappings-v1";

export type BpmUserMapping = {
  trackId: string;
  audioUrl: string;
  /** 使用者確認的 BPM（任意數值，不限 lane 範圍） */
  confirmedBpm: number;
  /** 這個 BPM 與系統偵測 BPM 是否相同 */
  matchesDetectedBpm: boolean;
  /** 建立 mapping 的時間 */
  createdAt: string;
  /** 上次觸發 feedback 的時間（用於統計） */
  lastUsedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readMappings(): Record<string, BpmUserMapping> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(BPM_USER_MAPPINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMappings(mappings: Record<string, BpmUserMapping>) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(BPM_USER_MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
}

/** 查詢特定曲目的 user-confirmed BPM（以 audioUrl 為 key）。 */
export function getUserBpmMapping(trackId: string, audioUrl: string): BpmUserMapping | null {
  const mappings = readMappings();
  return mappings[`${trackId}:${audioUrl}`] ?? null;
}

/** 寫入或更新一個 user-confirmed BPM mapping。 */
export function setUserBpmMapping(params: {
  trackId: string;
  audioUrl: string;
  confirmedBpm: number;
  matchesDetectedBpm: boolean;
}): void {
  const mappings = readMappings();
  const key = `${params.trackId}:${params.audioUrl}`;
  const now = new Date().toISOString();

  mappings[key] = {
    trackId: params.trackId,
    audioUrl: params.audioUrl,
    confirmedBpm: params.confirmedBpm,
    matchesDetectedBpm: params.matchesDetectedBpm,
    createdAt: mappings[key]?.createdAt ?? now,
    lastUsedAt: now,
  };

  writeMappings(mappings);
}

/** 移除特定曲目的 user mapping（例如：取消覆寫時）。 */
export function removeUserBpmMapping(trackId: string, audioUrl: string): void {
  const mappings = readMappings();
  const key = `${trackId}:${audioUrl}`;
  if (mappings[key]) {
    delete mappings[key];
    writeMappings(mappings);
  }
}

/** 讀取所有 user mappings（用於除錯或統計）。 */
export function readAllUserBpmMappings(): BpmUserMapping[] {
  return Object.values(readMappings());
}
