import type {
  TemplateConfig,
  ExtractMethod,
  CanonicalField,
  HeaderStructure,
  LineParserPreview,
} from "@/lib/pdf-template-types";

const PDF_WORKER_URL = process.env.PDF_WORKER_URL ?? "http://localhost:8000";

export interface ExtractedRowPayload {
  raw_product_text: string;
  raw_product_code?: string | null;
  quantity: number;
  unit_price?: number | null;
  gross_value?: number | null;
  returns_qty?: number | null;
  closing_stock?: number | null;
  transaction_date?: string | null;
  customer_name?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExtractResult {
  distributor_hint: string;
  suggested_format_code?: string | null;
  distributor_name_hint?: string | null;
  rows: ExtractedRowPayload[];
  confidence: number;
  template_used: string;
  template_resolution_ok?: boolean;
  extract_method?: ExtractMethod;
  needs_template_remap?: boolean;
  page_count: number;
}

export interface MatchedRow extends ExtractedRowPayload {
  match_status: "matched" | "review" | "unknown";
  confidence: number;
  suggested_product_id?: string | null;
  suggested_product_sku?: string | null;
  suggested_product_name?: string | null;
  match_method?: string | null;
}

export interface MatchRowsResult {
  rows: MatchedRow[];
  matched_count: number;
  review_count: number;
  unknown_count: number;
}

export interface ProductSuggestion {
  product_id: string;
  sku: string | null;
  name: string | null;
  confidence: number;
  match_method?: string | null;
}

export interface MatchSuggestionsResult {
  suggestions: ProductSuggestion[];
}

export const SUGGESTION_MIN_SCORE = 60;
export const SUGGESTION_MAX = 4;

export async function getPdfDistributorHint(
  buffer: Buffer,
  filename: string
): Promise<{ distributor_name_hint: string | null }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);

  const res = await fetch(`${PDF_WORKER_URL}/extract-hint`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    return { distributor_name_hint: null };
  }

  return res.json();
}

export async function extractPdf(
  buffer: Buffer,
  filename: string,
  options: {
    distributorCode?: string | null;
    formatCode?: string | null;
    templateConfig: TemplateConfig;
  }
): Promise<ExtractResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
  if (options.distributorCode) {
    form.append("distributor_code", options.distributorCode);
  }
  if (options.formatCode) {
    form.append("format_code", options.formatCode);
  }
  form.append("template_config", JSON.stringify(options.templateConfig));

  const res = await fetch(`${PDF_WORKER_URL}/extract`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error(
        `PDF extract failed (404): PDF worker is missing /extract. Restart it: npm run worker:dev`
      );
    }
    throw new Error(`PDF extract failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function matchRows(payload: {
  rows: ExtractedRowPayload[];
  distributor_id?: string | null;
  mappings: { raw_product_text: string; product_id: string; confidence: number }[];
  products: { id: string; sku: string; name: string }[];
  aliases: { alias: string; product_id: string }[];
}): Promise<MatchRowsResult> {
  const res = await fetch(`${PDF_WORKER_URL}/match-rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Match rows failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function getMatchSuggestions(payload: {
  raw_product_text: string;
  products: { id: string; sku: string; name: string }[];
  aliases: { alias: string; product_id: string }[];
  min_score?: number;
  limit?: number;
}): Promise<MatchSuggestionsResult> {
  const res = await fetch(`${PDF_WORKER_URL}/match-suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Match suggestions failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function checkPdfWorkerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PDF_WORKER_URL}/openapi.json`, { cache: "no-store" });
    if (!res.ok) return false;
    const spec = (await res.json()) as { paths?: Record<string, unknown> };
    return Boolean(spec.paths?.["/extract"]);
  } catch {
    return false;
  }
}

export interface LeafColumn {
  col: number;
  group: string;
  leaf: string;
}

export interface AnalyzeHeadersResult {
  suggestedFormatCode: string;
  confidence: number;
  family: string;
  headerStructure: HeaderStructure;
  headerGrid: string[][];
  detectedGroups: string[];
  leafColumns: LeafColumn[];
  suggestedMappings: Partial<Record<CanonicalField, { col?: number; group?: string; leaf?: string }>>;
  unresolvedFields: CanonicalField[];
  colCount?: number | null;
  usesLineParser?: boolean;
  lineParserPreview?: LineParserPreview | null;
}

export async function analyzeHeaders(
  buffer: Buffer,
  filename: string,
  templateConfig?: TemplateConfig | null
): Promise<AnalyzeHeadersResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
  if (templateConfig) {
    form.append("template_config", JSON.stringify(templateConfig));
  }

  const res = await fetch(`${PDF_WORKER_URL}/analyze-headers`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error(
        `Header analysis failed (404): PDF worker is missing /analyze-headers. Restart it: npm run worker:dev`
      );
    }
    throw new Error(`Header analysis failed (${res.status}): ${text}`);
  }

  return res.json();
}
