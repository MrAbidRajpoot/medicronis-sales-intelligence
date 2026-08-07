import type {
  CanonicalField,
  HeaderStructure,
  TemplateConfig,
} from "@/lib/pdf-template-types";
import {
  CANONICAL_FIELDS,
  isCanonicalField,
  isHeaderStructure,
  REQUIRED_CANONICAL_FIELDS,
} from "@/lib/pdf-template-types";

const WARN_IF_MISSING: CanonicalField[] = ["unit_price", "closing_stock"];

function mappingIsDefined(config: TemplateConfig, field: CanonicalField): boolean {
  const mapping = config.fields?.[field];
  if (!mapping) return false;
  if (mapping.col !== undefined && mapping.col !== null) return true;
  if (mapping.group?.trim()) return true;
  return false;
}

export function getUnresolvedRequiredFields(config: TemplateConfig): CanonicalField[] {
  return REQUIRED_CANONICAL_FIELDS.filter((field) => !mappingIsDefined(config, field));
}

export function getMissingRecommendedFields(config: TemplateConfig): CanonicalField[] {
  return WARN_IF_MISSING.filter((field) => !mappingIsDefined(config, field));
}

export function validateTemplateConfig(config: unknown):
  | { ok: true; config: TemplateConfig }
  | { ok: false; error: string } {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, error: "config must be a TemplateConfig object" };
  }

  const candidate = config as TemplateConfig;
  if (!isHeaderStructure(candidate.headerStructure)) {
    return { ok: false, error: `Invalid headerStructure: ${String(candidate.headerStructure)}` };
  }

  if (candidate.fields && typeof candidate.fields !== "object") {
    return { ok: false, error: "fields must be an object" };
  }

  for (const [key, mapping] of Object.entries(candidate.fields ?? {})) {
    if (!isCanonicalField(key)) {
      return { ok: false, error: `Unknown canonical field: ${key}` };
    }
    if (mapping && typeof mapping === "object") {
      if (mapping.col !== undefined && typeof mapping.col !== "number") {
        return { ok: false, error: `${key}.col must be a number` };
      }
    }
  }

  const unresolved = getUnresolvedRequiredFields(candidate);
  if (unresolved.length > 0) {
    return {
      ok: false,
      error: `Required fields unmapped: ${unresolved.join(", ")}`,
    };
  }

  return { ok: true, config: candidate };
}

export function buildTemplateConfigFromPreset(
  headerStructure: HeaderStructure,
  defaultConfig: TemplateConfig,
  fields?: TemplateConfig["fields"]
): TemplateConfig {
  return {
    ...defaultConfig,
    headerStructure,
    fields: fields ?? defaultConfig.fields ?? {},
  };
}

export { CANONICAL_FIELDS, REQUIRED_CANONICAL_FIELDS, WARN_IF_MISSING };
