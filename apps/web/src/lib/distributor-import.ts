import ExcelJS from "exceljs";
import type { DistributorCountryValue, DistributorRegionValue } from "./distributor-options";
import { parseCountryInput, parseRegionInput } from "./distributor-options";

export const DISTRIBUTOR_IMPORT_HEADERS = [
  "Code",
  "Name",
  "Region",
  "Country",
  "City",
  "Manager",
] as const;

export interface DistributorImportRow {
  rowNumber: number;
  code: string;
  name: string;
  region: DistributorRegionValue | null;
  country: DistributorCountryValue | null;
  city: string | null;
  managerName: string | null;
}

export interface DistributorImportError {
  rowNumber: number;
  code: string;
  message: string;
}

const SAMPLE_ROWS: Omit<DistributorImportRow, "rowNumber">[] = [
  {
    code: "DIST-001",
    name: "MedSupply Karachi",
    region: "SOUTH",
    country: "PAK_1",
    city: "Karachi",
    managerName: "Ahmed Khan",
  },
  {
    code: "DIST-002",
    name: "PharmaLink Lahore",
    region: "CENTER_1",
    country: "PAK_1",
    city: "Lahore",
    managerName: "Sara Malik",
  },
];

export async function generateDistributorImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";

  const ws = wb.addWorksheet("Distributors", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "Code", key: "code", width: 16 },
    { header: "Name", key: "name", width: 36 },
    { header: "Region", key: "region", width: 14 },
    { header: "Country", key: "country", width: 12 },
    { header: "City", key: "city", width: 18 },
    { header: "Manager", key: "managerName", width: 24 },
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
      code: row.code,
      name: row.name,
      region: row.region === "SOUTH" ? "South" : "Center-1",
      country: "Pak-1",
      city: row.city,
      managerName: row.managerName,
    });
  });

  ws.getCell("A1").note = "Required. Must be unique.";
  ws.getCell("B1").note = "Required.";
  ws.getCell("C1").note = "Optional. South, Center-1, Center-2, North-1, North-2";
  ws.getCell("D1").note = "Optional. Pak-1 or Pak-2";
  ws.getCell("E1").note = "Optional. City name.";
  ws.getCell("F1").note = "Optional. Added to manager bank if new.";

  const instructions = wb.addWorksheet("Instructions");
  instructions.getColumn(1).width = 90;
  instructions.addRow(["Medicronis — Distributor Bulk Import"]);
  instructions.addRow([]);
  instructions.addRow(["1. Fill in the Distributors sheet starting from row 2."]);
  instructions.addRow(["2. Code and Name are required for each row."]);
  instructions.addRow(["3. Region values: South, Center-1, Center-2, North-1, North-2"]);
  instructions.addRow(["4. Country values: Pak-1, Pak-2"]);
  instructions.addRow(["5. Manager names are added to the manager bank automatically."]);
  instructions.addRow(["6. Delete the sample rows before uploading your data."]);
  instructions.addRow(["7. Save as .xlsx and upload from the Distributors page."]);
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
    if (label === "code" || label === "distributor code") map.set("code", col);
    if (label === "name" || label === "distributor name") map.set("name", col);
    if (label === "region") map.set("region", col);
    if (label === "country") map.set("country", col);
    if (label === "city") map.set("city", col);
    if (label === "manager") map.set("managerName", col);
  });

  if (!map.has("code") || !map.has("name")) return null;
  return map;
}

export async function parseDistributorImportFile(data: ArrayBuffer): Promise<{
  rows: DistributorImportRow[];
  errors: DistributorImportError[];
}> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(new Uint8Array(data) as any);

  const ws = wb.getWorksheet("Distributors") ?? wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, code: "", message: "Worksheet not found" }] };
  }

  const headerRow = ws.getRow(1);
  const headerMap = findHeaderMap(headerRow);
  if (!headerMap) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          code: "",
          message: "Missing required columns: Code and Name",
        },
      ],
    };
  }

  const rows: DistributorImportRow[] = [];
  const errors: DistributorImportError[] = [];
  const seenCodes = new Set<string>();

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const getCell = (key: string) => {
      const col = headerMap.get(key);
      return col ? cellText(row.getCell(col).value) : "";
    };

    const code = getCell("code").toUpperCase();
    const name = getCell("name");
    const regionRaw = getCell("region");
    const countryRaw = getCell("country");
    const city = getCell("city") || null;
    const managerName = getCell("managerName") || null;

    if (!code && !name) continue;

    if (!code || !name) {
      errors.push({
        rowNumber: i,
        code: code || "—",
        message: "Code and Name are required",
      });
      continue;
    }

    if (seenCodes.has(code)) {
      errors.push({ rowNumber: i, code, message: "Duplicate code in file" });
      continue;
    }
    seenCodes.add(code);

    const region = regionRaw ? parseRegionInput(regionRaw) : null;
    if (regionRaw && !region) {
      errors.push({
        rowNumber: i,
        code,
        message: "Invalid region. Use South, Center-1, Center-2, North-1, or North-2",
      });
      continue;
    }

    const country = countryRaw ? parseCountryInput(countryRaw) : null;
    if (countryRaw && !country) {
      errors.push({
        rowNumber: i,
        code,
        message: "Invalid country. Use Pak-1 or Pak-2",
      });
      continue;
    }

    rows.push({
      rowNumber: i,
      code,
      name,
      region,
      country,
      city,
      managerName,
    });
  }

  return { rows, errors };
}
