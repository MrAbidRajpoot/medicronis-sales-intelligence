import type { ExcelTemplateConfig } from "@/lib/excel-template-types";
import { validateExcelTemplateConfig } from "@/lib/excel-template-validation";
import { validateTemplateConfig } from "@/lib/template-validation";

export type TemplateReadinessInput = {
  pdfFormatId?: string | null;
  activeTemplate?: {
    config: unknown;
    configuredAt?: Date | string | null;
    excelConfig?: unknown;
    excelConfiguredAt?: Date | string | null;
  } | null;
};

/** PDF upload-ready when wizard saved a validated PDF template. */
export function isDistributorUploadReady(input: TemplateReadinessInput): boolean {
  if (!input.pdfFormatId || !input.activeTemplate) return false;
  if (!input.activeTemplate.configuredAt) return false;
  const validation = validateTemplateConfig(input.activeTemplate.config);
  return validation.ok;
}

/** Excel upload-ready when Excel column map is saved and valid. */
export function isDistributorExcelReady(input: {
  activeTemplate?: {
    excelConfig?: unknown;
    excelConfiguredAt?: Date | string | null;
  } | null;
}): boolean {
  const tmpl = input.activeTemplate;
  if (!tmpl?.excelConfiguredAt) return false;
  const validation = validateExcelTemplateConfig(tmpl.excelConfig);
  return validation.ok;
}

/**
 * Overall upload readiness for UI badges / distributor pickers.
 * EXCEL_ONLY → Excel map required; BOTH → PDF template required (Excel optional until .xlsx).
 */
export function isDistributorInputReady(input: TemplateReadinessInput & {
  inputMode?: "BOTH" | "EXCEL_ONLY" | null;
}): boolean {
  if (input.inputMode === "EXCEL_ONLY") {
    return isDistributorExcelReady(input);
  }
  return isDistributorUploadReady(input);
}

export function templateReadinessLabel(ready: boolean): string {
  return ready ? "Template ready" : "Template required";
}

export function getExcelConfigFromTemplate(
  excelConfig: unknown
): ExcelTemplateConfig | null {
  const validation = validateExcelTemplateConfig(excelConfig);
  return validation.ok ? validation.config : null;
}
