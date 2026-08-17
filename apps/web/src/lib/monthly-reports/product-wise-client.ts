/**
 * Client-safe types and helpers for Product Wise UI (no Prisma / Node imports).
 */

import {
  appendFilterQueryParams,
  formatDistributorWiseCell,
  type DistributorWisePeriodDto,
} from "./distributor-wise-client";
import type {
  MonthlyReportColumnLabels,
  MonthlyReportFilters,
  MonthlySnapshotCoverage,
  ProductWiseRow,
} from "./types";

export type ProductWisePeriodDto = DistributorWisePeriodDto;

export interface ProductWiseResponse {
  period: ProductWisePeriodDto;
  priorPeriod: { year: number; month: number; monthName: string };
  filters: MonthlyReportFilters;
  columns: string[];
  columnLabels: MonthlyReportColumnLabels;
  coverage: MonthlySnapshotCoverage | null;
  rows: ProductWiseRow[];
  totals: ProductWiseRow | null;
}

export const formatProductWiseCell = formatDistributorWiseCell;
export { appendFilterQueryParams };
