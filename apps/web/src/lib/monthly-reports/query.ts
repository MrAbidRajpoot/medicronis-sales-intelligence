/**
 * Load DailySalesFact + targets for monthly management reports.
 * Filters apply before aggregation (index-friendly: saleDate range + id IN).
 * Country is ignored entirely.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/date-utils";
import { resolveDistributorManagerId } from "@/lib/manager-helpers";
import { fetchProductTargetUnitsByKey } from "@/lib/target-helpers";
import {
  buildMonthlyGrainRows,
  type MonthlyFactRow,
} from "./metrics";
import type {
  MonthlyGrainRow,
  MonthlyReportFilters,
  MonthlyReportPeriod,
  MonthlyReportPeriodInput,
} from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function monthNameUtc(date: Date): string {
  return MONTH_NAMES[date.getUTCMonth()]!;
}

function hasIds(ids: string[] | undefined): ids is string[] {
  return Array.isArray(ids) && ids.length > 0;
}

/** Resolve calendar month + full prior month from asOfDate or year/month (UTC). */
export function resolveMonthlyReportPeriod(input: MonthlyReportPeriodInput): MonthlyReportPeriod {
  const asOfDate =
    "asOfDate" in input
      ? input.asOfDate
      : endOfMonth(new Date(Date.UTC(input.year, input.month - 1, 1)));

  const monthStart = startOfMonth(asOfDate);
  const monthEnd = endOfMonth(asOfDate);
  const priorAnchor = addMonths(monthStart, -1);
  const priorMonthStart = startOfMonth(priorAnchor);
  const priorMonthEnd = endOfMonth(priorAnchor);

  return {
    asOfDate,
    year: asOfDate.getUTCFullYear(),
    month: asOfDate.getUTCMonth() + 1,
    monthStart,
    monthEnd,
    priorMonthStart,
    priorMonthEnd,
    monthName: monthNameUtc(monthStart),
    priorMonthName: monthNameUtc(priorMonthStart),
  };
}

/**
 * Resolve distributor ids matching geo + manager filters.
 *
 * Manager rule (same as SSR display): territory → area → region → zone
 * via resolveDistributorManagerId. A distributor matches when its resolved
 * manager id is in filters.managerIds. Country is never considered.
 */
export async function resolveFilteredDistributorIds(
  filters: MonthlyReportFilters
): Promise<string[] | null> {
  const geoOrDistributor =
    hasIds(filters.regionIds) ||
    hasIds(filters.areaIds) ||
    hasIds(filters.territoryIds) ||
    hasIds(filters.zoneIds) ||
    hasIds(filters.distributorIds) ||
    hasIds(filters.managerIds);

  if (!geoOrDistributor) return null;

  const where: Prisma.DistributorWhereInput = { isActive: true };
  if (hasIds(filters.regionIds)) where.regionId = { in: filters.regionIds };
  if (hasIds(filters.areaIds)) where.areaId = { in: filters.areaIds };
  if (hasIds(filters.territoryIds)) where.territoryId = { in: filters.territoryIds };
  if (hasIds(filters.zoneIds)) where.zoneId = { in: filters.zoneIds };
  if (hasIds(filters.distributorIds)) where.id = { in: filters.distributorIds };

  const distributors = await prisma.distributor.findMany({
    where,
    select: {
      id: true,
      territory: { select: { managerId: true, manager: { select: { id: true } } } },
      area: { select: { managerId: true, manager: { select: { id: true } } } },
      region: { select: { managerId: true, manager: { select: { id: true } } } },
      zone: { select: { managerId: true, manager: { select: { id: true } } } },
    },
  });

  if (!hasIds(filters.managerIds)) {
    return distributors.map((d) => d.id);
  }

  const managerSet = new Set(filters.managerIds);
  return distributors
    .filter((d) => {
      const managerId = resolveDistributorManagerId(d);
      return managerId != null && managerSet.has(managerId);
    })
    .map((d) => d.id);
}

async function resolveFilteredProductIds(filters: MonthlyReportFilters): Promise<string[] | null> {
  if (!hasIds(filters.productIds) && !hasIds(filters.productGroupIds)) return null;

  if (hasIds(filters.productIds) && !hasIds(filters.productGroupIds)) {
    return filters.productIds;
  }

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (hasIds(filters.productIds)) where.id = { in: filters.productIds };
  if (hasIds(filters.productGroupIds)) where.productGroupId = { in: filters.productGroupIds };

  const products = await prisma.product.findMany({
    where,
    select: { id: true },
  });
  return products.map((p) => p.id);
}

export interface MonthlyReportQueryResult {
  period: MonthlyReportPeriod;
  facts: MonthlyFactRow[];
  targetUnitsByKey: Map<string, number>;
}

/**
 * Load facts for [priorMonthStart, monthEnd] with optional filters, plus ProductTarget map
 * for the current month. Empty filter dimensions are omitted (no IN []).
 */
export async function queryMonthlyReportData(
  filters: MonthlyReportFilters,
  periodInput: MonthlyReportPeriodInput
): Promise<MonthlyReportQueryResult> {
  const period = resolveMonthlyReportPeriod(periodInput);

  const [distributorIds, productIds, targetUnitsByKey] = await Promise.all([
    resolveFilteredDistributorIds(filters),
    resolveFilteredProductIds(filters),
    fetchProductTargetUnitsByKey(period.asOfDate),
  ]);

  // No matching distributors/products after filters → empty facts (still return period/targets).
  if (distributorIds?.length === 0 || productIds?.length === 0) {
    return { period, facts: [], targetUnitsByKey };
  }

  const where: Prisma.DailySalesFactWhereInput = {
    saleDate: {
      gte: period.priorMonthStart,
      lte: period.monthEnd,
    },
  };
  if (distributorIds) where.distributorId = { in: distributorIds };
  if (productIds) where.productId = { in: productIds };

  const facts = (await prisma.dailySalesFact.findMany({
    where,
    include: {
      distributor: {
        include: {
          territory: { include: { manager: true } },
          area: { include: { manager: true } },
          region: { include: { manager: true } },
          zone: { include: { manager: true } },
        },
      },
      product: {
        select: { id: true, name: true, newSp: true },
      },
    },
    orderBy: [{ saleDate: "asc" }, { distributorId: "asc" }, { productId: "asc" }],
  })) as MonthlyFactRow[];

  return { period, facts, targetUnitsByKey };
}

/** Convenience: query + build grain rows ready for aggregateDistributorWise / aggregateProductWise. */
export async function loadMonthlyGrainRows(
  filters: MonthlyReportFilters,
  periodInput: MonthlyReportPeriodInput
): Promise<{ period: MonthlyReportPeriod; grainRows: MonthlyGrainRow[] }> {
  const { period, facts, targetUnitsByKey } = await queryMonthlyReportData(filters, periodInput);
  const grainRows = buildMonthlyGrainRows(facts, period, targetUnitsByKey);
  return { period, grainRows };
}

/** Latest calendar month that has any DailySalesFact; falls back to current UTC month. */
export async function resolveLatestFactMonth(): Promise<{ year: number; month: number }> {
  const latest = await prisma.dailySalesFact.findFirst({
    orderBy: { saleDate: "desc" },
    select: { saleDate: true },
  });
  if (!latest) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return {
    year: latest.saleDate.getUTCFullYear(),
    month: latest.saleDate.getUTCMonth() + 1,
  };
}
