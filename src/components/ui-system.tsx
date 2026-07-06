'use client';

import type { ReactNode } from 'react';

type SmartPlaceholderProps = {
  /** 寬度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 背景色（預設 fuchsia/10） */
  bgColor?: string;
  /** 文字色（預設 white/60） */
  textColor?: string;
  /** 圖片編號或描述 */
  label: string;
  /** AI 生圖提示詞（將顯示在圖上供後續複製） */
  aiPrompt?: string;
  /** 額外 className */
  className?: string;
};

/**
 * Smart Placeholder Component
 * 遵循 CONSTITUTION Rule #5：智慧佔位圖
 * 使用 placehold.co 格式，附帶 AI 生圖提示詞供後續 Midjourney 算圖
 */
export function SmartPlaceholder({
  width = 800,
  height = 450,
  bgColor = '1a051a',
  textColor = 'ffffff',
  label,
  aiPrompt,
  className = '',
}: SmartPlaceholderProps) {
  const encodedLabel = encodeURIComponent(label);
  const placeholderUrl = `https://placehold.co/${width}x${height}/${bgColor}/${textColor}?text=${encodedLabel}`;

  return (
    <div className={`relative overflow-hidden rounded-[--radius-lg] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={placeholderUrl}
        alt={`Placeholder: ${label}`}
        width={width}
        height={height}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {/* AI Prompt 浮層（滑鼠懸停顯示） */}
      {aiPrompt && (
        <div className="group absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 hover:opacity-100">
          <div className="max-w-[90%] rounded-[--radius-md] border border-white/20 bg-black/80 p-4 text-center backdrop-blur-xl">
            <p className="mb-2 text-xs uppercase tracking-[0.28em] text-white/50">AI 生圖提示詞</p>
            <p className="font-mono text-sm leading-relaxed text-white/90">{aiPrompt}</p>
            <p className="mt-3 text-xs text-white/40">提示：可複製此提示詞至 Midjourney 生成圖片</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* === 共用佈局元件 === */

/** 毛玻璃卡片容器 */
export function GlassCard({
  children,
  className = '',
  hoverable = false,
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-[--radius-lg] border border-[--color-border-subtle] 
        bg-[--color-surface-glass] p-4 shadow-[0_28px_90px_rgba(3,7,18,0.48)] backdrop-blur-2xl
        ${hoverable ? 'transition hover:-translate-y-0.5 hover:bg-[--color-surface-glass-hover]' : ''}
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(192,38,211,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_40%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** 狀態晶片（Chip） */
export function Chip({
  children,
  variant = 'default',
  className = '',
}: {
  children: ReactNode;
  variant?: 'default' | 'fuchsia' | 'cyan' | 'amber' | 'emerald' | 'rose';
  className?: string;
}) {
  const variantStyles = {
    default: 'border border-[--color-border-subtle] bg-[--color-surface-glass] text-[--color-text-secondary]',
    fuchsia: 'border border-[rgba(192,38,211,0.3)] bg-[rgba(192,38,211,0.12)] text-[rgba(232,121,249,0.95)]',
    cyan: 'border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.12)] text-[rgba(103,232,249,0.95)]',
    amber: 'border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.1)] text-[rgba(252,211,77,0.95)]',
    emerald: 'border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.1)] text-[rgba(110,231,183,0.95)]',
    rose: 'border border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.1)] text-[rgba(252,165,165,0.95)]',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]
        backdrop-blur-xl transition
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

/** 主按鈕 */
export function PrimaryButton({
  children,
  variant = 'fuchsia',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'fuchsia' | 'cyan' | 'neutral';
}) {
  const variantStyles = {
    fuchsia: 'border-fuchsia-400/30 bg-fuchsia-400/18 text-fuchsia-50 shadow-[0_18px_42px_rgba(192,38,211,0.24)] hover:bg-fuchsia-400/26',
    cyan: 'border-cyan-300/30 bg-cyan-300/12 text-cyan-50 shadow-[0_10px_28px_rgba(20,184,166,0.12)] hover:bg-cyan-300/20',
    neutral: 'border-white/10 bg-white/8 text-white/72 hover:bg-white/12',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium
        transition hover:-translate-y-0.5
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

/** 次要按鈕 */
export function SecondaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/20 
        px-4 py-2 text-sm font-medium text-white/76 transition
        hover:border-white/18 hover:bg-white/10 hover:text-white
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

/** 圖片 + Fallback 元件 */
export function ImageWithFallback({
  src,
  alt,
  fallbackPrompt,
  className = '',
  ...imgProps
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackPrompt?: string;
}) {
  const [errored, setErrored] = React.useState(false);

  // Ensure width/height are numbers
  const placeholderWidth = typeof imgProps.width === 'number' ? imgProps.width : 800;
  const placeholderHeight = typeof imgProps.height === 'number' ? imgProps.height : 450;

  if (errored || !src) {
    return (
      <SmartPlaceholder
        width={placeholderWidth}
        height={placeholderHeight}
        label={fallbackPrompt ?? 'Image Placeholder'}
        aiPrompt={fallbackPrompt}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      {...imgProps}
    />
  );
}

// Need React for useState
import React from 'react';
