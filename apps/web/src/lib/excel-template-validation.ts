import type { ExcelCanonicalField, ExcelTemplateConfig } from "@/lib/excel-template-types";
import {
  EXCEL_CANONICAL_FIELDS,
  EXCEL_RECOMMENDED_FIELDS,
  EXCEL_REQUIRED_FIELDS,
  isExcelCanonicalField,
} from "@/lib/excel-template-types";

function fieldHasCol(
  fields: ExcelTemplateConfig["fields"] | undefined,
  field: ExcelCanonicalField
): boolean {
  const mapping = fields?.[field as keyof ExcelTemplateConfig["fields"]];
  return mapping != null && typeof mapping.col === "number" && mapping.col >= 0;
}

export function getUnresolvedExcelRequiredFields(
  config: Pick<ExcelTemplateConfig, "fields">
): ExcelCanonicalField[] {
  return EXCEL_REQUIRED_FIELDS.filter((field) => !fieldHasCol(config.fields, field));
}

export function getMissingExcelRecommendedFields(
  config: Pick<ExcelTemplateConfig, "fields">
): ExcelCanonicalField[] {
  return EXCEL_RECOMMENDED_FIELDS.filter((field) => !fieldHasCol(config.fields, field));
}

export function validateExcelTemplateConfig(config: unknown):
  | { ok: true; config: ExcelTemplateConfig }
  | { ok: false; error: string } {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, error: "config must be an ExcelTemplateConfig object" };
  }

  const candidate = config as Partial<ExcelTemplateConfig>;

  if (candidate.source !== "excel") {
    return { ok: false, error: 'config.source must be "excel"' };
  }

  if (candidate.headerRow !== undefined && typeof candidate.headerRow !== "number") {
    return { ok: false, error: "headerRow must be a number" };
  }

  if (candidate.headerRow !== undefined && candidate.headerRow < 0) {
    return { ok: false, error: "headerRow must be >= 0" };
  }

  if (candidate.sheetName !== undefined && typeof candidate.sheetName !== "string") {
    return { ok: false, error: "sheetName must be a string" };
  }

  if (
    candidate.skipRowsContaining !== undefined &&
    (!Array.isArray(candidate.skipRowsContaining) ||
      candidate.skipRowsContaining.some((s) => typeof s !== "string"))
  ) {
    return { ok: false, error: "skipRowsContaining must be a string array" };
  }

  if (!candidate.fields || typeof candidate.fields !== "object" || Array.isArray(candidate.fields)) {
    return { ok: false, error: "fields must be an object" };
  }

  for (const [key, mapping] of Object.entries(candidate.fields)) {
    if (!isExcelCanonicalField(key)) {
      return { ok: false, error: `Unknown excel field: ${key}` };
    }
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      return { ok: false, error: `${key} mapping must be an object` };
    }
    if (typeof (mapping as { col?: unknown }).col !== "number") {
      return { ok: false, error: `${key}.col must be a number` };
    }
    if ((mapping as { col: number }).col < 0) {
      return { ok: false, error: `${key}.col must be >= 0` };
    }
  }

  const unresolved = getUnresolvedExcelRequiredFields(candidate as ExcelTemplateConfig);
  if (unresolved.length > 0) {
    return {
      ok: false,
      error: `Required fields unmapped: ${unresolved.join(", ")}`,
    };
  }

  const headerRow = candidate.headerRow ?? 0;

  return {
    ok: true,
    config: {
      source: "excel",
      headerRow,
      ...(candidate.sheetName?.trim() ? { sheetName: candidate.sheetName.trim() } : {}),
      ...(candidate.skipRowsContaining?.length
        ? { skipRowsContaining: candidate.skipRowsContaining }
        : {}),
      fields: candidate.fields as ExcelTemplateConfig["fields"],
    },
  };
}

export { EXCEL_CANONICAL_FIELDS, EXCEL_REQUIRED_FIELDS, EXCEL_RECOMMENDED_FIELDS };
