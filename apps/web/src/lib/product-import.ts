import ExcelJS from "exceljs";
import { isValidBonus, isValidProductGroupName, PRODUCT_GROUP_NAMES } from "./product-helpers";

export const PRODUCT_IMPORT_HEADERS = [
  "SKU",
  "Product Name",
  "Category",
  "Group",
  "Composition",
  "Manufacturer",
  "Shipper Size",
  "MRP",
  "TP",
  "Old SP",
  "New SP",
  "Net Price",
  "Tax",
  "Net Price with 1%",
  "Bonus",
  "Aliases",
] as const;

export interface ProductImportRow {
  rowNumber: number;
  sku: string;
  name: string;
  category: string | null;
  groupName: string | null;
  composition: string | null;
  manufacturerName: string | null;
  shipperSize: number | null;
  mrp: number | null;
  tp: number | null;
  oldSp: number | null;
  newSp: number | null;
  netPrice: number | null;
  tax: number | null;
  netPriceWith1Pct: number | null;
  bonus: string | null;
  aliases: string[];
}

export interface ProductImportError {
  rowNumber: number;
  sku: string;
  message: string;
}

const SAMPLE_ROWS: Omit<ProductImportRow, "rowNumber">[] = [
  {
    sku: "MED-001",
    name: "Amoxicillin 500mg Capsules",
    category: "Antibiotics",
    groupName: "Medicronis",
    composition: "Amoxicillin 500mg",
    manufacturerName: "Getz Pharma",
    shipperSize: 100,
    mrp: 450,
    tp: 380,
    oldSp: 360,
    newSp: 350,
    netPrice: 340,
    tax: 34,
    netPriceWith1Pct: 343.4,
    bonus: "4+1",
    aliases: ["Amox 500", "AMOXICILLIN 500MG"],
  },
  {
    sku: "MED-002",
    name: "Paracetamol 500mg Tablets",
    category: "Analgesics",
    groupName: "Transformer",
    composition: "Paracetamol 500mg",
    manufacturerName: "Searle",
    shipperSize: 200,
    mrp: 120,
    tp: 95,
    oldSp: 90,
    newSp: 88,
    netPrice: 85,
    tax: 8.5,
    netPriceWith1Pct: 85.85,
    bonus: "10+2",
    aliases: ["PCM 500", "PARACETAMOL TAB"],
  },
];

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function parseIntValue(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export async function generateProductImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";

  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "SKU", key: "sku", width: 16 },
    { header: "Product Name", key: "name", width: 36 },
    { header: "Category", key: "category", width: 18 },
    { header: "Group", key: "groupName", width: 14 },
    { header: "Composition", key: "composition", width: 24 },
    { header: "Manufacturer", key: "manufacturerName", width: 20 },
    { header: "Shipper Size", key: "shipperSize", width: 14 },
    { header: "MRP", key: "mrp", width: 10 },
    { header: "TP", key: "tp", width: 10 },
    { header: "Old SP", key: "oldSp", width: 10 },
    { header: "New SP", key: "newSp", width: 10 },
    { header: "Net Price", key: "netPrice", width: 12 },
    { header: "Tax", key: "tax", width: 10 },
    { header: "Net Price with 1%", key: "netPriceWith1Pct", width: 18 },
    { header: "Bonus", key: "bonus", width: 10 },
    { header: "Aliases", key: "aliases", width: 40 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A568E" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  SAMPLE_ROWS.forEach((row) => {
    ws.addRow({
      ...row,
      aliases: row.aliases.join(", "),
    });
  });

  ws.getCell("A1").note = "Required. Must be unique.";
  ws.getCell("B1").note = "Required.";
  ws.getCell("D1").note = `Optional. Must be exactly: ${PRODUCT_GROUP_NAMES.join(" | ")}`;
  ws.getCell("O1").note = "Optional. Format: purchase+bonus e.g. 4+1";

  const instructions = wb.addWorksheet("Instructions");
  instructions.getColumn(1).width = 90;
  instructions.addRow(["Medicronis — Product Bulk Import"]);
  instructions.addRow([]);
  instructions.addRow(["1. Fill in the Products sheet starting from row 2."]);
  instructions.addRow(["2. SKU and Product Name are required for each row."]);
  instructions.addRow([
    `3. Group (optional) must be exactly one of: ${PRODUCT_GROUP_NAMES.join(" | ")}.`,
  ]);
  instructions.addRow(["4. Manufacturer names are added to the manufacturer bank automatically."]);
  instructions.addRow(["5. Bonus format: purchase units + free units, e.g. 4+1 means buy 4 get 1 free."]);
  instructions.addRow(["6. Delete the sample rows before uploading your data."]);
  instructions.addRow(["7. Save as .xlsx and upload from the Products page."]);
  instructions.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1A568E" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return String(value.result ?? "").trim();
  }
  return String(value).trim();
}

