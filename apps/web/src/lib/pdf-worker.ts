const PDF_WORKER_URL = process.env.PDF_WORKER_URL ?? "http://localhost:8000";

export interface ExtractedRowPayload {
  raw_product_text: string;
  raw_product_code?: string | null;
  quantity: number;
  unit_price?: number | null;
  gross_value?: number | null;
  returns_qty?: number | null;
  transaction_date?: string | null;
  customer_name?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExtractResult {
  distributor_hint: string;
  distributor_name_hint?: string | null;
  rows: ExtractedRowPayload[];
  confidence: number;
  template_used: string;
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

export async function extractPdf(
  buffer: Buffer,
  filename: string,
  distributorCode?: string | null
): Promise<ExtractResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
  if (distributorCode) {
    form.append("distributor_code", distributorCode);
  }

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
