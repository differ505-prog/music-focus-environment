import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin"],
      },
    ],
    sitemap: [`${siteUrl.toString().replace(/\/$/, "")}/sitemap.xml`],
    host: siteUrl.toString(),
  };
}