function findHeaderMap(headerRow: ExcelJS.Row): Map<string, number> | null {
  const map = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const label = cellText(cell.value).toLowerCase();
    if (label === "sku" || label === "product code") map.set("sku", col);
    if (label === "product name" || label === "name") map.set("name", col);
    if (label === "category") map.set("category", col);
    if (label === "group" || label === "product group") map.set("groupName", col);
    if (label === "composition") map.set("composition", col);
    if (label === "manufacturer") map.set("manufacturerName", col);
    if (label === "shipper size") map.set("shipperSize", col);
    if (label === "mrp") map.set("mrp", col);
    if (label === "tp") map.set("tp", col);
    if (label === "old sp") map.set("oldSp", col);
    if (label === "new sp") map.set("newSp", col);
    if (label === "net price") map.set("netPrice", col);
    if (label === "tax") map.set("tax", col);
    if (label === "net price with 1%") map.set("netPriceWith1Pct", col);
    if (label === "bonus") map.set("bonus", col);
    if (label === "aliases" || label === "alias") map.set("aliases", col);
  });

  if (!map.has("sku") || !map.has("name")) return null;
  return map;
}

export async function parseProductImportFile(data: ArrayBuffer): Promise<{
  rows: ProductImportRow[];
  errors: ProductImportError[];
}> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(new Uint8Array(data) as any);

  const ws = wb.getWorksheet("Products") ?? wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, sku: "", message: "Worksheet not found" }] };
  }

  const headerRow = ws.getRow(1);
  const headerMap = findHeaderMap(headerRow);
  if (!headerMap) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          sku: "",
          message: "Missing required columns: SKU and Product Name",
        },
      ],
    };
  }

  const rows: ProductImportRow[] = [];
  const errors: ProductImportError[] = [];
  const seenSkus = new Set<string>();

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const getCell = (key: string) => {
      const col = headerMap.get(key);
      return col ? cellText(row.getCell(col).value) : "";
    };

    const sku = getCell("sku").toUpperCase();
    const name = getCell("name");
    const category = getCell("category") || null;
    const groupRaw = getCell("groupName");
    const groupName = groupRaw || null;
    const composition = getCell("composition") || null;
    const manufacturerName = getCell("manufacturerName") || null;
    const shipperSize = parseIntValue(getCell("shipperSize"));
    const mrp = parseNumber(getCell("mrp"));
    const tp = parseNumber(getCell("tp"));
    const oldSp = parseNumber(getCell("oldSp"));
    const newSp = parseNumber(getCell("newSp"));
    const netPrice = parseNumber(getCell("netPrice"));
    const tax = parseNumber(getCell("tax"));
    const netPriceWith1Pct = parseNumber(getCell("netPriceWith1Pct"));
    const bonus = getCell("bonus") || null;
    const aliasesRaw = getCell("aliases");
    const aliases = aliasesRaw
      ? aliasesRaw.split(",").map((a) => a.trim()).filter(Boolean)
      : [];

    if (!sku && !name) continue;

    if (!sku || !name) {
      errors.push({
        rowNumber: i,
        sku: sku || "—",
        message: "SKU and Product Name are required",
      });
      continue;
    }

    if (groupName && !isValidProductGroupName(groupName)) {
      errors.push({
        rowNumber: i,
        sku,
        message: `Group must be one of: ${PRODUCT_GROUP_NAMES.join(" | ")}`,
      });
      continue;
    }

    if (bonus && !isValidBonus(bonus)) {
      errors.push({
        rowNumber: i,
        sku,
        message: "Bonus must be in format e.g. 4+1",
      });
      continue;
    }

    if (seenSkus.has(sku)) {
      errors.push({ rowNumber: i, sku, message: "Duplicate SKU in file" });
      continue;
    }
    seenSkus.add(sku);

    rows.push({
      rowNumber: i,
      sku,
      name,
      category,
      groupName,
      composition,
      manufacturerName,
      shipperSize,
      mrp,
      tp,
      oldSp,
      newSp,
      netPrice,
      tax,
      netPriceWith1Pct,
      bonus,
      aliases,
    });
  }

  return { rows, errors };
}
