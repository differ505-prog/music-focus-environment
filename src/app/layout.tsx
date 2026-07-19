'use client';

import { Cormorant_Garamond, Manrope } from "next/font/google";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { ErrorBoundary } from "@/components/error-boundary";
import { PlaybackProvider } from "@/components/playback-provider";
import { getSiteUrl, siteDescription, siteName } from "@/lib/site-metadata";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: ["OmniSonic", "專注音樂", "沉浸式播放", "BPM", "工作音樂", "深度專注"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "/",
    title: siteName,
    siteName,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const isEmbedRoute = pathname?.startsWith("/embed") ?? false;

  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`} suppressHydrationWarning>
        <ErrorBoundary>
          {isEmbedRoute ? children : <PlaybackProvider>{children}</PlaybackProvider>}
        </ErrorBoundary>
      </body>
    </html>
  );
}
