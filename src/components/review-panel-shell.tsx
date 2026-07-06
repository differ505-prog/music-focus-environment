'use client';

import type { ReactNode } from 'react';

type ReviewPanelShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  accentColor?: 'amber' | 'rose' | 'cyan' | 'fuchsia';
  actions?: ReactNode;
  summaryCards?: ReactNode;
  notice?: string | null;
  isEmpty?: boolean;
  emptyLabel?: string;
  children?: ReactNode;
};

const accentColorMap = {
  amber: 'border-amber-300/16',
  rose: 'border-rose-300/16',
  cyan: 'border-cyan-300/16',
  fuchsia: 'border-fuchsia-400/14',
} as const;

const noticeColorMap = {
  amber: 'border-amber-300/16 bg-amber-300/8 text-amber-100/88',
  rose: 'border-rose-300/16 bg-rose-300/8 text-rose-100/88',
  cyan: 'border-cyan-300/16 bg-cyan-300/8 text-cyan-100/88',
  fuchsia: 'border-fuchsia-400/16 bg-fuchsia-400/8 text-fuchsia-100/88',
} as const;

export function ReviewPanelShell({
  eyebrow,
  title,
  description,
  accentColor = 'fuchsia',
  actions,
  summaryCards,
  notice,
  isEmpty = false,
  emptyLabel = '目前沒有項目。',
  children,
}: ReviewPanelShellProps) {
  const borderClass = accentColorMap[accentColor];
  const noticeClass = noticeColorMap[accentColor];

  return (
    <section className={`rounded-[28px] border ${borderClass} bg-black/20 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.32em] text-white/58">{eyebrow}</p>
          <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-white/68">{description}</p>
        </div>

        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      {summaryCards ? <div className="mt-5 grid gap-4 md:grid-cols-3">{summaryCards}</div> : null}

      {notice ? (
        <div className={`mt-4 rounded-[20px] border px-4 py-3 text-sm ${noticeClass}`}>
          {notice}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {isEmpty ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm leading-7 text-white/48">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

type SummaryCardProps = {
  label: string;
  children: ReactNode;
};

export function SummaryCard({ label, children }: SummaryCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[#07101a]/80 p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

type ReviewItemShellProps = {
  accentColor?: 'amber' | 'rose' | 'cyan' | 'fuchsia';
  children: ReactNode;
};

const itemBorderMap = {
  amber: 'border-amber-300/14',
  rose: 'border-rose-300/14',
  cyan: 'border-cyan-300/14',
  fuchsia: 'border-fuchsia-400/12',
} as const;

export function ReviewItemShell({ accentColor = 'fuchsia', children }: ReviewItemShellProps) {
  const borderClass = itemBorderMap[accentColor];

  return (
    <article className={`rounded-[22px] border ${borderClass} bg-[#080811]/86 p-4 text-sm text-white/74`}>
      {children}
    </article>
  );
}

type StatGridProps = {
  children: ReactNode;
};

export function StatGrid({ children }: StatGridProps) {
  return <div className="mt-4 grid gap-3 md:grid-cols-4">{children}</div>;
}

type StatCardProps = {
  label: string;
  children: ReactNode;
};

export function StatCard({ label, children }: StatCardProps) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/24 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

type ActionButtonGroupProps = {
  children: ReactNode;
};

export function ActionButtonGroup({ children }: ActionButtonGroupProps) {
  return <div className="mt-4 flex flex-wrap gap-2">{children}</div>;
}
