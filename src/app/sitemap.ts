import type { MetadataRoute } from "next";

import { trackCollections } from "@/data/music-assets";
import { getSiteUrl } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return [
    {
      url: new URL("/", siteUrl).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...trackCollections.map((collection) => ({
      url: new URL(`/collections/${collection.id}`, siteUrl).toString(),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
