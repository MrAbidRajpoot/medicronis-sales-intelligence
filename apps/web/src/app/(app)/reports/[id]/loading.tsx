import { TableSkeleton } from "@/components/skeletons";

export default function ReportDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <TableSkeleton rows={6} />
    </div>
  );
}
