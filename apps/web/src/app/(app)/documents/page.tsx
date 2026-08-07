import Link from "next/link";
import { Eye, Upload, FileText, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatFileSize } from "@/lib/mock-data";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany({
    include: {
      distributor: true,
      extractionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = documents.map((doc) => {
    const run = doc.extractionRuns[0];
    return {
      id: doc.id,
      fileName: doc.fileName,
      distributorId: doc.distributorId,
      distributorName: doc.distributor?.name ?? "—",
      status: doc.status,
      reportDate: doc.reportDate.toISOString(),
      periodStart: doc.periodStart?.toISOString() ?? "",
      periodEnd: doc.periodEnd?.toISOString() ?? "",
      rowCount: run?.rowCount ?? 0,
      matchedCount: run?.matchedCount ?? 0,
      uploadedAt: doc.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="All uploaded distributor sales report PDFs and their processing status"
        actions={
          <Button asChild variant="accent">
            <Link href="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload distributor sales report PDFs to begin extraction and SSR generation."
          action={{ label: "Upload your first PDF", href: "/upload" }}
        />
      ) : (
        <DataTable
          data={rows}
          columns={[
            {
              key: "fileName",
              header: "Filename",
              cell: (row) => (
                <Link href={`/documents/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.fileName}
                </Link>
              ),
            },
            { key: "distributor", header: "Distributor", cell: (row) => row.distributorName },
            { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
            {
              key: "reportDate",
              header: "Report Date",
              cell: (row) => (
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(row.reportDate)}
                </span>
              ),
            },
            {
              key: "period",
              header: "Period",
              cell: (row) =>
                row.periodStart ? (
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "rows",
              header: "Match",
              cell: (row) =>
                row.rowCount > 0 ? (
                  <span className="text-sm">
                    {row.matchedCount}/{row.rowCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: "uploaded",
              header: "Uploaded",
              cell: (row) => (
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(row.uploadedAt)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <div className="flex justify-end gap-1">
                  {row.status === "TEMPLATE_MISMATCH" && row.distributorId && (
                    <Button variant="ghost" size="sm" asChild title="Re-map PDF template">
                      <Link
                        href={`/distributors/${row.distributorId}/template?returnTo=/documents/${row.id}`}
                      >
                        <RefreshCw className="h-4 w-4 text-destructive" />
                      </Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/documents/${row.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ),
              className: "w-20",
            },
          ]}
        />
      )}
    </div>
  );
}
