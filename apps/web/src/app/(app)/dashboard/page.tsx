import Link from "next/link";
import {
  FileWarning,
  Target,
  Building2,
  Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { DataTable } from "@/components/data-table";
import { SalesByDistributorChart } from "@/components/sales-chart";
import { TemplateCoverageSection } from "@/components/template-coverage-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  formatDashboardAsOfDate,
  getLatestSalesAsOfDate,
  getSalesByDistributor,
  salesRangeForAsOfDate,
  ssrActivityDetail,
} from "@/lib/dashboard-sales";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const asOfDate = await getLatestSalesAsOfDate(prisma);
  const salesRange = asOfDate ? salesRangeForAsOfDate(asOfDate) : undefined;

  const [
    pendingDocs,
    activeDistributors,
    extractionStats,
    statusCounts,
    salesByDistributor,
    recentDocs,
    recentReports,
  ] = await Promise.all([
    prisma.document.count({
      where: { status: { in: ["REVIEW_REQUIRED", "PROCESSING", "UPLOADED", "EXTRACTED"] } },
    }),
    prisma.distributor.count({ where: { isActive: true } }),
    prisma.extractionRun.aggregate({
      _sum: { rowCount: true, matchedCount: true },
      where: { status: "COMPLETED" },
    }),
    prisma.document.groupBy({ by: ["status"], _count: { id: true } }),
    salesRange ? getSalesByDistributor(prisma, salesRange) : Promise.resolve([]),
    prisma.document.findMany({
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: { distributor: true },
    }),
    prisma.ssrReport.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      where: { salesBatchId: { equals: null } },
      select: { id: true, asOfDate: true, generatedAt: true, createdAt: true },
    }),
  ]);

  const totalRows = extractionStats._sum.rowCount ?? 0;
  const matchedRows = extractionStats._sum.matchedCount ?? 0;
  const matchRate = totalRows > 0 ? Math.round((matchedRows / totalRows) * 1000) / 10 : 0;

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id]));

  const salesTotal = salesByDistributor.reduce((total, row) => total + row.value, 0);
  const asOfLabel = asOfDate ? formatDashboardAsOfDate(asOfDate) : null;
  const salesKpiTitle = asOfLabel ? `Sales Till ${asOfLabel}` : "Latest SSR Sales";
  const chartTitle = asOfLabel
    ? `Sales by Distributor — Till ${asOfLabel}`
    : "Sales by Distributor — Latest SSR";

  const activity = [
    ...recentDocs.map((d) => ({
      id: `doc-${d.id}`,
      action: statusLabel(d.status),
      detail: `${d.fileName}${d.distributor ? ` — ${d.distributor.name}` : ""}`,
      timestamp: d.updatedAt.toISOString(),
    })),
    ...recentReports.map((r) => ({
      id: `ssr-${r.id}`,
      action: "SSR Generated",
      detail: ssrActivityDetail(r),
      timestamp: (r.generatedAt ?? r.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  const processingSummary = [
    { label: "Approved", count: statusMap["APPROVED"] ?? 0, color: "bg-emerald-500" },
    { label: "Review Required", count: statusMap["REVIEW_REQUIRED"] ?? 0, color: "bg-amber-500" },
    { label: "Processing", count: (statusMap["PROCESSING"] ?? 0) + (statusMap["UPLOADED"] ?? 0), color: "bg-sky-500" },
    { label: "Template Mismatch", count: statusMap["TEMPLATE_MISMATCH"] ?? 0, color: "bg-orange-500" },
    { label: "Failed", count: statusMap["FAILED"] ?? 0, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of secondary sales reporting across all distributors"
        actions={
          <Button asChild variant="accent">
            <Link href="/upload">Upload PDF</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={salesKpiTitle}
          value={formatCurrency(salesTotal)}
          subtitle={asOfLabel ? "from latest SSR sheet" : "no SSR sales yet"}
          icon={Banknote}
        />
        <KpiCard
          title="Pending Documents"
          value={String(pendingDocs)}
          subtitle="awaiting action"
          icon={FileWarning}
        />
        <KpiCard
          title="Product Match Rate"
          value={`${matchRate}%`}
          icon={Target}
        />
        <KpiCard
          title="Active Distributors"
          value={String(activeDistributors)}
          subtitle="of 48 total network"
          icon={Building2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{chartTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesByDistributorChart data={toChartData(salesByDistributor)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {processingSummary.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm">{item.label}</span>
                <span className="text-sm font-semibold">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <TemplateCoverageSection />

      <DataTable
        title="Recent Activity"
        description="Latest document and report events"
        data={activity}
        emptyMessage="No activity yet — upload a PDF to get started"
        columns={[
          {
            key: "action",
            header: "Action",
            cell: (row) => <span className="font-medium">{row.action}</span>,
          },
          {
            key: "detail",
            header: "Detail",
            cell: (row) => <span className="text-muted-foreground">{row.detail}</span>,
          },
          {
            key: "timestamp",
            header: "Time",
            cell: (row) => (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(row.timestamp)}
              </span>
            ),
            className: "text-right",
          },
        ]}
      />
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    UPLOADED: "Document Uploaded",
    PROCESSING: "Processing",
    EXTRACTED: "Extraction Complete",
    REVIEW_REQUIRED: "Review Required",
    TEMPLATE_MISMATCH: "Template Mismatch",
    APPROVED: "Document Approved",
    FAILED: "Upload Failed",
  };
  return map[status] ?? status;
}

function toChartData(data: { name: string; value: number }[]) {
  return data.map(({ name, value }) => ({
    name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
    value,
  }));
}
