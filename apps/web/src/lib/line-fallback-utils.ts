import type {
  CanonicalField,
  LineFieldSource,
  LineParserConfig,
  LineParserFieldMappings,
  TemplateConfig,
} from "@/lib/pdf-template-types";
import { REQUIRED_CANONICAL_FIELDS } from "@/lib/pdf-template-types";

export const DEFAULT_RATE_PATTERN = String.raw`\d+\.\d{2}`;

export function isLineFallbackStructure(headerStructure: string | undefined): boolean {
  return headerStructure === "line_fallback";
}

export function isLineFieldMapped(source: LineFieldSource | undefined): boolean {
  if (!source) return false;
  switch (source.kind) {
    case "token_index":
      return Number.isFinite(source.index) && source.index >= 0;
    case "token_range":
      return (
        Number.isFinite(source.start) &&
        Number.isFinite(source.end) &&
        source.start >= 0 &&
        source.end >= source.start
      );
    case "after_rate_index":
      return Number.isFinite(source.index);
    case "rate_pattern":
    case "before_rate":
      return true;
    default:
      return false;
  }
}

/**
 * Derive fieldMappings from legacy salesQtyColumn / salesAmountColumn / pipe columns
 * when fieldMappings is absent. Preserves extraction equivalence for saved templates.
 */
export function resolveLineFieldMappings(
  lineParser: LineParserConfig | undefined
): LineParserFieldMappings {
  if (!lineParser) return {};

  if (lineParser.fieldMappings && Object.keys(lineParser.fieldMappings).length > 0) {
    return { ...lineParser.fieldMappings };
  }

  const mode = lineParser.mode ?? "rate_and_columns";
  const mappings: LineParserFieldMappings = {};

  if (mode === "pipe_table") {
    if (lineParser.productColumn !== undefined) {
      mappings.product_name = { kind: "token_index", index: lineParser.productColumn };
    }
    if (lineParser.rateColumn !== undefined) {
      mappings.unit_price = { kind: "token_index", index: lineParser.rateColumn };
    }
    if (lineParser.salesQtyColumn !== undefined) {
      mappings.sales_qty = { kind: "token_index", index: lineParser.salesQtyColumn };
    }
    if (lineParser.salesAmountColumn !== undefined) {
      mappings.sales_amount = { kind: "token_index", index: lineParser.salesAmountColumn };
    }
    return mappings;
  }

  if (mode === "trailing_integers") {
    mappings.product_name = { kind: "before_rate" };
    if (lineParser.salesQtyColumn !== undefined) {
      mappings.sales_qty = { kind: "after_rate_index", index: lineParser.salesQtyColumn };
    }
    if (lineParser.salesAmountColumn !== undefined) {
      mappings.sales_amount = {
        kind: "after_rate_index",
        index: lineParser.salesAmountColumn,
      };
    }
    return mappings;
  }

  // rate_and_columns (and regex uses pattern groups separately)
  mappings.product_name = { kind: "before_rate" };
  mappings.unit_price = {
    kind: "rate_pattern",
    ...(lineParser.ratePattern ? { pattern: lineParser.ratePattern } : {}),
  };
  if (lineParser.salesQtyColumn !== undefined) {
    mappings.sales_qty = { kind: "after_rate_index", index: lineParser.salesQtyColumn };
  }
  if (lineParser.salesAmountColumn !== undefined) {
    mappings.sales_amount = {
      kind: "after_rate_index",
      index: lineParser.salesAmountColumn,
    };
  }
  return mappings;
}

