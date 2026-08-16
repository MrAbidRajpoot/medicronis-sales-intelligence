/**
 * Client-safe types and helpers for Distributor Wise UI (no Prisma / Node imports).
 */

import type {
  DistributorWiseRow,
  MonthlyReportColumnLabels,
  MonthlyReportFilters,
} from "./types";

export interface DistributorWisePeriodDto {
  year: number;
  month: number;
  monthName: string;
  priorMonthName: string;
  monthStart: string;
  monthEnd: string;
  priorMonthStart: string;
  priorMonthEnd: string;
}

export interface DistributorWiseResponse {
  period: DistributorWisePeriodDto;
  priorPeriod: { year: number; month: number; monthName: string };
  filters: MonthlyReportFilters;
  columns: string[];
  columnLabels: MonthlyReportColumnLabels;
  rows: DistributorWiseRow[];
  totals: DistributorWiseRow | null;
}

/** Mirrors formatSsrCell for money / units / percent (SSR display conventions). */
export function formatDistributorWiseCell(
  value: number | "-",
  kind: "units" | "money" | "percent"
): string {
  if (kind === "percent") {
    return value === "-" || value == null ? "-" : `${(value * 100).toFixed(2)}%`;
  }
  const numericValue = typeof value === "number" ? value : 0;
  if (kind === "money") {
    return numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return numericValue.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function appendFilterQueryParams(
  params: URLSearchParams,
  filters: MonthlyReportFilters
): void {
  const entries: [keyof MonthlyReportFilters, string[] | undefined][] = [
    ["regionIds", filters.regionIds],
    ["areaIds", filters.areaIds],
    ["territoryIds", filters.territoryIds],
    ["zoneIds", filters.zoneIds],
    ["managerIds", filters.managerIds],
    ["productGroupIds", filters.productGroupIds],
    ["productIds", filters.productIds],
    ["distributorIds", filters.distributorIds],
  ];
  for (const [key, ids] of entries) {
    if (ids?.length) params.set(key, ids.join(","));
  }
}
