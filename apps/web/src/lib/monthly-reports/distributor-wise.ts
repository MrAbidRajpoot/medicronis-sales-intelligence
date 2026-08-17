/**
 * Distributor Wise report: query-param parsing, aggregation, totals, JSON shaping.
 * Server-only — do not import from client components.
 */

import {
  computeLmtdPercent,
  computeTargetAchvPercent,
} from "@/lib/ssr-data";
import {
  aggregateDistributorWise,
  collapseDistributorWiseByName,
  filterGrainToLatestDistributorByName,
  snapshotCoverageFromGrain,
} from "./metrics";
import { loadMonthlyGrainRows, resolveLatestFactMonth } from "./query";
import {
  distributorWiseHeaders,
  monthlyReportColumnLabels,
  type DistributorWiseRow,
  type MonthlyReportFilters,
  type MonthlyReportPeriod,
} from "./types";
import type { DistributorWisePeriodDto, DistributorWiseResponse } from "./distributor-wise-client";

export type { DistributorWisePeriodDto, DistributorWiseResponse };
export {
  appendFilterQueryParams,
  formatDistributorWiseCell,
} from "./distributor-wise-client";

function toIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function periodDto(period: MonthlyReportPeriod): DistributorWisePeriodDto {
  return {
    year: period.year,
    month: period.month,
    monthName: period.monthName,
    priorMonthName: period.priorMonthName,
    monthStart: toIsoDateUtc(period.monthStart),
    monthEnd: toIsoDateUtc(period.monthEnd),
    priorMonthStart: toIsoDateUtc(period.priorMonthStart),
    priorMonthEnd: toIsoDateUtc(period.priorMonthEnd),
  };
}

function priorPeriodDto(period: MonthlyReportPeriod) {
  return {
    year: period.priorMonthStart.getUTCFullYear(),
    month: period.priorMonthStart.getUTCMonth() + 1,
    monthName: period.priorMonthName,
  };
}

/** Parse comma-separated or repeated query ids. */
export function parseIdListParam(
  searchParams: URLSearchParams,
  key: string
): string[] | undefined {
  const fromAll = searchParams
    .getAll(key)
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromAll.length === 0) return undefined;
  return Array.from(new Set(fromAll));
}

export function parseMonthlyReportFilters(searchParams: URLSearchParams): MonthlyReportFilters {
  return {
    regionIds: parseIdListParam(searchParams, "regionIds"),
    areaIds: parseIdListParam(searchParams, "areaIds"),
    territoryIds: parseIdListParam(searchParams, "territoryIds"),
    zoneIds: parseIdListParam(searchParams, "zoneIds"),
    managerIds: parseIdListParam(searchParams, "managerIds"),
    productGroupIds: parseIdListParam(searchParams, "productGroupIds"),
    productIds: parseIdListParam(searchParams, "productIds"),
    distributorIds: parseIdListParam(searchParams, "distributorIds"),
  };
}

export function parseYearMonth(
  searchParams: URLSearchParams
): { year: number; month: number } | { error: string } {
  const yearRaw = searchParams.get("year");
  const monthRaw = searchParams.get("month");
  if (!yearRaw || !monthRaw) {
    return { error: "year and month are required" };
  }
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "year must be an integer between 2000 and 2100" };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "month must be an integer between 1 and 12" };
  }
  return { year, month };
}

/** Sum numeric columns; recompute % from totals (not average of row %). */
export function totalDistributorWise(rows: DistributorWiseRow[]): DistributorWiseRow | null {
  if (rows.length === 0) return null;

  const acc = rows.reduce(
    (sum, row) => ({
      targetUnits: sum.targetUnits + row.targetUnits,
      salesUnits: sum.salesUnits + row.salesUnits,
      lmtdSalesUnits: sum.lmtdSalesUnits + row.lmtdSalesUnits,
      targetValue: sum.targetValue + row.targetValue,
      salesValue: sum.salesValue + row.salesValue,
      lmtdSalesValue: sum.lmtdSalesValue + row.lmtdSalesValue,
      closingStockUnits: sum.closingStockUnits + row.closingStockUnits,
      stockValue: sum.stockValue + row.stockValue,
    }),
    {
      targetUnits: 0,
      salesUnits: 0,
      lmtdSalesUnits: 0,
      targetValue: 0,
      salesValue: 0,
      lmtdSalesValue: 0,
      closingStockUnits: 0,
      stockValue: 0,
    }
  );

  return {
    distributorName: "Total",
    city: "",
    asOfDate: "",
    lmtdAsOfDate: null,
    ...acc,
    targetAchvPercent: computeTargetAchvPercent(acc.salesValue, acc.targetValue),
    lmtdPercent: computeLmtdPercent(acc.salesValue, acc.lmtdSalesValue),
  };
}

export async function buildDistributorWiseReport(
  filters: MonthlyReportFilters,
  year: number,
  month: number
): Promise<DistributorWiseResponse> {
  const { period, grainRows } = await loadMonthlyGrainRows(filters, { year, month });
  const remainingGrain = filterGrainToLatestDistributorByName(grainRows);
  const rows = collapseDistributorWiseByName(aggregateDistributorWise(remainingGrain));
  const totals = totalDistributorWise(rows);
  const coverage = snapshotCoverageFromGrain(remainingGrain);

  return {
    period: periodDto(period),
    priorPeriod: priorPeriodDto(period),
    filters,
    columns: distributorWiseHeaders(period),
    columnLabels: monthlyReportColumnLabels(period),
    coverage,
    rows,
    totals,
  };
}

export async function resolveDistributorWiseDefaultMonth(): Promise<{
  year: number;
  month: number;
}> {
  return resolveLatestFactMonth();
}
