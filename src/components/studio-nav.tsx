'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNavItems = [
  {
    href: "/",
    label: "前台",
    description: "客人播放頁",
  },
  {
    href: "/admin",
    label: "後台",
    description: "內容管理",
  },
];

export function StudioNav() {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith("/admin");

  if (!isAdminPage) {
    return (
      <nav className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/78 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
        >
          沉浸式專注音樂
        </Link>
      </nav>
    );
  }

  return (
    <nav className="mb-6 flex flex-wrap gap-3">
      {adminNavItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              isActive
                ? "border-fuchsia-300/45 bg-fuchsia-400/18 text-fuchsia-50 shadow-[0_0_24px_rgba(217,70,239,0.22)]"
                : "border-white/12 bg-white/8 text-white/72 hover:border-white/20 hover:bg-white/12 hover:text-white"
            }`}
          >
            <span className="font-medium">{item.label}</span>
            <span className="ml-2 text-white/50">{item.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
