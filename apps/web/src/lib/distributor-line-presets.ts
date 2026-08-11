import type { LineParserConfig, TemplateConfig } from "@/lib/pdf-template-types";
import { JULY_CLOSING_DISTRIBUTORS } from "../../../../prisma/july-closing-distributors";

/**
 * Distributor-specific line-parser overrides (from July Closing analysis).
 * Used to pre-fill Family J wizard when pdfplumber finds no table headers.
 */
export function getDistributorLinePreset(distributorCode: string): TemplateConfig | null {
  const entry = JULY_CLOSING_DISTRIBUTORS.find(
    (d: { code: string }) => d.code.toUpperCase() === distributorCode.toUpperCase()
  );
  if (!entry?.templateConfig) return null;
  return entry.templateConfig;
}
