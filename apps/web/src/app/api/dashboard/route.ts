import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatDashboardAsOfDate,
  getLatestSalesAsOfDate,
  getTotalSales,
  salesRangeForAsOfDate,
  ssrActivityDetail,
} from "@/lib/dashboard-sales";

export const dynamic = "force-dynamic";

export async function GET() {
  const asOfDate = await getLatestSalesAsOfDate(prisma);
  const salesRange = asOfDate ? salesRangeForAsOfDate(asOfDate) : undefined;

  const [
    totalSales,
    pendingDocs,
    activeDistributors,
    extractionStats,
    statusCounts,
    recentDocs,
    recentReports,
  ] = await Promise.all([
    salesRange ? getTotalSales(prisma, salesRange) : Promise.resolve(0),
    prisma.document.count({
      where: { status: { in: ["REVIEW_REQUIRED", "PROCESSING", "UPLOADED", "EXTRACTED"] } },
    }),
    prisma.distributor.count({ where: { isActive: true } }),
    prisma.extractionRun.aggregate({
      _sum: { rowCount: true, matchedCount: true },
      where: { status: "COMPLETED" },
    }),
    prisma.document.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.document.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { distributor: true, extractionRuns: { take: 1, orderBy: { createdAt: "desc" } } },
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

  return NextResponse.json({
    kpis: {
      totalSales,
      asOfDate: asOfDate ? asOfDate.toISOString().slice(0, 10) : null,
      asOfLabel: asOfDate ? formatDashboardAsOfDate(asOfDate) : null,
      pendingDocs,
      matchRate,
      activeDistributors,
    },
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
    activity,
    reviewCount: await prisma.extractedRow.count({
      where: { status: { in: ["UNMATCHED", "PENDING"] } },
    }),
  });
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
