'use client';

import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="麵包屑導航" className="flex flex-wrap items-center gap-2 text-xs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 ? (
              <ChevronRight className="h-3 w-3 shrink-0 text-white/32" />
            ) : null}
            {isLast || !item.href ? (
              <span
                className={`rounded-full border px-3 py-1.5 ${
                  isLast
                    ? "border-fuchsia-400/24 bg-fuchsia-400/12 text-fuchsia-100"
                    : "border-white/10 bg-white/8 text-white/72"
                }`}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-white/72 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
