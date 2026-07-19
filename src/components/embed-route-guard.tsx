'use client';

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PlaybackProvider } from "@/components/playback-provider";

export function EmbedRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEmbedRoute = pathname?.startsWith("/embed") ?? false;

  if (isEmbedRoute) {
    return <>{children}</>;
  }

  return <PlaybackProvider>{children}</PlaybackProvider>;
}
