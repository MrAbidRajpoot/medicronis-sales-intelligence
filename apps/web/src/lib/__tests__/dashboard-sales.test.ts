/**
 * Runnable dashboard sales checks.
 * Run: npm run test:dashboard-sales --workspace=apps/web
 */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  formatDashboardAsOfDate,
  getLatestSalesAsOfDate,
  getSalesByDistributor,
  getTotalSales,
  salesRangeForAsOfDate,
  ssrActivityDetail,
} from "../dashboard-sales";
import { formatCurrency } from "../utils";

const asOf = new Date(Date.UTC(2026, 7, 14));
const range = salesRangeForAsOfDate(asOf);

assert.equal(range.start.toISOString(), "2026-08-14T00:00:00.000Z");
assert.equal(range.end.toISOString(), "2026-08-14T00:00:00.000Z");
assert.equal(formatDashboardAsOfDate(asOf), "14 Aug 2026");
assert.equal(
  ssrActivityDetail({ asOfDate: asOf }),
  "SSR · Sales Till 14 Aug 2026"
);

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
  ssrReport: {
    findFirst: async () => ({
      asOfDate: new Date(Date.UTC(2026, 7, 14)),
    }),
  },
  dailySalesFact: {
    findFirst: async () => ({
      saleDate: new Date(Date.UTC(2026, 7, 12)),
    }),
    findMany: async ({ where }: { where?: { saleDate?: { gte: Date; lte: Date } } }) => {
      const dateRange = where?.saleDate;
      if (!dateRange) return facts;
      return facts.filter(
        (fact) => fact.saleDate.getTime() >= dateRange.gte.getTime()
          && fact.saleDate.getTime() <= dateRange.lte.getTime()
      );
    },
  },
} as unknown as PrismaClient;

async function run() {
  const latestAsOf = await getLatestSalesAsOfDate(prisma);
  assert.equal(latestAsOf?.toISOString(), "2026-08-14T00:00:00.000Z");

  const byDistributor = await getSalesByDistributor(prisma, range);
  assert.deepEqual(byDistributor, [
    { name: "Alpha Distributor", value: 3_230 },
  ]);
  assert.equal(
    byDistributor[0]?.value,
    20 * 161.5,
    "dashboard sales use quantity × newSp, not the PDF line total or stored salesValue"
  );

  assert.equal(await getTotalSales(prisma, range), 3_230);

  const prismaNoSsr = {
    ssrReport: {
      findFirst: async () => null,
    },
    dailySalesFact: {
      findFirst: async () => ({
        saleDate: new Date(Date.UTC(2026, 7, 12)),
      }),
    },
  } as unknown as PrismaClient;

  const fallbackAsOf = await getLatestSalesAsOfDate(prismaNoSsr);
  assert.equal(fallbackAsOf?.toISOString(), "2026-08-12T00:00:00.000Z");

  assert.match(
    formatCurrency(435_123.45),
    /435,123\.45/,
    "currency formatting must retain decimal money values"
  );

  console.log("Dashboard sales tests passed.");
}

void run();
