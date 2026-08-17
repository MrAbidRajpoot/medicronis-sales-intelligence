/**
 * Shared types for monthly management reports (Distributor Wise / Product Wise / later Combine).
 * Country is intentionally omitted — Excel "City" maps to Territory name.
 * Sales/stock are per-distributor MTD snapshots (latest READY SSR day), never summed across days.
 */

/** Optional multi-select filters; empty/undefined = no restriction. Dimensions AND together. */
export interface MonthlyReportFilters {
  regionIds?: string[];
  areaIds?: string[];
  territoryIds?: string[];
  zoneIds?: string[];
  /** Resolved via SSR manager priority: territory → area → region → zone. */
  managerIds?: string[];
  /** Product.productGroupId (e.g. Medicronis | Transformer). */
  productGroupIds?: string[];
  productIds?: string[];
  distributorIds?: string[];
}

/**
 * Min/max till-dates among included distributors (each uses its own latest SSR snapshot).
 * ISO YYYY-MM-DD. Null coverage when the report has no included distributors.
 */
export interface MonthlySnapshotCoverage {
  fromDate: string;
  toDate: string;
  priorFromDate: string | null;
  priorToDate: string | null;
}

/** Calendar-month period for a monthly report (UTC). LMTD = prior-month snapshot per distributor. */
export interface MonthlyReportPeriod {
  /** Any day used to select the month (or last day when year/month given). */
  asOfDate: Date;
  year: number;
  /** 1–12 */
  month: number;
  monthStart: Date;
  monthEnd: Date;
  priorMonthStart: Date;
  priorMonthEnd: Date;
  /** e.g. "July" — for dynamic column labels */
  monthName: string;
  /** e.g. "June" */
  priorMonthName: string;
}

/** Input for period resolution. */
export type MonthlyReportPeriodInput =
  | { asOfDate: Date }
  | { year: number; month: number };

/**
 * Distributor × product grain from each distributor's latest READY SSR snapshot in the month
 * (and independently in the prior month for LMTD). Aggregators roll these up; percents after sum.
 */
export interface MonthlyGrainRow {
  distributorId: string;
  distributorName: string;
  /** Territory name — Excel "City". */
  city: string;
  productId: string;
  productName: string;
  /** This distributor's latestCurrentAsOf (snapshot day for sales/stock/S.P). */
  asOfDate: Date;
  /** This distributor's latestPriorAsOf, or null when no prior-month snapshot. */
  lmtdAsOfDate: Date | null;
  sellingPrice: number;
  targetUnits: number;
  salesUnits: number;
  lmtdSalesUnits: number;
  targetValue: number;
  salesValue: number;
  lmtdSalesValue: number;
  /** Closing stock on asOfDate (0 if null/missing). */
  closingStockUnits: number;
  stockValue: number;
}

/** Aggregated row matching sheet "Distributor Wise". */
export interface DistributorWiseRow {
  distributorName: string;
  city: string;
  /** ISO YYYY-MM-DD till date (latestCurrentAsOf). Empty on the Total row. */
  asOfDate: string;
  /** ISO YYYY-MM-DD prior-month snapshot, or null. */
  lmtdAsOfDate: string | null;
  targetUnits: number;
  salesUnits: number;
  lmtdSalesUnits: number;
  targetValue: number;
  salesValue: number;
  targetAchvPercent: number | "-";
  lmtdSalesValue: number;
  lmtdPercent: number | "-";
  closingStockUnits: number;
  stockValue: number;
}

/** Aggregated row matching sheet "Product Wise". */
export interface ProductWiseRow {
  productName: string;
  targetUnits: number;
  salesUnits: number;
  lmtdSalesUnits: number;
  targetValue: number;
  salesValue: number;
  targetAchvPercent: number | "-";
  lmtdSalesValue: number;
  lmtdPercent: number | "-";
  stockUnits: number;
  stockValue: number;
}

/** Dynamic headers — reference Excel month labels are inconsistent; always derive from period. */
export interface MonthlyReportColumnLabels {
  salesUnits: string;
  lmtdSalesUnits: string;
  salesValue: string;
  lmtdSalesValue: string;
  targetUnits: string;
  targetValue: string;
  targetAchvPercent: string;
  lmtdPercent: string;
  closingStockUnits: string;
  stockValue: string;
  tillDate: string;
}

export function monthlyReportColumnLabels(period: MonthlyReportPeriod): MonthlyReportColumnLabels {
  const m = period.monthName;
  const p = period.priorMonthName;
  return {
    salesUnits: `${m} Sales Units`,
    lmtdSalesUnits: `${p} LMTD Sales Unit`,
    salesValue: `${m} Sales Value`,
    lmtdSalesValue: "LMTD Sales Value",
    targetUnits: "Target Units",
    targetValue: "Target Value",
    targetAchvPercent: "Target Achv. %",
    lmtdPercent: "LMTD %age",
    closingStockUnits: "Closing Stock Units",
    stockValue: "Stock Value",
    tillDate: "Till date",
  };
}

/** Ordered Distributor Wise headers (exact sheet/UI labels). */
export function distributorWiseHeaders(period: MonthlyReportPeriod): string[] {
  const labels = monthlyReportColumnLabels(period);
  return [
    "Distributor Name",
    "City",
    labels.tillDate,
    labels.targetUnits,
    labels.salesUnits,
    labels.lmtdSalesUnits,
    labels.targetValue,
    labels.salesValue,
    labels.targetAchvPercent,
    labels.lmtdSalesValue,
    labels.lmtdPercent,
    labels.closingStockUnits,
    labels.stockValue,
  ];
}

/** Ordered Product Wise headers (exact sheet/UI labels — "Stock Unit" singular). */
export function productWiseHeaders(period: MonthlyReportPeriod): string[] {
  const labels = monthlyReportColumnLabels(period);
  return [
    "Product Name",
    labels.targetUnits,
    labels.salesUnits,
    labels.lmtdSalesUnits,
    labels.targetValue,
    labels.salesValue,
    labels.targetAchvPercent,
    labels.lmtdSalesValue,
    labels.lmtdPercent,
    "Stock Unit",
    labels.stockValue,
  ];
}

export function distributorWiseSnapshotBanner(monthName: string): string {
  return `Each distributor uses its own latest SSR date in ${monthName}. Distributors with no SSR this month are excluded.`;
}

export function productWiseSnapshotBanner(monthName: string): string {
  return `Product totals combine each distributor's latest SSR snapshot in ${monthName} (dates may differ by distributor).`;
}

export function formatSnapshotCoverageSubtitle(
  coverage: MonthlySnapshotCoverage | null,
  priorMonthName: string
): string {
  if (!coverage) return "";
  const current =
    coverage.fromDate === coverage.toDate
      ? coverage.fromDate
      : `${coverage.fromDate} → ${coverage.toDate}`;
  if (!coverage.priorFromDate || !coverage.priorToDate) {
    return `Coverage ${current} · ${priorMonthName} LMTD —`;
  }
  const prior =
    coverage.priorFromDate === coverage.priorToDate
      ? coverage.priorFromDate
      : `${coverage.priorFromDate} → ${coverage.priorToDate}`;
  return `Coverage ${current} · ${priorMonthName} LMTD ${prior}`;
}
