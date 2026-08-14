/**
 * Sales Excel parse + Excel-only upload gate checks.
 * Run: npx tsx --tsconfig tsconfig.json src/lib/__tests__/sales-excel-import.test.ts
 */
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  parseOptionalNumber,
  parseSalesExcel,
  parseSalesQty,
} from "../sales-excel-import";
import type { ExcelTemplateConfig } from "../excel-template-types";
import { validateExcelTemplateConfig } from "../excel-template-validation";
import { isDistributorInputReady } from "../template-readiness";

async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildSampleWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales");
  ws.addRow(["Product Name", "Qty", "S.P", "Closing", "Amount"]);
  ws.addRow(["Amoxicillin 500mg Caps", 10, 350, 5, 3500]);
  ws.addRow(["Multi Word Product Name Here", 0, 100, "", ""]);
  ws.addRow(["Paracetamol 500mg Tab", 3, "-", 12, null]);
  ws.addRow(["", 5, 10, 1, 50]); // empty product — skipped
  return workbookToBuffer(wb);
}

const baseConfig: ExcelTemplateConfig = {
  source: "excel",
  headerRow: 0,
  fields: {
    product_name: { col: 0 },
    sales_qty: { col: 1 },
    unit_price: { col: 2 },
    closing_stock: { col: 3 },
    sales_amount: { col: 4 },
  },
};

function testParseHelpers() {
  assert.equal(parseSalesQty("0"), 0, "0 sales qty is valid");
  assert.equal(parseSalesQty(""), null);
  assert.equal(parseSalesQty("-"), null);
  assert.equal(parseOptionalNumber(""), null);
  assert.equal(parseOptionalNumber("-"), null);
  assert.equal(parseOptionalNumber("12.5"), 12.5);
}

async function testParseSalesExcel() {
  const buffer = await buildSampleWorkbook();
  const rows = await parseSalesExcel(buffer, baseConfig);

  assert.equal(rows.length, 3, "three data rows with product names");

  assert.equal(rows[0].raw_product_text, "Amoxicillin 500mg Caps");
  assert.equal(rows[0].quantity, 10);
  assert.equal(rows[0].unit_price, 350);
  assert.equal(rows[0].closing_stock, 5);
  assert.equal(rows[0].gross_value, 3500);

  assert.equal(
    rows[1].raw_product_text,
    "Multi Word Product Name Here",
    "multi-word product stays in one cell"
  );
  assert.equal(rows[1].quantity, 0, "0 sales qty kept");
  assert.equal(rows[1].closing_stock, null, "empty closing → null");
  assert.equal(rows[1].gross_value, null, "empty amount → null");

  assert.equal(rows[2].raw_product_text, "Paracetamol 500mg Tab");
  assert.equal(rows[2].unit_price, null, "dash unit price → null");
  assert.equal(rows[2].closing_stock, 12);
}

function testExcelConfigValidation() {
  const bad = validateExcelTemplateConfig({
    source: "excel",
    fields: { product_name: { col: 0 } },
  });
  assert.equal(bad.ok, false, "sales_qty required");

  const good = validateExcelTemplateConfig({
    source: "excel",
    fields: {
      product_name: { col: 0 },
      sales_qty: { col: 1 },
    },
  });
  assert.equal(good.ok, true);
}

function testUploadGates() {
  const pdfTemplate = {
    config: {
      headerStructure: "single_row" as const,
      fields: {
        product_name: { col: 0 },
        sales_qty: { col: 1 },
        sales_amount: { col: 2 },
      },
    },
    configuredAt: new Date(),
    excelConfig: null,
    excelConfiguredAt: null,
  };

  const excelTemplate = {
    config: pdfTemplate.config,
    configuredAt: new Date(),
    excelConfig: {
      source: "excel" as const,
      fields: {
        product_name: { col: 0 },
        sales_qty: { col: 1 },
      },
    },
    excelConfiguredAt: new Date(),
  };

  // EXCEL_ONLY rejects readiness without excel map (PDF alone is not enough)
  assert.equal(
    isDistributorInputReady({
      pdfFormatId: "fmt",
      activeTemplate: pdfTemplate,
      inputMode: "EXCEL_ONLY",
    }),
    false,
    "EXCEL_ONLY without excel map is not ready"
  );

  assert.equal(
    isDistributorInputReady({
      pdfFormatId: "fmt",
      activeTemplate: excelTemplate,
      inputMode: "EXCEL_ONLY",
    }),
    true,
    "EXCEL_ONLY with excel map is ready"
  );

  // BOTH accepts PDF readiness without excel map
  assert.equal(
    isDistributorInputReady({
      pdfFormatId: "fmt",
      activeTemplate: pdfTemplate,
      inputMode: "BOTH",
    }),
    true,
    "BOTH with PDF template is ready"
  );
}

async function main() {
  testParseHelpers();
  await testParseSalesExcel();
  testExcelConfigValidation();
  testUploadGates();
  console.log("sales-excel-import tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
