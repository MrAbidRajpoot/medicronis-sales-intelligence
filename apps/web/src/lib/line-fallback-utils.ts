import type { LineParserConfig, TemplateConfig } from "@/lib/pdf-template-types";

export function isLineFallbackStructure(headerStructure: string | undefined): boolean {
  return headerStructure === "line_fallback";
}

export function isLineParserConfigured(lineParser: LineParserConfig | undefined): boolean {
  if (!lineParser?.enabled || !lineParser.mode) return false;

  switch (lineParser.mode) {
    case "regex":
      return Boolean(lineParser.pattern?.trim());
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

export function mergeLineParser(
  base: LineParserConfig | undefined,
  override: Partial<LineParserConfig> | undefined
): LineParserConfig {
  return {
    enabled: true,
    mode: "rate_and_columns",
    ...base,
    ...override,
  };
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
    issues.push("Configure line parser settings below");
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
};
