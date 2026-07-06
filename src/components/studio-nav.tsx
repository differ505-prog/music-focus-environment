'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Moon, Sun } from "lucide-react";

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
  const router = useRouter();
  const isAdminPage = pathname.startsWith("/admin");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("omnisonic-theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("omnisonic-theme", next);
  }, [theme]);

  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSecretClickState = () => {
    clickCountRef.current = 0;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  };

  useEffect(() => resetSecretClickState, []);

  const handleSecretClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    clickCountRef.current += 1;

    if (clickCountRef.current >= 3) {
      resetSecretClickState();
      router.push("/admin");
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      const shouldReturnHome = pathname !== "/";

      resetSecretClickState();

      if (shouldReturnHome) {
        router.push("/");
      }
    }, 650);
  };

  if (!isAdminPage) {
    return (
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          onClick={handleSecretClick}
          className="select-none rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/78 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
        >
          OmniSonic
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "切換到淺色模式" : "切換到深色模式"}
          className="rounded-full border border-white/12 bg-white/8 p-2 text-white/78 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </nav>
    );
  }

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3">
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
              <span className="ml-2 truncate text-white/50">{item.description}</span>
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "切換到淺色模式" : "切換到深色模式"}
        className="rounded-full border border-white/12 bg-white/8 p-2 text-white/78 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
      >
        {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
    </nav>
  );
}
