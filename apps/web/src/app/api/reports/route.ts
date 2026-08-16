import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSsrGridMasters } from "@/lib/db-helpers";
import { toIsoDate } from "@/lib/date-utils";
import { buildDataSheetRows, buildDateRange, getSsrExportFactBounds, type SsrViewTypeLabel } from "@/lib/ssr-data";

export const dynamic = "force-dynamic";

function viewTypeLabelFromReport(viewType: string | null | undefined): SsrViewTypeLabel {
  const value = viewType?.toLowerCase();
  if (value === "week" || value === "month") return value;
  return "day";
}

export async function GET() {
  const reports = await prisma.ssrReport.findMany({
    where: { salesBatchId: { equals: null }, asOfDate: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  const masters = await fetchSsrGridMasters();

  const factCounts = await Promise.all(
    reports.map(async (r) => {
      const viewType = viewTypeLabelFromReport(r.viewType);
      const range = buildDateRange(viewType, r.asOfDate!);
      const factBounds = getSsrExportFactBounds(viewType, r.asOfDate!);
      const facts = await prisma.dailySalesFact.findMany({
        where: {
          saleDate: {
            gte: factBounds.min,
            lte: factBounds.max,
          },
        },
        include: {
          distributor: {
            include: {
              territory: { include: { manager: true } },
              area: { include: { manager: true } },
              region: { include: { manager: true } },
              zone: { include: { manager: true } },
            },
          },
          product: true,
        },
      });
      const lines = buildDataSheetRows(facts, range, {
        asOfDate: r.asOfDate!,
        viewType,
        masters,
      });
      const totalValue = lines.reduce((sum, line) => sum + line.salesValue, 0);
      return { id: r.id, count: lines.length, totalValue, range };
    })
  );
  const factMap = new Map(factCounts.map((f) => [f.id, f]));

  return NextResponse.json(
    reports.map((r) => {
      const stats = factMap.get(r.id);
      const viewType = viewTypeLabelFromReport(r.viewType);
      const range = r.asOfDate ? buildDateRange(viewType, r.asOfDate) : null;
      return {
        id: r.id,
        reportCode: r.asOfDate ? `SSR-${viewType}-${toIsoDate(r.asOfDate)}` : "SSR",
        distributorName: "All distributors",
        viewType,
        asOfDate: r.asOfDate ? toIsoDate(r.asOfDate) : null,
        periodStart: range ? toIsoDate(range.start) : r.asOfDate,
        periodEnd: range ? toIsoDate(range.end) : r.asOfDate,
        status: r.status,
        lineCount: stats?.count ?? 0,
        totalValue: stats?.totalValue ?? 0,
        generatedAt: r.generatedAt,
        filePath: r.filePath,
      };
    })
  );
}
