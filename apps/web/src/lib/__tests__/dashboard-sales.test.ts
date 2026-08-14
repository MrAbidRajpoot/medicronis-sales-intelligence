/**
 * Runnable dashboard sales checks.
 * Run: npm run test:dashboard-sales --workspace=apps/web
 */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  getDashboardSalesRanges,
  getSalesByDistributor,
  getTotalSales,
} from "../dashboard-sales";
import { formatCurrency } from "../utils";

const asOf = new Date(Date.UTC(2026, 7, 14));
const ranges = getDashboardSalesRanges(asOf);

assert.equal(ranges.day.start.toISOString(), "2026-08-14T00:00:00.000Z");
assert.equal(ranges.week.start.toISOString(), "2026-08-10T00:00:00.000Z");
assert.equal(ranges.month.start.toISOString(), "2026-08-01T00:00:00.000Z");
assert.equal(ranges.day.end, asOf);
assert.equal(ranges.week.end, asOf);
assert.equal(ranges.month.end, asOf);

const facts = [
  {
    distributorId: "dist-1",
    saleDate: new Date(Date.UTC(2026, 7, 14)),
    quantity: 20,
    unitPrice: 999,
    salesValue: 999_999,
    lineTotal: 999_999,
    product: { id: "product-1", newSp: 161.5 },
    distributor: { name: "Alpha Distributor" },
  },
  {
    distributorId: "dist-1",
    saleDate: new Date(Date.UTC(2026, 7, 12)),
    quantity: 2,
    unitPrice: 10,
    salesValue: 1,
    product: { id: "product-2", newSp: null },
    distributor: { name: "Alpha Distributor" },
  },
  {
    distributorId: "dist-2",
    saleDate: new Date(Date.UTC(2026, 7, 1)),
    quantity: 1,
    unitPrice: 1,
    salesValue: 1,
    product: { id: "product-3", newSp: 100 },
    distributor: { name: "Beta Distributor" },
  },
  {
    distributorId: "dist-2",
    saleDate: new Date(Date.UTC(2026, 6, 31)),
    quantity: 50,
    unitPrice: 50,
    salesValue: 2_500,
    product: { id: "product-3", newSp: 100 },
    distributor: { name: "Beta Distributor" },
  },
];

const prisma = {
  dailySalesFact: {
    findMany: async ({ where }: { where?: { saleDate?: { gte: Date; lte: Date } } }) => {
      const range = where?.saleDate;
      if (!range) return facts;
      return facts.filter(
        (fact) => fact.saleDate.getTime() >= range.gte.getTime()
          && fact.saleDate.getTime() <= range.lte.getTime()
      );
    },
  },
} as unknown as PrismaClient;

async function run() {
  const dailyByDistributor = await getSalesByDistributor(prisma, ranges.day);
  assert.deepEqual(dailyByDistributor, [
    { name: "Alpha Distributor", value: 3_230 },
  ]);
  assert.equal(
    dailyByDistributor[0]?.value,
    20 * 161.5,
    "dashboard sales use quantity × newSp, not the PDF line total or stored salesValue"
  );

  assert.equal(await getTotalSales(prisma, ranges.day), 3_230);
  assert.equal(await getTotalSales(prisma, ranges.week), 3_250);
  assert.equal(await getTotalSales(prisma, ranges.month), 3_350);

  assert.match(
    formatCurrency(435_123.45),
    /435,123\.45/,
    "currency formatting must retain decimal money values"
  );

  console.log("Dashboard sales tests passed.");
}

void run();
