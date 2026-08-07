import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function KpiSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="space-y-3 p-6">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <KpiSkeletonGrid />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartSkeleton />
        </div>
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
      </div>
      <TableSkeleton />
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
