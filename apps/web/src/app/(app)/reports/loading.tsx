import { TableSkeleton } from "@/components/skeletons";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <TableSkeleton rows={4} />
    </div>
  );
}
