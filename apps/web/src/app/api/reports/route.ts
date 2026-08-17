import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSsrGridMasters } from "@/lib/db-helpers";
import { toIsoDate } from "@/lib/date-utils";
import { buildDataSheetRows, buildDateRange, getSsrExportFactBounds, reportCodeFor } from "@/lib/ssr-data";
import { fetchProductTargetUnitsByKey } from "@/lib/target-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  // Prefer DAY rows (current semantics). Legacy WEEK/MONTH rows may still exist in DB.
  const reports = await prisma.ssrReport.findMany({
    where: {
      salesBatchId: { equals: null },
      asOfDate: { not: null },
      OR: [{ viewType: "DAY" }, { viewType: null }],
    },
    orderBy: { createdAt: "desc" },
  });

  const masters = await fetchSsrGridMasters();

  const factCounts = await Promise.all(
    reports.map(async (r) => {
      const range = buildDateRange(r.asOfDate!);
      const factBounds = getSsrExportFactBounds(r.asOfDate!);
      const [facts, targetUnitsByKey] = await Promise.all([
        prisma.dailySalesFact.findMany({
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
        }),
        fetchProductTargetUnitsByKey(r.asOfDate!),
      ]);
      const lines = buildDataSheetRows(facts, range, {
        asOfDate: r.asOfDate!,
        masters,
        targetUnitsByKey,
      });
      const totalValue = lines.reduce((sum, line) => sum + line.salesValue, 0);
      return { id: r.id, count: lines.length, totalValue, range };
    })
  );
  const factMap = new Map(factCounts.map((f) => [f.id, f]));

  return NextResponse.json(
    reports.map((r) => {
      const stats = factMap.get(r.id);
      const range = r.asOfDate ? buildDateRange(r.asOfDate) : null;
      return {
        id: r.id,
        reportCode: r.asOfDate ? reportCodeFor(r.asOfDate) : "SSR",
        distributorName: "All distributors",
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
