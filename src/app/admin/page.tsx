import type { Metadata } from "next";

import { FocusStudioApp } from "@/components/focus-studio-app";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <FocusStudioApp mode="admin" />;
}
