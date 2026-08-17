import type { PrismaClient } from "@prisma/client";
import { resolveSellingPrice } from "@/lib/ssr-data";

export type SalesDateRange = {
  start: Date;
  end: Date;
};

/** Human-readable asOfDate (UTC), e.g. "31 Jul 2026". */
export function formatDashboardAsOfDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Latest READY distributor SSR (salesBatchId null) by asOfDate desc.
 * Falls back to the latest DailySalesFact.saleDate when no READY SSR exists.
 */
export async function getLatestSalesAsOfDate(
  prisma: PrismaClient
): Promise<Date | null> {
  const latestReport = await prisma.ssrReport.findFirst({
    where: {
      status: "READY",
      salesBatchId: null,
      asOfDate: { not: null },
    },
    orderBy: { asOfDate: "desc" },
    select: { asOfDate: true },
  });

  if (latestReport?.asOfDate) {
    return latestReport.asOfDate;
  }

  const latestFact = await prisma.dailySalesFact.findFirst({
    orderBy: { saleDate: "desc" },
    select: { saleDate: true },
  });

  return latestFact?.saleDate ?? null;
}

export function salesRangeForAsOfDate(asOfDate: Date): SalesDateRange {
  return { start: asOfDate, end: asOfDate };
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
}): string {
  if (report.asOfDate) {
    return `SSR · Sales Till ${formatDashboardAsOfDate(report.asOfDate)}`;
  }
  return "SSR report";
}
