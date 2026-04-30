/** Generic skeleton UI components for loading states. */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[var(--bg-tertiary)] rounded-lg ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="apple-card p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-8 h-8" />
        <Skeleton className="w-12 h-4" />
      </div>
      <Skeleton className="w-3/4 h-6 mb-2" />
      <Skeleton className="w-full h-4 mb-1" />
      <Skeleton className="w-5/6 h-4 mb-1" />
      <Skeleton className="w-4/6 h-4 mb-3" />
      <div className="flex justify-end gap-2">
        <Skeleton className="w-8 h-3" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="apple-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-6 h-6" />
        <Skeleton className="w-16 h-4" />
      </div>
      <Skeleton className="w-10 h-8" />
    </div>
  );
}

export function SkeletonSearch() {
  return (
    <div className="w-full max-w-xl">
      <Skeleton className="w-full h-12 rounded-2xl" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Search placeholder */}
      <SkeletonSearch />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      {/* Section header */}
      <Skeleton className="w-40 h-7" />

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function BrowseSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <Skeleton className="w-48 h-9" />
      <Skeleton className="w-full h-11 rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="w-72 h-9 rounded-xl" />
        <Skeleton className="w-28 h-9 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-32 h-5" />
      </div>
      <Skeleton className="w-3/4 h-10" />
      <div className="flex gap-3">
        <Skeleton className="w-20 h-6 rounded-full" />
        <Skeleton className="w-24 h-6 rounded-full" />
      </div>
      <div className="space-y-3 pt-4">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-5/6 h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-4/6 h-4" />
      </div>
    </div>
  );
}
