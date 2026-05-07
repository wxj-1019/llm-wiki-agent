import { Suspense, type ReactNode } from 'react';

function PageLoader({ label }: { label: string }) {
  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">Loading {label}...</p>
      </div>
    </div>
  );
}

export function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader label="page" />}>
      {children}
    </Suspense>
  );
}
