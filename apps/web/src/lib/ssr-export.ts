import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/storage";
import {
  type SsrExportMeta,
  type SsrLineData,
  type SsrDataLine,
  type SsrDateExportMeta,
  DATA_HEADERS,
  formatPeriod,
  formatSalesTillDate,
  viewTypeLabel,
} from "@/lib/ssr-data";

export type { SsrExportMeta, SsrLineData, SsrDataLine, SsrDateExportMeta };
export { DATA_HEADERS };

/** Header / total row fill — light blue (Excel theme 4 tint). */
const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFDCE6F1" },
};

/** Total sales row — light green (Excel theme 9 tint). */
const TOTAL_SALES_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFE2EFDA" },
};

const HEADER_FONT = { bold: true, size: 14 };
const VALUE_FONT = { size: 11 };

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = HEADER_FONT;
  cell.fill = HEADER_FILL;
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function applyTotalRowStyle(cell: ExcelJS.Cell, fill = HEADER_FILL) {
  cell.font = HEADER_FONT;
  cell.fill = fill;
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

export async function generateSsrExcel(
  meta: SsrExportMeta,
  lines: SsrLineData[]
): Promise<{ filePath: string; buffer: Buffer }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";
  wb.created = meta.generatedAt;

  const ws = wb.addWorksheet("Wholeseller(Direct Party)", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { width: 36 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
  ];

  // Title row — matches "Updated Sales Till DD-MM-YY"
  ws.mergeCells("A1:E1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `Updated Sales Till ${formatSalesTillDate(meta.periodEnd)}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1A568E" } };
  titleCell.alignment = { horizontal: "center" };

  // Subtitle — distributor + period
  ws.mergeCells("A2:E2");
  ws.getCell("A2").value = `${meta.distributorName}${meta.territory ? ` — ${meta.territory}` : ""}  |  ${formatPeriod(meta.periodStart, meta.periodEnd)}  |  Batch: ${meta.batchCode}`;
  ws.getCell("A2").font = { size: 10, color: { argb: "FF64748B" } };
  ws.getCell("A2").alignment = { horizontal: "center" };

  const headerRow = 3;
  const headers = ["Party Name", "Product", "Quatity", "S.P", "Value"];
  headers.forEach((h, i) => {
    applyHeaderStyle(ws.getCell(headerRow, i + 1));
    ws.getCell(headerRow, i + 1).value = h;
  });
  ws.getRow(headerRow).height = 19;

  const dataStart = headerRow + 1;
  let totalValue = 0;

  lines.forEach((line, idx) => {
    const r = dataStart + idx;
    ws.getCell(r, 1).value = line.partyName;
    ws.getCell(r, 2).value = line.productName;
    ws.getCell(r, 3).value = line.quantity;
    ws.getCell(r, 3).numFmt = "#,##0";
    ws.getCell(r, 4).value = line.sellingPrice;
    ws.getCell(r, 4).numFmt = "#,##0.00";
    ws.getCell(r, 5).value = line.value;
    ws.getCell(r, 5).numFmt = "#,##0.00";
    ws.getCell(r, 5).font = VALUE_FONT;
    totalValue += line.value;
  });

  const totalRow = dataStart + lines.length;
  ws.mergeCells(totalRow, 1, totalRow, 4);
  applyTotalRowStyle(ws.getCell(totalRow, 1));
  ws.getCell(totalRow, 1).value = "Total Direct Sale :";
  applyTotalRowStyle(ws.getCell(totalRow, 5));
  ws.getCell(totalRow, 5).value = totalValue;
  ws.getCell(totalRow, 5).numFmt = "#,##0.00";
  ws.getRow(totalRow).height = 19;

  const salesRow = totalRow + 1;
  ws.mergeCells(salesRow, 1, salesRow, 4);
  applyTotalRowStyle(ws.getCell(salesRow, 1), TOTAL_SALES_FILL);
  ws.getCell(salesRow, 1).value = "Total Sales :";
  applyTotalRowStyle(ws.getCell(salesRow, 5), TOTAL_SALES_FILL);
  ws.getCell(salesRow, 5).value = totalValue;
  ws.getCell(salesRow, 5).numFmt = "#,##0.00";
  ws.getRow(salesRow).height = 19;

  // Distributor summary sheet (single-row snapshot)
  const summary = wb.addWorksheet("Distributor Wise");
  summary.columns = [
    { width: 36 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
  ];
  ["Distributor Name", "Territory", "Sales Units", "Sales Value"].forEach((h, i) => {
    applyHeaderStyle(summary.getCell(1, i + 1));
    summary.getCell(1, i + 1).value = h;
  });
  summary.getCell(2, 1).value = meta.distributorName;
  summary.getCell(2, 2).value = meta.territory;
  summary.getCell(2, 3).value = lines.reduce((s, l) => s + l.quantity, 0);
  summary.getCell(2, 3).numFmt = "#,##0";
  summary.getCell(2, 4).value = totalValue;
  summary.getCell(2, 4).numFmt = "#,##0.00";

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const reportsDir = path.join(getUploadDir(), "reports");
  await mkdir(reportsDir, { recursive: true });
  const fileName = `${meta.batchCode.replace(/[^a-zA-Z0-9-]/g, "_")}.xlsx`;
  const filePath = path.join(reportsDir, fileName);
  await writeFile(filePath, buffer);

  return { filePath, buffer };
}

const DATA_NUM_FMT = {
  sp: "#,##0.00",
  integer: "#,##0",
  money: "#,##0.00",
  percent: "0%",
} as const;

function dataRowValues(line: SsrDataLine): (string | number | null)[] {
  return [
    line.distributorName,
    line.territory,
    line.area,
    line.region,
    line.zone,
    line.category,
    line.group,
    line.manager,
    line.productName,
    line.sellingPrice,
    line.salesUnits,
    line.closingStock,
    line.salesValue,
    line.stockValue ?? 0,
    line.yesterdayUnits,
    line.yesterdaySalesValue,
    line.difference,
    line.lmtdSalesUnits,
    line.lmtdDifferenceUnits,
    line.lmtdSalesValue,
    line.lmtdDifferenceValue,
    line.lmtdPercent,
    line.inventory,
    line.order,
    line.orderValue,
    line.excessStock,
    line.excessStockValue,
    line.inventoryValue,
  ];
}

export async function generateSsrDataExcel(
  meta: SsrDateExportMeta,
  lines: SsrDataLine[]
): Promise<{ filePath: string; buffer: Buffer }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Medicronis";
  wb.created = meta.generatedAt;

  const ws = wb.addWorksheet("DATA", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { width: 28 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 32 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 16 },
  ];

  const colCount = DATA_HEADERS.length;

  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell("A1");
  titleCell.value = `Updated Sales Till ${formatSalesTillDate(meta.asOfDate)}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1A568E" } };
  titleCell.alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, colCount);
  ws.getCell("A2").value = `${viewTypeLabel(meta.viewType)} — ${formatPeriod(meta.periodStart, meta.periodEnd)}  |  Report: ${meta.reportCode}`;
  ws.getCell("A2").font = { size: 10, color: { argb: "FF64748B" } };
  ws.getCell("A2").alignment = { horizontal: "center" };

  const headerRow = 3;
  DATA_HEADERS.forEach((h, i) => {
    applyHeaderStyle(ws.getCell(headerRow, i + 1));
    ws.getCell(headerRow, i + 1).value = h;
  });
  ws.getRow(headerRow).height = 19;

  const dataStart = headerRow + 1;
  lines.forEach((line, idx) => {
    const r = dataStart + idx;
    const values = dataRowValues(line);
    values.forEach((val, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = val;
      if (i === 8) cell.numFmt = DATA_NUM_FMT.sp;
      if ([9, 10, 13, 16, 17, 21, 22, 24].includes(i)) cell.numFmt = DATA_NUM_FMT.integer;
      if ([11, 12, 14, 15, 18, 19, 23, 25, 26].includes(i)) {
        cell.numFmt = DATA_NUM_FMT.money;
      }
      if (i === 20 && typeof val === "number") cell.numFmt = DATA_NUM_FMT.percent;
    });
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const reportsDir = path.join(getUploadDir(), "reports");
  await mkdir(reportsDir, { recursive: true });
  const fileName = `${meta.reportCode.replace(/[^a-zA-Z0-9-]/g, "_")}.xlsx`;
  const filePath = path.join(reportsDir, fileName);
  await writeFile(filePath, buffer);

  return { filePath, buffer };
}

export async function generateSsrPdf(
  meta: SsrExportMeta,
  lines: SsrLineData[]
): Promise<{ filePath: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const reportsDir = path.join(getUploadDir(), "reports");
        await mkdir(reportsDir, { recursive: true });
        const fileName = `${meta.batchCode.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
        const filePath = path.join(reportsDir, fileName);
        await writeFile(filePath, buffer);
        resolve({ filePath, buffer });
      } catch (err) {
        reject(err);
      }
    });
    doc.on("error", reject);

    doc.fontSize(14).fillColor("#1A568E").text(`Updated Sales Till ${formatSalesTillDate(meta.periodEnd)}`, { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor("#64748B").text(
      `${meta.distributorName}${meta.territory ? ` — ${meta.territory}` : ""}  |  ${formatPeriod(meta.periodStart, meta.periodEnd)}`,
      { align: "center" }
    );
    doc.moveDown(0.6);

    const colWidths = [140, 120, 55, 55, 70];
    const headers = ["Party Name", "Product", "Quatity", "S.P", "Value"];
    const tableTop = doc.y;
    let x = doc.page.margins.left;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    doc.rect(x, tableTop, tableWidth, 18).fill("#DCE6F1");
    doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
    headers.forEach((h, i) => {
      doc.text(h, x + 4, tableTop + 5, { width: colWidths[i] - 8, lineBreak: false });
      x += colWidths[i];
    });

    let y = tableTop + 20;
    doc.font("Helvetica").fontSize(8);
    let totalValue = 0;

    lines.forEach((line) => {
      if (y > doc.page.height - 50) {
        doc.addPage({ layout: "landscape", margin: 40 });
        y = doc.page.margins.top;
      }
      x = doc.page.margins.left;
      const row = [
        line.partyName,
        line.productName,
        line.quantity.toLocaleString(),
        line.sellingPrice.toFixed(2),
        line.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ];
      row.forEach((val, i) => {
        doc.text(val, x + 4, y, { width: colWidths[i] - 8, lineBreak: false });
        x += colWidths[i];
      });
      totalValue += line.value;
      y += 14;
    });

    y += 4;
    doc.rect(doc.page.margins.left, y, tableWidth, 18).fill("#DCE6F1");
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(9);
    doc.text("Total Direct Sale :", doc.page.margins.left + 4, y + 5, { width: tableWidth - 80 });
    doc.text(
      totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      doc.page.margins.left + tableWidth - 76,
      y + 5,
      { width: 72, align: "right" }
    );

    doc.end();
  });
}
