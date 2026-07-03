import type { Metadata } from "next";

import { AdminStudioPage } from "@/components/admin-studio-page";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminStudioPage />;
}
