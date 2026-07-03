export const siteName = "OmniSonic";
export const siteDescription = "OmniSonic 提供低干擾、可長時間播放的沉浸式音樂路線與自動接續聆聽體驗。";

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  return new URL(normalizedUrl);
}
