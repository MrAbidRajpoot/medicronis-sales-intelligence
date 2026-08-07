/**
 * Config-driven PDF extraction types.
 *
 * DistributorTemplate.config follows TemplateConfig.
 * PdfFormat.defaultConfig is the family preset; distributor templates may override fields.
 */

export const CANONICAL_FIELDS = [
  "product_name",
  "sales_qty",
  "sales_amount",
  "unit_price",
  "returns_qty",
  "closing_stock",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_CANONICAL_FIELDS = [
  "product_name",
  "sales_qty",
  "sales_amount",
] as const satisfies readonly CanonicalField[];

export const RECOMMENDED_CANONICAL_FIELDS = [
  "unit_price",
  "returns_qty",
  "closing_stock",
] as const satisfies readonly CanonicalField[];

export const HEADER_STRUCTURES = [
  "single_row",
  "grouped_two_row",
  "title_block_then_table",
  /** Table extraction disabled; use line parser (Family J). */
  "line_fallback",
] as const;

export type HeaderStructure = (typeof HEADER_STRUCTURES)[number];

/** Column index and/or grouped header label path (group → leaf). */
export interface FieldMapping {
  col?: number;
  group?: string;
  leaf?: string;
}

export interface TemplateDetectionConfig {
  titlePatterns?: string[];
  headerKeywords?: string[];
  /** Boost Family J when pdfplumber finds no usable tables. */
  noTableIndicator?: boolean;
}

export interface LineParserConfig {
  enabled: boolean;
  /** regex | rate_and_columns | trailing_integers */
  mode?: "regex" | "rate_and_columns" | "trailing_integers";
  /** Optional regex with groups: product, qty, price, amount */
  pattern?: string;
  /** Named capture group indices when using regex mode */
  groups?: Partial<Record<"product" | "unit_price" | "sales_qty" | "sales_amount", number>>;
  ratePattern?: string;
  /** 0-based index into numeric tokens after rate (or trailing block) */
  salesQtyColumn?: number;
  salesAmountColumn?: number;
  trailingNumericCount?: number;
  minNumericColumns?: number;
  codePrefix?: boolean;
  treatDashAsZero?: boolean;
}

export interface PdfPlumberSettings {
  vertical_strategy?: string;
  horizontal_strategy?: string;
  snap_tolerance?: number;
  join_tolerance?: number;
}

export type ExtractMethod = "table" | "line_fallback" | "alternate_settings";

/**
 * Per-distributor (or format preset) extraction config stored in
 * DistributorTemplate.config and seeded from PdfFormat.defaultConfig.
 */
export interface TemplateConfig {
  headerStructure: HeaderStructure;
  skipRowsBeforeHeader?: number;
  skipRowsContaining?: string[];
  /** When true, skip pdfplumber table extraction (Family J). */
  tableExtractionDisabled?: boolean;
  fields: Partial<Record<CanonicalField, FieldMapping>>;
  detection?: TemplateDetectionConfig;
  lineParser?: LineParserConfig;
  /** Retry table extraction with these pdfplumber settings before line fallback (Family Z). */
  pdfPlumberSettings?: PdfPlumberSettings;
}

/** PdfFormat row shape for API / admin UI (mirrors Prisma PdfFormat). */
export interface PdfFormatPreset {
  code: string;
  name: string;
  family: string;
  headerStructure: HeaderStructure;
  defaultConfig: TemplateConfig;
  isActive?: boolean;
}

export function isCanonicalField(value: string): value is CanonicalField {
  return (CANONICAL_FIELDS as readonly string[]).includes(value);
}

export function isHeaderStructure(value: string): value is HeaderStructure {
  return (HEADER_STRUCTURES as readonly string[]).includes(value);
}