export function isLineParserConfigured(lineParser: LineParserConfig | undefined): boolean {
  if (!lineParser?.enabled || !lineParser.mode) return false;

  if (lineParser.mode === "regex") {
    return Boolean(lineParser.pattern?.trim());
  }

  const mappings = resolveLineFieldMappings(lineParser);

  const hasRequiredFromMappings = REQUIRED_CANONICAL_FIELDS.every((field) =>
    isLineFieldMapped(mappings[field])
  );
  if (hasRequiredFromMappings) return true;

  // Legacy fallbacks when fieldMappings partially absent
  switch (lineParser.mode) {
    case "trailing_integers":
      return (
        lineParser.salesQtyColumn !== undefined &&
        lineParser.salesAmountColumn !== undefined &&
        (lineParser.trailingNumericCount ?? 0) > 0
      );
    case "pipe_table":
      return (
        lineParser.productColumn !== undefined &&
        lineParser.salesQtyColumn !== undefined &&
        lineParser.salesAmountColumn !== undefined
      );
    case "rate_and_columns":
    default:
      return (
        lineParser.salesQtyColumn !== undefined && lineParser.salesAmountColumn !== undefined
      );
  }
}

/** Token indices highlighted for a field mapping (for UI chips). */
export function tokenIndicesForSource(source: LineFieldSource | undefined): number[] {
  if (!source) return [];
  switch (source.kind) {
    case "token_index":
      return [source.index];
    case "token_range": {
      const indices: number[] = [];
      for (let i = source.start; i <= source.end; i++) indices.push(i);
      return indices;
    }
    default:
      return [];
  }
}

/** Detect required-field token conflicts (same absolute token mapped twice). */
export function findFieldMappingConflicts(
  mappings: LineParserFieldMappings
): Array<{ fields: CanonicalField[]; index: number }> {
  const byIndex = new Map<number, CanonicalField[]>();
  const tracked: CanonicalField[] = [
    "product_name",
    "unit_price",
    "sales_qty",
    "sales_amount",
    "returns_qty",
    "closing_stock",
  ];

  for (const field of tracked) {
    const source = mappings[field];
    if (!source) continue;
    for (const idx of tokenIndicesForSource(source)) {
      const list = byIndex.get(idx) ?? [];
      list.push(field);
      byIndex.set(idx, list);
    }
  }

  const conflicts: Array<{ fields: CanonicalField[]; index: number }> = [];
  byIndex.forEach((fields, index) => {
    if (fields.length > 1) conflicts.push({ fields, index });
  });
  return conflicts;
}

export function mergeLineParser(
  base: LineParserConfig | undefined,
  override: Partial<LineParserConfig> | undefined
): LineParserConfig {
  const merged: LineParserConfig = {
    enabled: true,
    mode: "rate_and_columns",
    ...base,
    ...override,
  };
  if (base?.fieldMappings || override?.fieldMappings) {
    merged.fieldMappings = {
      ...(base?.fieldMappings ?? {}),
      ...(override?.fieldMappings ?? {}),
    };
  }
  return merged;
}

/** User-facing validation for Family J wizard save gate. */
export function getLineFallbackIssues(
  config: TemplateConfig,
  previewRowCount: number
): string[] {
  const issues: string[] = [];

  if (!isLineFallbackStructure(config.headerStructure)) {
    return ["Invalid header structure for line parser"];
  }

  if (!isLineParserConfigured(config.lineParser)) {
    issues.push("Map Product Name, Sales Units, and Sales Value on a sample line");
  }

  if (previewRowCount === 0) {
    issues.push("Live preview must show at least one extracted row");
  }

  return issues;
}

export const LINE_PARSER_MODE_LABELS: Record<
  NonNullable<LineParserConfig["mode"]>,
  string
> = {
  rate_and_columns: "Rate + numeric columns (most Family J PDFs)",
  trailing_integers: "Trailing integer block",
  regex: "Custom regex pattern",
  pipe_table: "Pipe-delimited columns",
};

export const DEFAULT_LINE_PARSER: LineParserConfig = {
  enabled: true,
  mode: "rate_and_columns",
  salesQtyColumn: 2,
  salesAmountColumn: 3,
  minNumericColumns: 4,
  treatDashAsZero: true,
  fieldMappings: {
    product_name: { kind: "before_rate" },
    unit_price: { kind: "rate_pattern" },
    sales_qty: { kind: "after_rate_index", index: 2 },
    sales_amount: { kind: "after_rate_index", index: 3 },
  },
};
