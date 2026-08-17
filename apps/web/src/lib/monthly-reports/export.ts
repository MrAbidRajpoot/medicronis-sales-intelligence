/**
 * Excel export for monthly Distributor Wise / Product Wise reports.
 * Reuses SSR number formats; header colors approximate the client workbook.
 */

import ExcelJS from "exceljs";
import {
  distributorWiseHeaders,
  distributorWiseSnapshotBanner,
  formatSnapshotCoverageSubtitle,
  productWiseHeaders,
  productWiseSnapshotBanner,
  type DistributorWiseRow,
  type MonthlyReportPeriod,
  type MonthlySnapshotCoverage,
  type ProductWiseRow,
} from "./types";

const NUM_FMT = {
  units: "#,##0.##",
  money: "#,##0.00",
  percent: "0.00%",
} as const;

/** Approximate workbook column group colors (ARGB). */
const HEADER_FILLS = {
  identity: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDCE6F1" } },
  target: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFCE4D6" } }, // orange
  sales: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDDEBF7" } }, // blue
  achv: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE2EFDA" } }, // green
  lmtd: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF2CC" } }, // yellow
  stock: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } }, // white
};

const TOTAL_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFDCE6F1" },
};

type ColKind = "text" | "units" | "money" | "percent";

const COL_KINDS: ColKind[] = [
  "text",
  "text",
  "text",
  "units",
  "units",
  "units",
  "money",
  "money",
  "percent",
  "money",
  "percent",
  "units",
  "money",
];

const COL_FILLS = [
  HEADER_FILLS.identity,
  HEADER_FILLS.identity,
  HEADER_FILLS.identity,
  HEADER_FILLS.target,
  HEADER_FILLS.sales,
  HEADER_FILLS.lmtd,
  HEADER_FILLS.target,
  HEADER_FILLS.sales,
  HEADER_FILLS.achv,
  HEADER_FILLS.lmtd,
  HEADER_FILLS.lmtd,
  HEADER_FILLS.stock,
  HEADER_FILLS.stock,
] as const;

function rowValues(row: DistributorWiseRow): (string | number)[] {
  return [
    row.distributorName,
    row.city,
    row.asOfDate,
    row.targetUnits,
    row.salesUnits,
    row.lmtdSalesUnits,
    row.targetValue,
    row.salesValue,
    row.targetAchvPercent === "-" ? "-" : row.targetAchvPercent,
    row.lmtdSalesValue,
    row.lmtdPercent === "-" ? "-" : row.lmtdPercent,
    row.closingStockUnits,
    row.stockValue,
  ];
}

function applyNumFmt(cell: ExcelJS.Cell, kind: ColKind, val: string | number) {
  if (kind === "units") cell.numFmt = NUM_FMT.units;
  else if (kind === "money") cell.numFmt = NUM_FMT.money;
  else if (kind === "percent" && typeof val === "number") cell.numFmt = NUM_FMT.percent;
}

