/**
 * Auto-suggest PdfFormat from PDF text and optional table header hints.
 * Mirrors services/pdf-worker/presets.suggest_pdf_format scoring logic.
 */

import { PDF_FORMAT_PRESETS } from "../../../prisma/pdf-format-presets";
import type { TemplateConfig } from "./pdf-template-types";

export interface TableHints {
  colCount?: number | null;
  headerText?: string;
  tableCount?: number;
  hasProductTable?: boolean;
}

export interface PdfFormatSuggestion {
  code: string;
  family: string;
  confidence: number;
  scores?: Record<string, number>;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function scorePreset(
  code: string,
  config: TemplateConfig,
  textUpper: string,
  hints: Required<TableHints>,
): number {
  const detection = config.detection ?? {};
  let score = 0;
  const headerUpper = hints.headerText;
  const colCount = hints.colCount;
  const erpStatement =
    textUpper.includes("SALES AND STOCK STATEMENT") ||
    headerUpper.includes("SALES AND STOCK STATEMENT");

  const titleHits = (detection.titlePatterns ?? [])
    .filter(
      (pattern) =>
        textUpper.includes(pattern.toUpperCase()) || headerUpper.includes(pattern.toUpperCase()),
    )
    .map(() => 0.45);
  if (titleHits.length > 0 && !(code === "fmt-j-no-table" && erpStatement)) {
    score += Math.max(...titleHits);
  }

  const keywords = detection.headerKeywords ?? [];
  if (keywords.length > 0) {
    const matched = keywords.filter(
      (kw) => textUpper.includes(kw.toUpperCase()) || headerUpper.includes(kw.toUpperCase()),
    ).length;
    if (matched >= 2) {
      score += 0.15 * matched;
    } else if (matched === 1 && keywords.length === 1) {
      score += 0.2;
    }
  }

  switch (code) {
    case "fmt-a-ssr-stock-return":
      if (headerUpper.includes("ITEM") && headerUpper.includes("NET SALE")) score += 0.35;
      if (colCount === 16 || colCount === 17) score += 0.15;
      break;
    case "fmt-b-medicronis-erp":
      if (erpStatement) score += 0.45;
      if (headerUpper.includes("DESCRIPTION") && headerUpper.includes("NET SALE")) score += 0.2;
      break;
    case "fmt-c-item-desc-net-sales":
      if (headerUpper.includes("ITEM DESCRIPTION")) score += 0.4;
      else if (
        headerUpper.includes("DESCRIPTION") &&
        (headerUpper.includes("NET SALES") || headerUpper.includes("SALE VALUE"))
      ) {
        score += 0.25;
      }
      break;
    case "fmt-d-product-name-tp-tax":
      if (headerUpper.includes("PRODUCT NAME") && colCount === 19) score += 0.45;
      break;
    case "fmt-e-trad-rate-net-sale":
      if (
        (headerUpper.includes("TRAD RATE") ||
          headerUpper.includes("TRADE RATE") ||
          textUpper.includes("TRADE RATE")) &&
        headerUpper.includes("NET SALE")
      ) {
        score += 0.45;
      }
      break;
    case "fmt-f-simple-sales":
      if (
        (headerUpper.includes("DESCRIPTION / PACK") || headerUpper.includes("DESCRIPTION PACK")) &&
        (headerUpper.includes("SALES QTY") || headerUpper.includes("SALE VALUE"))
      ) {
        score += 0.45;
      }
      break;
    case "fmt-g-code-product-net-sale":
      if (
        (headerUpper.includes("PRODUCT DESC") || headerUpper.includes("PRODUCT")) &&
        headerUpper.includes("NET SALE")
      ) {
        score += 0.35;
      }
      break;
    case "fmt-h-name-price-sales":
      if (headerUpper.includes("OPEN STOCK") && headerUpper.includes("NAME") && colCount === 21) {
        score += 0.45;
      }
      break;
    case "fmt-i-vertical-qty-bon":
      if (headerUpper.includes("QTY.BON AMOUNT") || textUpper.includes("QTY.BON AMOUNT")) score += 0.5;
      break;
    case "fmt-j-no-table":
      if (erpStatement) {
        score = Math.min(score, 0.15);
      } else if (detection.noTableIndicator) {
        if (hints.tableCount === 0 && textUpper.trim()) score += 0.55;
        else if (hints.hasProductTable) score = Math.min(score, 0.1);
      }
      break;
    default:
      break;
  }

  return Math.min(score, 1);
}

function pickBestFormat(
  scores: Record<string, number>,
  textUpper: string,
  hints: Required<TableHints>,
): string {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestCode, bestScore] = ranked[0];

  if (!textUpper.trim() && hints.tableCount === 0) {
    return "fmt-j-no-table";
  }

  if (bestCode === "fmt-j-no-table" && ranked.length > 1) {
    const [secondCode, secondScore] = ranked[1];
    if (secondScore >= 0.35 && bestScore - secondScore <= 0.1) {
      return secondCode;
    }
  }

  if (bestScore < 0.2) {
    return "fmt-j-no-table";
  }

  return bestCode;
}

export function suggestPdfFormat(text: string, hints: TableHints = {}): PdfFormatSuggestion {
  const textUpper = normalizeText(text);
  const resolvedHints: Required<TableHints> = {
    colCount: hints.colCount ?? null,
    headerText: normalizeText(hints.headerText ?? ""),
    tableCount: hints.tableCount ?? 0,
    hasProductTable: hints.hasProductTable ?? false,
  };

  const scores: Record<string, number> = {};
  for (const preset of PDF_FORMAT_PRESETS) {
    scores[preset.code] = scorePreset(
      preset.code,
      preset.defaultConfig,
      textUpper,
      resolvedHints,
    );
  }

  const bestCode = pickBestFormat(scores, textUpper, resolvedHints);
  const confidence = Math.round(scores[bestCode] * 100) / 100;
  const preset = PDF_FORMAT_PRESETS.find((p) => p.code === bestCode)!;

  return {
    code: bestCode,
    family: preset.family,
    confidence,
    scores,
  };
}
