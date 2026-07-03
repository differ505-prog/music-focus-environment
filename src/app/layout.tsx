import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import { PlaybackProvider } from "@/components/playback-provider";
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
  title: "音樂創作與專注力環境",
  description: "提供低干擾、可長時間播放的沉浸式專注音樂與自動接續聆聽體驗。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
        <PlaybackProvider>{children}</PlaybackProvider>
      </body>
    </html>
  );
}
