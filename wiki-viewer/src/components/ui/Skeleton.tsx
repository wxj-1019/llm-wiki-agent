/** Generic skeleton UI components for loading states. */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[var(--bg-tertiary)] rounded-xl ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="apple-card p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="w-12 h-4 rounded-xl" />
      </div>
      <Skeleton className="w-3/4 h-6 mb-2 rounded-xl" />
      <Skeleton className="w-full h-4 mb-1 rounded-xl" />
      <Skeleton className="w-5/6 h-4 mb-1 rounded-xl" />
      <Skeleton className="w-4/6 h-4 mb-3 rounded-xl" />
      <div className="flex justify-end gap-2">
        <Skeleton className="w-8 h-3 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="apple-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-6 h-6 rounded-xl" />
        <Skeleton className="w-16 h-4 rounded-xl" />
      </div>
      <Skeleton className="w-10 h-8 rounded-xl" />
    </div>
  );
}

export function SkeletonSearch() {
  return (
    <div className="w-full max-w-xl">
      <Skeleton className="w-full h-12 rounded-xl" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
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
      <Skeleton className="w-40 h-7 rounded-xl" />

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
    </div>
  );
}

export function BrowseSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-6">
      <Skeleton className="w-48 h-9 rounded-xl" />
      <Skeleton className="w-full h-11 rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="w-72 h-9 rounded-xl" />
        <Skeleton className="w-28 h-9 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="w-32 h-5 rounded-xl" />
      </div>
      <Skeleton className="w-3/4 h-10 rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="w-20 h-6 rounded-xl" />
        <Skeleton className="w-24 h-6 rounded-xl" />
      </div>
      <div className="space-y-3 pt-4">
        <Skeleton className="w-full h-4 rounded-xl" />
        <Skeleton className="w-full h-4 rounded-xl" />
        <Skeleton className="w-5/6 h-4 rounded-xl" />
        <Skeleton className="w-full h-4 rounded-xl" />
        <Skeleton className="w-4/6 h-4 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-8">
        <Skeleton className="w-48 h-9 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="apple-card p-6 space-y-4">
            <Skeleton className="w-40 h-6 rounded-xl" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-20 h-4 rounded-xl" />
                  <Skeleton className="flex-1 h-2 rounded-full" />
                  <Skeleton className="w-6 h-4 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
          <div className="apple-card p-6 space-y-4">
            <Skeleton className="w-40 h-6 rounded-xl" />
            <div className="flex justify-center">
              <Skeleton className="w-[200px] h-[200px] rounded-full" />
            </div>
            <Skeleton className="w-32 h-4 mx-auto rounded-xl" />
          </div>
        </div>
        <div className="apple-card p-6 space-y-4">
          <Skeleton className="w-40 h-6 rounded-xl" />
          <div className="flex items-center gap-4">
            <Skeleton className="flex-1 h-3 rounded-full" />
            <Skeleton className="w-24 h-5 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MCPSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded-xl" />
            <Skeleton className="w-40 h-8 rounded-xl" />
          </div>
          <Skeleton className="w-32 h-9 rounded-xl" />
        </div>
        <div className="grid gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

export function SkillsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded-xl" />
          <Skeleton className="w-40 h-8 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-8">
        <Skeleton className="w-56 h-9 rounded-xl" />
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-default)]" />
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 ml-1">
                <Skeleton className="w-6 h-6 rounded-full shrink-0 z-10" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-20 h-4 rounded-xl" />
                    <Skeleton className="w-16 h-4 rounded-xl" />
                  </div>
                  <Skeleton className="w-3/4 h-5 rounded-xl" />
                  <Skeleton className="w-full h-4 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MindmapSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-6">
        <Skeleton className="w-56 h-9 rounded-xl" />
        <div className="apple-card p-6 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-3.5 h-3.5 rounded-full" />
            <Skeleton className="w-32 h-5 rounded-xl" />
          </div>
          <div className="ml-5 pl-3 border-l border-[var(--border-default)] space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-3.5 h-3.5 rounded-full" />
              <Skeleton className="w-28 h-4 rounded-xl" />
            </div>
            <div className="ml-5 pl-3 border-l border-[var(--border-default)] space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3.5 h-3.5 rounded-full" />
                <Skeleton className="w-24 h-4 rounded-xl" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="w-3.5 h-3.5 rounded-full" />
                <Skeleton className="w-24 h-4 rounded-xl" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-3.5 h-3.5 rounded-full" />
              <Skeleton className="w-28 h-4 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
