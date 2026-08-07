import type { PrismaClient } from "@prisma/client";

export type SalesDateRange = {
  start: Date;
  end: Date;
};

export async function getSalesByDistributor(
  prisma: PrismaClient,
  range?: SalesDateRange
) {
  const where = range
    ? { saleDate: { gte: range.start, lte: range.end } }
    : undefined;

  const grouped = await prisma.dailySalesFact.groupBy({
    by: ["distributorId"],
    _sum: { salesValue: true },
    where,
  });

  if (grouped.length === 0) return [];

  const distributors = await prisma.distributor.findMany({
    where: { id: { in: grouped.map((g) => g.distributorId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(distributors.map((d) => [d.id, d.name]));

  return grouped
    .map((g) => ({
      name: nameById.get(g.distributorId) ?? "Unknown",
      value: Number(g._sum.salesValue ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
}

export async function getTotalSales(
  prisma: PrismaClient,
  range?: SalesDateRange
) {
  const where = range
    ? { saleDate: { gte: range.start, lte: range.end } }
    : undefined;

  const result = await prisma.dailySalesFact.aggregate({
    _sum: { salesValue: true },
    where,
  });

  return Number(result._sum.salesValue ?? 0);
}

export function ssrActivityDetail(report: {
  asOfDate: Date | null;
  viewType: string | null;
}): string {
  if (report.asOfDate) {
    const view = report.viewType?.toLowerCase() ?? "day";
    const date = report.asOfDate.toISOString().slice(0, 10);
    return `${view.charAt(0).toUpperCase()}${view.slice(1)} view for ${date}`;
  }
  return "SSR report";
}
