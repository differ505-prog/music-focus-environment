'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#02060b] px-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.18),transparent_28%),radial-gradient(circle_at_right,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.1),transparent_28%)]" />

      <div className="relative z-10 text-center">
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/58">404</p>
        <h1 className="mt-4 font-serif text-5xl text-white md:text-6xl">找不到這個系列</h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-white/68">
          這個系列頁面可能已被移除或網址有誤。
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-3 rounded-full border border-fuchsia-300/24 bg-fuchsia-300/12 px-6 py-3 text-sm font-medium text-fuchsia-50 transition hover:bg-fuchsia-300/18"
        >
          返回首頁
        </Link>
      </div>
    </main>
  );
}
