import ExcelJS from "exceljs";

export const DISTRIBUTOR_IMPORT_HEADERS = [
  "Code",
  "Name",
  "Territory",
  "Area",
  "Region",
  "Zone",
] as const;

export interface DistributorImportRow {
  rowNumber: number;
  code: string;
  name: string;
  territoryName: string | null;
  areaName: string | null;
  regionName: string | null;
  zoneName: string | null;
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
    territoryName: "Karachi",
    areaName: "South Karachi",
    regionName: "South",
    zoneName: "Pak-1",
  },
  {
    code: "DIST-002",
    name: "PharmaLink Lahore",
    territoryName: "Lahore",
    areaName: "Central Lahore",
    regionName: "Center-1",
    zoneName: "Pak-1",
  },
];

export async function generateDistributorImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";

  const ws = wb.addWorksheet("Distributors", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "Code", key: "code", width: 16 },
    { header: "Name", key: "name", width: 36 },
    { header: "Territory", key: "territoryName", width: 18 },
    { header: "Area", key: "areaName", width: 18 },
    { header: "Region", key: "regionName", width: 14 },
    { header: "Zone", key: "zoneName", width: 12 },
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
      territoryName: row.territoryName,
      areaName: row.areaName,
      regionName: row.regionName,
      zoneName: row.zoneName,
    });
  });

  ws.getCell("A1").note = "Required. Must be unique.";
  ws.getCell("B1").note = "Required.";
  ws.getCell("C1").note = "Optional. Added to territory bank if new (Vacant manager).";
  ws.getCell("D1").note = "Optional. Added to area bank if new (Vacant manager).";
  ws.getCell("E1").note = "Optional. Added to region bank if new (Vacant manager).";
  ws.getCell("F1").note = "Optional. Added to zone bank if new (Vacant manager).";

  const instructions = wb.addWorksheet("Instructions");
  instructions.getColumn(1).width = 90;
  instructions.addRow(["Medicronis — Distributor Bulk Import"]);
  instructions.addRow([]);
  instructions.addRow(["1. Fill in the Distributors sheet starting from row 2."]);
  instructions.addRow(["2. Code and Name are required for each row."]);
  instructions.addRow([
    "3. Territory, Area, Region, and Zone names are added to master data automatically if new.",
  ]);
  instructions.addRow([
    "4. New geography rows are assigned the Vacant manager. Assign managers on the geo pages.",
  ]);
  instructions.addRow(["5. Delete the sample rows before uploading your data."]);
  instructions.addRow(["6. Save as .xlsx and upload from the Distributors page."]);
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
    if (label === "territory") map.set("territoryName", col);
    if (label === "area") map.set("areaName", col);
    if (label === "region") map.set("regionName", col);
    if (label === "zone") map.set("zoneName", col);
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
    const territoryName = getCell("territoryName") || null;
    const areaName = getCell("areaName") || null;
    const regionName = getCell("regionName") || null;
    const zoneName = getCell("zoneName") || null;

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

    rows.push({
      rowNumber: i,
      code,
      name,
      territoryName,
      areaName,
      regionName,
      zoneName,
    });
  }

  return { rows, errors };
}
