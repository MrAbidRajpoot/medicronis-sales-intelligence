/**
 * Product Wise report: aggregation, totals, JSON shaping.
 * Reuses filter/period parsing from Distributor Wise. Server-only.
 */

import {
  computeLmtdPercent,
  computeTargetAchvPercent,
} from "@/lib/ssr-data";
import { aggregateProductWise } from "./metrics";
import { loadMonthlyGrainRows, resolveLatestFactMonth } from "./query";
import {
  monthlyReportColumnLabels,
  productWiseHeaders,
  type MonthlyReportFilters,
  type MonthlyReportPeriod,
  type ProductWiseRow,
} from "./types";
import type { ProductWisePeriodDto, ProductWiseResponse } from "./product-wise-client";

export type { ProductWisePeriodDto, ProductWiseResponse };
export {
  parseMonthlyReportFilters,
  parseYearMonth,
  parseIdListParam,
} from "./distributor-wise";
export {
  appendFilterQueryParams,
  formatProductWiseCell,
} from "./product-wise-client";

function toIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function periodDto(period: MonthlyReportPeriod): ProductWisePeriodDto {
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

/** Sum numeric columns; recompute % from totals (not average of row %). */
export function totalProductWise(rows: ProductWiseRow[]): ProductWiseRow | null {
  if (rows.length === 0) return null;

  const acc = rows.reduce(
    (sum, row) => ({
      targetUnits: sum.targetUnits + row.targetUnits,
      salesUnits: sum.salesUnits + row.salesUnits,
      lmtdSalesUnits: sum.lmtdSalesUnits + row.lmtdSalesUnits,
      targetValue: sum.targetValue + row.targetValue,
      salesValue: sum.salesValue + row.salesValue,
      lmtdSalesValue: sum.lmtdSalesValue + row.lmtdSalesValue,
      stockUnits: sum.stockUnits + row.stockUnits,
      stockValue: sum.stockValue + row.stockValue,
    }),
    {
      targetUnits: 0,
      salesUnits: 0,
      lmtdSalesUnits: 0,
      targetValue: 0,
      salesValue: 0,
      lmtdSalesValue: 0,
      stockUnits: 0,
      stockValue: 0,
    }
  );

  return {
    productName: "Total",
    ...acc,
    targetAchvPercent: computeTargetAchvPercent(acc.salesValue, acc.targetValue),
    lmtdPercent: computeLmtdPercent(acc.salesValue, acc.lmtdSalesValue),
  };
}

export async function buildProductWiseReport(
  filters: MonthlyReportFilters,
  year: number,
  month: number
): Promise<ProductWiseResponse> {
  const { period, grainRows } = await loadMonthlyGrainRows(filters, { year, month });
  const rows = aggregateProductWise(grainRows);
  const totals = totalProductWise(rows);

  return {
    period: periodDto(period),
    priorPeriod: priorPeriodDto(period),
    filters,
    columns: productWiseHeaders(period),
    columnLabels: monthlyReportColumnLabels(period),
    rows,
    totals,
  };
}

export async function resolveProductWiseDefaultMonth(): Promise<{
  year: number;
  month: number;
}> {
  return resolveLatestFactMonth();
}
