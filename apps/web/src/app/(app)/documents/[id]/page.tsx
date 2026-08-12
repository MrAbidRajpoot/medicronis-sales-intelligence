import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ProcessingStepper, type ProcessingStep } from "@/components/processing-stepper";
import { DataTable, type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatFileSize } from "@/lib/mock-data";
import { DocumentActions } from "@/components/document-actions";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { DocumentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function getTimeline(status: DocumentStatus, errorMessage?: string | null): ProcessingStep[] {
  if (status === "FAILED") {
    return [
      { id: "upload", label: "Uploaded", status: "complete" },
      { id: "extract", label: "Extraction Failed", status: "error", description: errorMessage ?? "Unable to parse PDF" },
    ];
  }

  if (status === "TEMPLATE_MISMATCH") {
    return [
      { id: "upload", label: "Uploaded", status: "complete" },
      { id: "extract", label: "Template Mismatch", status: "error", description: errorMessage ?? "Layout changed — re-map template" },
    ];
  }

  const order: DocumentStatus[] = ["UPLOADED", "PROCESSING", "EXTRACTED", "REVIEW_REQUIRED", "APPROVED"];
  const idx = order.indexOf(status);

  const steps: ProcessingStep[] = [
    { id: "upload", label: "Uploaded", status: "complete" },
    { id: "extract", label: "Extracted", status: "pending" },
    { id: "match", label: "Product Match", status: "pending" },
    { id: "review", label: "Review", status: "pending" },
    { id: "approve", label: "Approved", status: "pending" },
  ];

  if (status === "PROCESSING") {
    steps[1].status = "active";
    steps[1].label = "Extracting";
    steps[1].description = "Parsing line items from PDF...";
    return steps;
  }

  if (idx >= 2 || status === "REVIEW_REQUIRED" || status === "APPROVED") {
    steps[1].status = "complete";
    steps[2].status = "complete";
  }

  if (status === "REVIEW_REQUIRED") {
    steps[3].status = "active";
    steps[3].description = "Exceptions need review";
  } else if (status === "EXTRACTED") {
    steps[3].status = "complete";
    steps[4].status = "active";
    steps[4].description = "Ready for approval";
  } else if (status === "APPROVED") {
    steps[3].status = "complete";
    steps[4].status = "complete";
  }

  return steps;
}

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      distributor: true,
      extractionRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          extractedRows: {
            orderBy: { rowIndex: "asc" },
            include: { product: true },
          },
        },
      },
    },
  });

  if (!doc) notFound();

  const run = doc.extractionRuns[0];
  const rows = run?.extractedRows ?? [];
  const matchRate = run && run.rowCount > 0 ? Math.round((run.matchedCount / run.rowCount) * 100) : 0;
  const hasUnresolved = rows.some((r) => r.status === "UNMATCHED" || r.status === "PENDING");
  const showReturnsQty = rows.some((r) => r.returnsQty != null);
  const showClosingStock = rows.some((r) => r.closingStock != null);

  type ExtractedRowRow = (typeof rows)[number];
  const columns: Column<ExtractedRowRow>[] = [
    { key: "idx", header: "#", cell: (r) => r.rowIndex, className: "w-12" },
    {
      key: "raw",
      header: "Raw Product Text",
      cell: (r) => <span className="font-mono text-xs">{r.rawProductText}</span>,
    },
    {
      key: "product",
      header: "Matched Product",
      cell: (r) =>
        r.product ? (
          <div>
            <p className="text-sm">{r.product.name}</p>
            <p className="text-xs text-muted-foreground">{r.product.sku}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
  if (showReturnsQty) {
    columns.push({
      key: "returnsQty",
      header: "Returns Qty",
      cell: (r) => (r.returnsQty != null ? Number(r.returnsQty).toLocaleString() : "—"),
      className: "text-right",
    });
  }
  columns.push(
    {
      key: "qty",
      header: "Sales Units",
      cell: (r) => Number(r.quantity).toLocaleString(),
      className: "text-right",
    },
    {
      key: "price",
      header: "S.P",
      cell: (r) => (r.unitPrice ? formatCurrency(Number(r.unitPrice)) : "—"),
      className: "text-right",
    },
    {
      key: "total",
      header: "Sales Value",
      cell: (r) => (r.lineTotal ? formatCurrency(Number(r.lineTotal)) : "—"),
      className: "text-right",
    }
  );
  if (showClosingStock) {
    columns.push({
      key: "closingStock",
      header: "Closing Stock",
      cell: (r) => (r.closingStock != null ? Number(r.closingStock).toLocaleString() : "—"),
      className: "text-right",
    });
  }
  columns.push({
    key: "status",
    header: "Status",
    cell: (r) => <StatusBadge status={r.status} type="row" />,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={doc.fileName}
        description={`${doc.distributor?.name ?? "Unknown distributor"} · Report date: ${formatDate(doc.reportDate)}${doc.periodStart ? ` · ${formatDate(doc.periodStart)} – ${formatDate(doc.periodEnd!)}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={doc.status} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/documents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Processing Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessingStepper steps={getTimeline(doc.status, run?.errorMessage)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Document Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Report Date</dt>
                <dd className="mt-1 text-sm font-medium">{formatDate(doc.reportDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Distributor</dt>
                <dd className="mt-1 text-sm font-medium">{doc.distributor?.name ?? "Auto-detect pending"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">File Size</dt>
                <dd className="mt-1 text-sm">{formatFileSize(doc.fileSize)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Uploaded</dt>
                <dd className="mt-1 text-sm">{formatDateTime(doc.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Match Rate</dt>
                <dd className="mt-1 text-sm font-semibold text-accent">
                  {run && run.rowCount > 0 ? `${matchRate}% (${run.matchedCount}/${run.rowCount})` : "—"}
                </dd>
              </div>
              {run?.extractMethod && (
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Extract Method</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {run.extractMethod === "line_fallback"
                      ? "Line parser fallback"
                      : run.extractMethod === "alternate_settings"
                        ? "Alternate pdfplumber settings"
                        : "Table extraction"}
                  </dd>
                </div>
              )}
              {run?.errorMessage && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Error</dt>
                  <dd className="mt-1 text-sm text-destructive">{run.errorMessage}</dd>
                  {doc.status === "TEMPLATE_MISMATCH" && doc.distributorId && (
                    <dd className="mt-2">
                      <Button variant="accent" size="sm" asChild>
                        <Link href={`/distributors/${doc.distributorId}/template?returnTo=/documents/${doc.id}`}>
                          Re-map PDF Template
                        </Link>
                      </Button>
                    </dd>
                  )}
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 ? (
        <DataTable
          title="Extracted Rows"
          description={`${rows.length} line items from PDF extraction`}
          data={rows}
          columns={columns}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {doc.status === "PROCESSING"
              ? "Extraction in progress — rows will appear here shortly."
              : doc.status === "FAILED"
                ? "Extraction failed. Re-upload or contact support."
                : "No extracted rows yet."}
          </CardContent>
        </Card>
      )}

      <DocumentActions
        documentId={doc.id}
        status={doc.status}
        distributorId={doc.distributorId}
        hasUnresolved={hasUnresolved}
      />
    </div>
  );
}
