import type { TemplateConfig } from "@/lib/pdf-template-types";
import { validateTemplateConfig } from "@/lib/template-validation";

export type TemplateReadinessInput = {
  pdfFormatId?: string | null;
  activeTemplate?: {
    config: unknown;
    configuredAt?: Date | string | null;
  } | null;
};

/** Distributor is upload-ready when wizard saved a validated template. */
export function isDistributorUploadReady(input: TemplateReadinessInput): boolean {
  if (!input.pdfFormatId || !input.activeTemplate) return false;
  if (!input.activeTemplate.configuredAt) return false;
  const validation = validateTemplateConfig(input.activeTemplate.config);
  return validation.ok;
}

export function templateReadinessLabel(ready: boolean): string {
  return ready ? "Template ready" : "Template required";
}
