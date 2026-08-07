import { TableSkeleton } from "@/components/skeletons";

export default function DocumentDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-lg border bg-muted/50 lg:col-span-1" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted/50 lg:col-span-2" />
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}
