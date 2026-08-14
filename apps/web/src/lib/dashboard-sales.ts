import type { PrismaClient } from "@prisma/client";
import { parseIsoDate, startOfMonth, startOfWeek, todayIsoDate } from "@/lib/date-utils";
import { resolveSellingPrice } from "@/lib/ssr-data";

export type SalesDateRange = {
  start: Date;
  end: Date;
};

export function getDashboardSalesRanges(asOf = parseIsoDate(todayIsoDate())!) {
  return {
    day: { start: asOf, end: asOf },
    week: { start: startOfWeek(asOf), end: asOf },
    month: { start: startOfMonth(asOf), end: asOf },
  } satisfies Record<"day" | "week" | "month", SalesDateRange>;
}

export async function getSalesByDistributor(
  prisma: PrismaClient,
  range?: SalesDateRange
) {
  const where = range
    ? { saleDate: { gte: range.start, lte: range.end } }
    : undefined;

  const facts = await prisma.dailySalesFact.findMany({
    where,
    select: {
      distributorId: true,
      quantity: true,
      unitPrice: true,
      product: { select: { id: true, newSp: true } },
      distributor: { select: { name: true } },
    },
  });

  const totals = new Map<string, { name: string; value: number }>();
  for (const fact of facts) {
    const value = Number(fact.quantity) * resolveSellingPrice(fact.product, fact);
    const existing = totals.get(fact.distributorId);
    if (existing) {
      existing.value += value;
    } else {
      totals.set(fact.distributorId, { name: fact.distributor.name, value });
    }
  }

  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

export async function getTotalSales(
  prisma: PrismaClient,
  range?: SalesDateRange
) {
  const where = range
    ? { saleDate: { gte: range.start, lte: range.end } }
    : undefined;

  const facts = await prisma.dailySalesFact.findMany({
    where,
    select: {
      quantity: true,
      unitPrice: true,
      product: { select: { id: true, newSp: true } },
    },
  });

  return facts.reduce(
    (total, fact) => total + Number(fact.quantity) * resolveSellingPrice(fact.product, fact),
    0
  );
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
