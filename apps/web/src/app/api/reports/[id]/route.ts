import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSsrGridMasters } from "@/lib/db-helpers";
import { buildDataSheetRows, buildDateRange, getSsrExportFactBounds, reportCodeFor, type SsrViewTypeLabel } from "@/lib/ssr-data";
import { toIsoDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = await prisma.ssrReport.findUnique({
    where: { id: params.id },
  });

  if (!report || report.salesBatchId || !report.asOfDate) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const viewType = (report.viewType?.toLowerCase() ?? "day") as SsrViewTypeLabel;
  const range = buildDateRange(viewType, report.asOfDate);
  const factBounds = getSsrExportFactBounds(viewType, report.asOfDate);

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
    orderBy: [{ distributor: { name: "asc" } }, { product: { name: "asc" } }],
  });

  const masters = await fetchSsrGridMasters();
  const lines = buildDataSheetRows(facts, range, {
    asOfDate: report.asOfDate,
    viewType,
    masters,
  });

  return NextResponse.json({
    id: report.id,
    status: report.status,
    reportCode: reportCodeFor(report.asOfDate, viewType),
    viewType,
    asOfDate: toIsoDate(report.asOfDate),
    periodStart: toIsoDate(range.start),
    periodEnd: toIsoDate(range.end),
    distributorName: "All distributors",
    generatedAt: report.generatedAt,
    lineCount: lines.length,
    totalValue: lines.reduce((s, l) => s + l.salesValue, 0),
    lines: lines.map((l) => ({
      distributorName: l.distributorName,
      territory: l.territory,
      area: l.area,
      region: l.region,
      zone: l.zone,
      category: l.category,
      group: l.group,
      manager: l.manager,
      productName: l.productName,
      unitPrice: l.sellingPrice,
      qty: l.salesUnits,
      netValue: l.salesValue,
      yesterdayUnits: l.yesterdayUnits,
      yesterdaySalesValue: l.yesterdaySalesValue,
      difference: l.difference,
      lmtdSalesUnits: l.lmtdSalesUnits,
      lmtdDifferenceUnits: l.lmtdDifferenceUnits,
      lmtdSalesValue: l.lmtdSalesValue,
      lmtdDifferenceValue: l.lmtdDifferenceValue,
      lmtdPercent: l.lmtdPercent,
      closingStock: l.closingStock,
      stockValue: l.stockValue,
      inventory: l.inventory,
      order: l.order,
      orderValue: l.orderValue,
      excessStock: l.excessStock,
      excessStockValue: l.excessStockValue,
      inventoryValue: l.inventoryValue,
    })),
  });
}
