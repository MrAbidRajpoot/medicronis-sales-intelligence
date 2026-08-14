/**
 * Per-distributor Excel sales column map.
 * Stored on DistributorTemplate.excelConfig.
 */

import type { CanonicalField } from "@/lib/pdf-template-types";

export const EXCEL_CANONICAL_FIELDS = [
  "product_name",
  "sales_qty",
  "unit_price",
  "closing_stock",
  "sales_amount",
  "returns_qty",
] as const satisfies readonly CanonicalField[];

export type ExcelCanonicalField = (typeof EXCEL_CANONICAL_FIELDS)[number];

/** Required for Excel sales import. */
export const EXCEL_REQUIRED_FIELDS = [
  "product_name",
  "sales_qty",
] as const satisfies readonly ExcelCanonicalField[];

/** Recommended — warn on save if missing; still allow save. */
export const EXCEL_RECOMMENDED_FIELDS = [
  "unit_price",
  "closing_stock",
] as const satisfies readonly ExcelCanonicalField[];

export interface ExcelFieldMapping {
  /** 0-based column index. */
  col: number;
}

export interface ExcelTemplateConfig {
  source: "excel";
  /** 0-based header row index (default 0). */
  headerRow?: number;
  /** Optional sheet name; otherwise first worksheet. */
  sheetName?: string;
  skipRowsContaining?: string[];
  fields: {
    product_name: ExcelFieldMapping;
    sales_qty: ExcelFieldMapping;
    unit_price?: ExcelFieldMapping;
    closing_stock?: ExcelFieldMapping;
    sales_amount?: ExcelFieldMapping;
    returns_qty?: ExcelFieldMapping;
  };
}

export function isExcelCanonicalField(value: string): value is ExcelCanonicalField {
  return (EXCEL_CANONICAL_FIELDS as readonly string[]).includes(value);
}
