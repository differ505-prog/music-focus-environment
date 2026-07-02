'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "前台",
    description: "客戶可見播放頁",
  },
  {
    href: "/admin",
    label: "後台",
    description: "提示詞與內部資料",
  },
];

export function StudioNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-3">
      {navItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              isActive
                ? "border-cyan-300/45 bg-cyan-300/16 text-cyan-50 shadow-[0_0_24px_rgba(116,227,255,0.14)]"
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