export async function generateDistributorWiseExcel(options: {
  period: MonthlyReportPeriod;
  rows: DistributorWiseRow[];
  totals?: DistributorWiseRow | null;
  coverage?: MonthlySnapshotCoverage | null;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const { period, rows, totals, coverage = null } = options;
  const headers = distributorWiseHeaders(period);
  const title = `Distributorwise Report — ${period.monthName} ${period.year}`;
  const subtitle = [
    distributorWiseSnapshotBanner(period.monthName),
    formatSnapshotCoverageSubtitle(coverage, period.priorMonthName),
  ]
    .filter(Boolean)
    .join("  |  ");
  const fileName = `Distributor-Wise-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";
  wb.created = new Date();

  const ws = wb.addWorksheet("Distributor Wise", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 3 }],
  });

  ws.columns = [
    { width: 36 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
    { width: 14 },
  ];

  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1A568E" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, headers.length);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF5A5A5A" } };
  subtitleCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(2).height = 28;

  const headerRow = 3;
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11 };
    cell.fill = COL_FILLS[i]!;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB4B4B4" } },
      left: { style: "thin", color: { argb: "FFB4B4B4" } },
      bottom: { style: "thin", color: { argb: "FFB4B4B4" } },
      right: { style: "thin", color: { argb: "FFB4B4B4" } },
    };
  });
  ws.getRow(headerRow).height = 32;

  const writeDataRow = (excelRow: number, row: DistributorWiseRow, isTotal = false) => {
    const values = rowValues(row);
    values.forEach((val, i) => {
      const cell = ws.getCell(excelRow, i + 1);
      cell.value = val;
      const kind = COL_KINDS[i]!;
      if (kind !== "text") {
        cell.alignment = { horizontal: "right" };
        applyNumFmt(cell, kind, val);
      }
      if (isTotal) {
        cell.font = { bold: true, size: 11 };
        cell.fill = TOTAL_FILL;
      }
    });
  };

  let excelRow = headerRow + 1;
  for (const row of rows) {
    writeDataRow(excelRow, row);
    excelRow += 1;
  }

  if (totals) {
    writeDataRow(excelRow, totals, true);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName };
}

const PRODUCT_COL_KINDS: ColKind[] = [
  "text",
  "units",
  "units",
  "units",
  "money",
  "money",
  "percent",
  "money",
  "percent",
  "units",
  "money",
];

const PRODUCT_COL_FILLS = [
  HEADER_FILLS.identity,
  HEADER_FILLS.target,
  HEADER_FILLS.sales,
  HEADER_FILLS.lmtd,
  HEADER_FILLS.target,
  HEADER_FILLS.sales,
  HEADER_FILLS.achv,
  HEADER_FILLS.lmtd,
  HEADER_FILLS.lmtd,
  HEADER_FILLS.stock,
  HEADER_FILLS.stock,
] as const;

function productRowValues(row: ProductWiseRow): (string | number)[] {
  return [
    row.productName,
    row.targetUnits,
    row.salesUnits,
    row.lmtdSalesUnits,
    row.targetValue,
    row.salesValue,
    row.targetAchvPercent === "-" ? "-" : row.targetAchvPercent,
    row.lmtdSalesValue,
    row.lmtdPercent === "-" ? "-" : row.lmtdPercent,
    row.stockUnits,
    row.stockValue,
  ];
}

export async function generateProductWiseExcel(options: {
  period: MonthlyReportPeriod;
  rows: ProductWiseRow[];
  totals?: ProductWiseRow | null;
  coverage?: MonthlySnapshotCoverage | null;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const { period, rows, totals, coverage = null } = options;
  const headers = productWiseHeaders(period);
  const title = `Productwise Report — ${period.monthName} ${period.year}`;
  const subtitle = [
    productWiseSnapshotBanner(period.monthName),
    formatSnapshotCoverageSubtitle(coverage, period.priorMonthName),
  ]
    .filter(Boolean)
    .join("  |  ");
  const fileName = `Product-Wise-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";
  wb.created = new Date();

  const ws = wb.addWorksheet("Product Wise", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 3 }],
  });

  ws.columns = [
    { width: 36 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];

  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1A568E" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, headers.length);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF5A5A5A" } };
  subtitleCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(2).height = 28;

  const headerRow = 3;
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11 };
    cell.fill = PRODUCT_COL_FILLS[i]!;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB4B4B4" } },
      left: { style: "thin", color: { argb: "FFB4B4B4" } },
      bottom: { style: "thin", color: { argb: "FFB4B4B4" } },
      right: { style: "thin", color: { argb: "FFB4B4B4" } },
    };
  });
  ws.getRow(headerRow).height = 32;

  const writeDataRow = (excelRow: number, row: ProductWiseRow, isTotal = false) => {
    const values = productRowValues(row);
    values.forEach((val, i) => {
      const cell = ws.getCell(excelRow, i + 1);
      cell.value = val;
      const kind = PRODUCT_COL_KINDS[i]!;
      if (kind !== "text") {
        cell.alignment = { horizontal: "right" };
        applyNumFmt(cell, kind, val);
      }
      if (isTotal) {
        cell.font = { bold: true, size: 11 };
        cell.fill = TOTAL_FILL;
      }
    });
  };

  let excelRow = headerRow + 1;
  for (const row of rows) {
    writeDataRow(excelRow, row);
    excelRow += 1;
  }

  if (totals) {
    writeDataRow(excelRow, totals, true);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName };
}
