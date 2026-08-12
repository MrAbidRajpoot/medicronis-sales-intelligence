/**
 * Runnable SSR DATA computation checks.
 * Run: npx tsx apps/web/src/lib/__tests__/ssr-data.test.ts
 */
import assert from "node:assert/strict";
import { sameDayPriorMonth } from "../date-utils";
import {
  buildDataSheetRows,
  buildDateRange,
  type SsrGridMasters,
} from "../ssr-data";
import { DATA_HEADERS } from "../ssr-export";

const asOfDate = new Date(Date.UTC(2026, 7, 12));

const distributor = {
  id: "dist-1",
  code: "DIST-1",
  name: "Test Distributor",
  city: "Karachi",
  region: "SOUTH",
  country: "PAK_1",
  managerId: "manager-1",
  pdfFormatId: null,
  isActive: true,
  createdAt: asOfDate,
  updatedAt: asOfDate,
  manager: {
    id: "manager-1",
    name: "Test Manager",
    email: null,
    phone: null,
    isActive: true,
    createdAt: asOfDate,
    updatedAt: asOfDate,
  },
};

const product = {
  id: "product-1",
  sku: "NOV-250",
  name: "Novagen 250mg T",
  category: null,
  composition: null,
  manufacturerId: null,
  productGroupId: "group-1",
  shipperSize: null,
  mrp: null,
  tp: null,
  oldSp: null,
  newSp: 161.5,
  netPrice: null,
  tax: null,
  netPriceWith1Pct: null,
  bonus: null,
  isActive: true,
  createdAt: asOfDate,
  updatedAt: asOfDate,
  productGroup: {
    id: "group-1",
    name: "Medicronis",
    isActive: true,
    createdAt: asOfDate,
    updatedAt: asOfDate,
  },
};

function fact(date: Date, quantity: number, options: { unitPrice?: number; closingStock?: number } = {}) {
  return {
    id: `fact-${date.toISOString()}`,
    distributorId: distributor.id,
    productId: product.id,
    saleDate: date,
    quantity,
    unitPrice: options.unitPrice ?? 999,
    salesValue: 1,
    closingStock: options.closingStock ?? null,
    returnsQty: null,
    sourceDocumentId: null,
    approvedAt: date,
    createdAt: date,
    updatedAt: date,
    distributor,
    product,
  };
}

function buildRow(facts: ReturnType<typeof fact>[]) {
  const masters = {
    distributors: [distributor],
    products: [product],
  } as unknown as SsrGridMasters;

  return buildDataSheetRows(
    facts as unknown as Parameters<typeof buildDataSheetRows>[0],
    buildDateRange("day", asOfDate),
    { asOfDate, viewType: "day", masters }
  )[0]!;
}

const row = buildRow([
  fact(asOfDate, 20, { unitPrice: 999, closingStock: 384 }),
  fact(new Date(Date.UTC(2026, 7, 11)), 4),
  fact(new Date(Date.UTC(2026, 6, 12)), 9),
  fact(new Date(Date.UTC(2026, 6, 1)), 100),
]);

assert.equal(row.sellingPrice, 161.5, "newSp takes precedence over PDF unitPrice");
assert.equal(row.salesValue, 20 * 161.5, "sales value is units × S.P");
assert.equal(row.lmtdSalesUnits, 9, "LMTD uses July 12 only for an August 12 report");
assert.equal(
  sameDayPriorMonth(new Date(Date.UTC(2026, 4, 31))).toISOString(),
  new Date(Date.UTC(2026, 3, 30)).toISOString(),
  "May 31 clamps to April 30"
);

const noLmtdRow = buildRow([
  fact(asOfDate, 20, { closingStock: 384 }),
  fact(new Date(Date.UTC(2026, 7, 11)), 4),
]);
assert.equal(noLmtdRow.lmtdPercent, "-", "zero LMTD value displays as a dash");

assert.equal(row.inventory, 30);
assert.equal(row.order, 0);
assert.equal(row.excessStock, 354);
assert.equal(row.orderValue, 0);
assert.equal(row.excessStockValue, 354 * 161.5);
assert.equal(row.inventoryValue, 30 * 161.5);
assert.equal(row.category, "Distributor");
assert.equal(row.group, "Medicronis");
assert.deepEqual(DATA_HEADERS, [
  "Distributor Name",
  "City",
  "Region",
  "Country",
  "Category",
  "Group",
  "Manager",
  "Product Name",
  "S.P",
  "Sales Units",
  "Closing Stock",
  "Sales Value",
  "Stock Value",
  "Yesterday",
  "Yesterday Sale Value",
  "Difference",
  "LMTD Sales Unit",
  "LMTD Difference",
  "LMTD Sales Value",
  "LMTD Difference",
  "LMTD %age",
  "Inventory",
  "Order",
  "Order Value",
  "Excess Stock",
  "Excess Stock Value",
  "Inventory Value",
]);

console.log("ssr-data tests passed");
