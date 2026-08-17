import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSsrDataSheet } from "@/lib/db-helpers";
import { toIsoDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = await prisma.ssrReport.findUnique({
    where: { id: params.id },
  });

  if (!report || report.salesBatchId || !report.asOfDate) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { lines, range, reportCode } = await fetchSsrDataSheet(report.asOfDate);

  return NextResponse.json({
    id: report.id,
    status: report.status,
    reportCode,
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
      targetUnits: l.targetUnits,
      targetValue: l.targetValue,
      targetAchvPercent: l.targetAchvPercent,
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
