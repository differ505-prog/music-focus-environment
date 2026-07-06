'use client';

export function MediaCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/8 bg-white/4 p-4">
      {/* Image skeleton */}
      <div className="relative overflow-hidden rounded-[26px] bg-white/6">
        <div className="h-56 w-full animate-pulse bg-gradient-to-r from-white/8 via-white/4 to-white/8 bg-[length:200%_100%]" />
        {/* BPM badge skeleton */}
        <div className="absolute left-4 top-4 h-6 w-20 animate-pulse rounded-full bg-white/12" />
      </div>

      {/* Content skeleton */}
      <div className="mt-4 space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-white/12" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
      </div>

      {/* Tags skeleton */}
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-white/8" />
        <div className="h-5 w-12 animate-pulse rounded-full bg-white/8" />
      </div>
    </div>
  );
}
