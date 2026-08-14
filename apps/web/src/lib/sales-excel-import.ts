import ExcelJS from "exceljs";
import type { ExtractedRowPayload } from "@/lib/pdf-worker";
import type { ExcelCanonicalField, ExcelTemplateConfig } from "@/lib/excel-template-types";
import { validateExcelTemplateConfig } from "@/lib/excel-template-validation";

export type SalesExcelPreview = {
  headerGrid: string[];
  previewRows: ExtractedRowPayload[];
  sheetName: string;
  headerRow: number;
  colCount: number;
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((t: { text?: string }) => t.text ?? "").join("").trim();
  }
  if (typeof value === "object" && "result" in value) {
    return String(value.result ?? "").trim();
  }
  return String(value).trim();
}

/** Parse optional numeric cell: empty / "-" → null; 0 is valid. */
export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  const cleaned = trimmed.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse required sales qty: empty / "-" → null (row skipped if invalid); 0 ok. */
export function parseSalesQty(raw: string): number | null {
  return parseOptionalNumber(raw);
}

function shouldSkipRow(productText: string, skipPatterns?: string[]): boolean {
  if (!skipPatterns?.length) return false;
  const lower = productText.toLowerCase();
  return skipPatterns.some((p) => p.trim() && lower.includes(p.trim().toLowerCase()));
}

function getWorksheet(wb: ExcelJS.Workbook, sheetName?: string): ExcelJS.Worksheet | undefined {
  if (sheetName?.trim()) {
    return wb.getWorksheet(sheetName.trim()) ?? wb.worksheets[0];
  }
  return wb.worksheets[0];
}

/** ExcelJS columns are 1-based; config.col is 0-based. */
function colToExcel(col0: number): number {
  return col0 + 1;
}

function readField(
  row: ExcelJS.Row,
  fields: ExcelTemplateConfig["fields"],
  field: ExcelCanonicalField
): string {
  const mapping = fields[field as keyof ExcelTemplateConfig["fields"]];
  if (!mapping) return "";
  return cellText(row.getCell(colToExcel(mapping.col)).value);
}

async function loadWorkbook(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(bytes as any);
  return wb;
}

export async function readSalesExcelHeaders(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  options?: { headerRow?: number; sheetName?: string }
): Promise<{ headerGrid: string[]; sheetName: string; headerRow: number; colCount: number }> {
  const wb = await loadWorkbook(buffer);
  const ws = getWorksheet(wb, options?.sheetName);
  if (!ws) {
    throw new Error("Worksheet not found");
  }

  const headerRowIndex = options?.headerRow ?? 0;
  const excelRow = headerRowIndex + 1;
  const headerRow = ws.getRow(excelRow);
  const headerGrid: string[] = [];
  let maxCol = ws.columnCount || 0;

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > maxCol) maxCol = colNumber;
    headerGrid[colNumber - 1] = cellText(cell.value);
  });

  // Fill gaps so indices align with Col 0..N
  for (let i = 0; i < maxCol; i++) {
    if (headerGrid[i] === undefined) headerGrid[i] = "";
  }

  return {
    headerGrid,
    sheetName: ws.name,
    headerRow: headerRowIndex,
    colCount: maxCol,
  };
}

/**
 * Parse a distributor sales .xlsx using the saved Excel column map.
 * Returns ExtractedRowPayload[] for the same match → review → approve pipeline as PDF.
 */
export async function parseSalesExcel(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  config: ExcelTemplateConfig
): Promise<ExtractedRowPayload[]> {
  const validation = validateExcelTemplateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const cfg = validation.config;

  const wb = await loadWorkbook(buffer);
  const ws = getWorksheet(wb, cfg.sheetName);
  if (!ws) {
    throw new Error("Worksheet not found");
  }

  const headerRow0 = cfg.headerRow ?? 0;
  const firstDataRow = headerRow0 + 2; // Excel 1-based: header at headerRow0+1, data starts next
  const rows: ExtractedRowPayload[] = [];

  for (let r = firstDataRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const productName = readField(row, cfg.fields, "product_name").trim();
    if (!productName) continue;
    if (shouldSkipRow(productName, cfg.skipRowsContaining)) continue;

    const qtyRaw = readField(row, cfg.fields, "sales_qty");
    const quantity = parseSalesQty(qtyRaw);
    if (quantity === null) continue;

    const unitPrice = cfg.fields.unit_price
      ? parseOptionalNumber(readField(row, cfg.fields, "unit_price"))
      : null;
    const closingStock = cfg.fields.closing_stock
      ? parseOptionalNumber(readField(row, cfg.fields, "closing_stock"))
      : null;
    const salesAmount = cfg.fields.sales_amount
      ? parseOptionalNumber(readField(row, cfg.fields, "sales_amount"))
      : null;
    const returnsQty = cfg.fields.returns_qty
      ? parseOptionalNumber(readField(row, cfg.fields, "returns_qty"))
      : null;

    rows.push({
      raw_product_text: productName,
      quantity,
      unit_price: unitPrice,
      gross_value: salesAmount,
      closing_stock: closingStock,
      returns_qty: returnsQty,
    });
  }

  return rows;
}

/** Header + first N parsed rows for the Excel mapping wizard. */
export async function previewSalesExcel(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  config: ExcelTemplateConfig,
  previewLimit = 5
): Promise<SalesExcelPreview> {
  const headers = await readSalesExcelHeaders(buffer, {
    headerRow: config.headerRow,
    sheetName: config.sheetName,
  });
  const allRows = await parseSalesExcel(buffer, config);
  return {
    ...headers,
    previewRows: allRows.slice(0, previewLimit),
  };
}
