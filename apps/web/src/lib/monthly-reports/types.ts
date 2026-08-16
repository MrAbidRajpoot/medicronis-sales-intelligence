/**
 * Shared types for monthly management reports (Distributor Wise / Product Wise / later Combine).
 * Country is intentionally omitted — Excel "City" maps to Territory name.
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

/** Calendar-month period for a monthly report (UTC). LMTD = full prior calendar month. */
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
 * Distributor × product grain after current/prior month sales, targets, and latest-in-month stock.
 * Aggregators roll these up; percents are recomputed after sum.
 */
export interface MonthlyGrainRow {
  distributorId: string;
  distributorName: string;
  /** Territory name — Excel "City". */
  city: string;
  productId: string;
  productName: string;
  sellingPrice: number;
  targetUnits: number;
  salesUnits: number;
  lmtdSalesUnits: number;
  targetValue: number;
  salesValue: number;
  lmtdSalesValue: number;
  /** Latest non-null closingStock in current month for this distributor×product (0 if none). */
  closingStockUnits: number;
  stockValue: number;
}

/** Aggregated row matching sheet "Distributor Wise". */
export interface DistributorWiseRow {
  distributorName: string;
  city: string;
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
  };
}

/** Ordered Distributor Wise headers (exact sheet/UI labels). */
export function distributorWiseHeaders(period: MonthlyReportPeriod): string[] {
  const labels = monthlyReportColumnLabels(period);
  return [
    "Distributor Name",
    "City",
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
