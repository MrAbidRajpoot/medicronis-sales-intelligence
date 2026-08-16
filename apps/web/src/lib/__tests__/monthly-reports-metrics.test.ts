/**
 * Monthly report metrics: full prior-month LMTD, latest-in-month stock, % edge cases.
 * Run: npx tsx --tsconfig apps/web/tsconfig.json apps/web/src/lib/__tests__/monthly-reports-metrics.test.ts
 */
import assert from "node:assert/strict";
import {
  aggregateDistributorWise,
  aggregateProductWise,
  buildMonthlyGrainRows,
  latestClosingStockInMonth,
  type MonthlyFactRow,
} from "../monthly-reports/metrics";
import { resolveMonthlyReportPeriod } from "../monthly-reports/query";
import { monthlyReportColumnLabels, type MonthlyGrainRow } from "../monthly-reports/types";
import { endOfMonth } from "../date-utils";

const asOfDate = new Date(Date.UTC(2026, 7, 15)); // mid-August 2026
const period = resolveMonthlyReportPeriod({ asOfDate });

assert.equal(period.year, 2026);
assert.equal(period.month, 8);
assert.equal(period.monthName, "August");
assert.equal(period.priorMonthName, "July");
assert.equal(period.monthStart.toISOString(), new Date(Date.UTC(2026, 7, 1)).toISOString());
assert.equal(period.monthEnd.toISOString(), new Date(Date.UTC(2026, 7, 31)).toISOString());
assert.equal(period.priorMonthStart.toISOString(), new Date(Date.UTC(2026, 6, 1)).toISOString());
assert.equal(period.priorMonthEnd.toISOString(), new Date(Date.UTC(2026, 6, 31)).toISOString());

const labels = monthlyReportColumnLabels(period);
assert.equal(labels.salesUnits, "August Sales Units");
assert.equal(labels.lmtdSalesUnits, "July LMTD Sales Unit");
assert.equal(labels.salesValue, "August Sales Value");

const manager = {
  id: "manager-1",
  name: "Test Manager",
  isActive: true,
  createdAt: asOfDate,
  updatedAt: asOfDate,
};

function makeDistributor(
  id: string,
  name: string,
  city: string,
  geo: { territoryId: string; areaId: string; regionId: string; zoneId: string }
) {
  return {
    id,
    code: id.toUpperCase(),
    name,
    territoryId: geo.territoryId,
    areaId: geo.areaId,
    regionId: geo.regionId,
    zoneId: geo.zoneId,
    pdfFormatId: null,
    inputMode: "BOTH" as const,
    isActive: true,
    createdAt: asOfDate,
    updatedAt: asOfDate,
    territory: {
      id: geo.territoryId,
      name: city,
      managerId: manager.id,
      isActive: true,
      createdAt: asOfDate,
      updatedAt: asOfDate,
      manager,
    },
    area: {
      id: geo.areaId,
      name: "South",
      managerId: manager.id,
      isActive: true,
      createdAt: asOfDate,
      updatedAt: asOfDate,
      manager,
    },
    region: {
      id: geo.regionId,
      name: "South Region",
      managerId: manager.id,
      isActive: true,
      createdAt: asOfDate,
      updatedAt: asOfDate,
      manager,
    },
    zone: {
      id: geo.zoneId,
      name: "Pak-1",
      managerId: manager.id,
      isActive: true,
      createdAt: asOfDate,
      updatedAt: asOfDate,
      manager,
    },
  };
}

const distA = makeDistributor("dist-a", "Alpha Dist", "Karachi", {
  territoryId: "terr-1",
  areaId: "area-1",
  regionId: "reg-1",
  zoneId: "zone-1",
});
const distB = makeDistributor("dist-b", "Beta Dist", "Lahore", {
  territoryId: "terr-2",
  areaId: "area-2",
  regionId: "reg-2",
  zoneId: "zone-2",
});

const productX = {
  id: "prod-x",
  name: "Novagen 250mg T",
  newSp: 100,
};

const productY = {
  id: "prod-y",
  name: "Other Product",
  newSp: 50,
};

function fact(
  distributor: typeof distA,
  product: typeof productX,
  date: Date,
  quantity: number,
  options: { unitPrice?: number; closingStock?: number | null } = {}
): MonthlyFactRow {
  return {
    id: `fact-${distributor.id}-${product.id}-${date.toISOString()}`,
    distributorId: distributor.id,
    productId: product.id,
    saleDate: date,
    quantity,
    unitPrice: options.unitPrice ?? 999,
    salesValue: 1,
    closingStock: options.closingStock === undefined ? null : options.closingStock,
    returnsQty: null,
    sourceDocumentId: null,
    approvedAt: date,
    createdAt: date,
    updatedAt: date,
    distributor,
    product,
  } as unknown as MonthlyFactRow;
}

// --- LMTD = full prior calendar month (not same-day) ---
{
  const facts = [
    fact(distA, productX, new Date(Date.UTC(2026, 7, 15)), 10), // Aug current
    fact(distA, productX, new Date(Date.UTC(2026, 7, 1)), 5), // Aug earlier day
    fact(distA, productX, new Date(Date.UTC(2026, 6, 15)), 3), // July mid (SSR-style day)
    fact(distA, productX, new Date(Date.UTC(2026, 6, 1)), 7), // July other day — must count for monthly LMTD
    fact(distA, productX, new Date(Date.UTC(2026, 6, 31)), 2), // July end
  ];

  const grains = buildMonthlyGrainRows(facts, period);
  assert.equal(grains.length, 1);
  const g = grains[0]!;
  assert.equal(g.salesUnits, 15, "current month sums all August days");
  assert.equal(g.lmtdSalesUnits, 12, "LMTD sums ALL July days (3+7+2), not only Jul 15");
  assert.equal(g.salesValue, 15 * 100);
  assert.equal(g.lmtdSalesValue, 12 * 100);
  assert.equal(g.lmtdSalesValue > 0 ? g.salesValue / g.lmtdSalesValue - 1 : "-", 15 / 12 - 1);
}

// --- Closing stock: latest non-null day in current month ---
{
  const facts = [
    fact(distA, productX, new Date(Date.UTC(2026, 7, 5)), 1, { closingStock: 100 }),
    fact(distA, productX, new Date(Date.UTC(2026, 7, 20)), 1, { closingStock: 250 }),
    fact(distA, productX, new Date(Date.UTC(2026, 7, 25)), 1, { closingStock: null }), // ignore null
    fact(distA, productX, new Date(Date.UTC(2026, 6, 31)), 1, { closingStock: 999 }), // prior month ignored
  ];

  const stockMap = latestClosingStockInMonth(facts, period.monthStart, period.monthEnd);
  assert.equal(stockMap.get("dist-a:prod-x"), 250, "latest non-null stock day in August wins");

  const grains = buildMonthlyGrainRows(facts, period);
  assert.equal(grains[0]!.closingStockUnits, 250);
  assert.equal(grains[0]!.stockValue, 250 * 100);
}

// --- Year/month period input uses full month bounds ---
{
  const fromYm = resolveMonthlyReportPeriod({ year: 2026, month: 4 });
  assert.equal(fromYm.monthName, "April");
  assert.equal(fromYm.priorMonthName, "March");
  assert.equal(fromYm.asOfDate.toISOString(), endOfMonth(new Date(Date.UTC(2026, 3, 1))).toISOString());
  assert.equal(fromYm.priorMonthEnd.toISOString(), new Date(Date.UTC(2026, 2, 31)).toISOString());
}

// --- Aggregate Distributor / Product Wise + percent edge cases ---
{
  const targetKey = `prod-x|terr-1|area-1|reg-1|zone-1`;
  const targets = new Map<string, number>([[targetKey, 20]]);

  const facts = [
    fact(distA, productX, new Date(Date.UTC(2026, 7, 10)), 10, { closingStock: 40 }),
    fact(distA, productY, new Date(Date.UTC(2026, 7, 10)), 4, { closingStock: 10 }),
    fact(distB, productX, new Date(Date.UTC(2026, 7, 10)), 6, { closingStock: 5 }),
    // LMTD only for distA×X
    fact(distA, productX, new Date(Date.UTC(2026, 6, 5)), 8),
    // distB×Y: current sales but zero LMTD → lmtdPercent "-"
    fact(distB, productY, new Date(Date.UTC(2026, 7, 12)), 2, { closingStock: 1 }),
  ];

  const grains = buildMonthlyGrainRows(facts, period, targets);

  const byDist = aggregateDistributorWise(grains);
  assert.equal(byDist.length, 2);

  const alpha = byDist.find((r) => r.distributorName === "Alpha Dist")!;
  assert.equal(alpha.city, "Karachi");
  assert.equal(alpha.salesUnits, 14); // 10 + 4
  assert.equal(alpha.lmtdSalesUnits, 8);
  assert.equal(alpha.targetUnits, 20); // only productX has target
  assert.equal(alpha.targetValue, 20 * 100);
  assert.equal(alpha.salesValue, 10 * 100 + 4 * 50);
  assert.equal(alpha.targetAchvPercent, alpha.salesValue / alpha.targetValue);
  assert.equal(alpha.lmtdPercent, alpha.salesValue / (8 * 100) - 1);
  assert.equal(alpha.closingStockUnits, 50); // 40 + 10
  assert.equal(alpha.stockValue, 40 * 100 + 10 * 50);

  const beta = byDist.find((r) => r.distributorName === "Beta Dist")!;
  assert.equal(beta.salesUnits, 8); // 6 + 2
  assert.equal(beta.lmtdSalesUnits, 0);
  assert.equal(beta.lmtdPercent, "-", "zero LMTD value → dash");
  assert.equal(beta.targetAchvPercent, "-", "zero target value → dash");

  const byProd = aggregateProductWise(grains);
  assert.equal(byProd.length, 2);

  const novagen = byProd.find((r) => r.productName === "Novagen 250mg T")!;
  assert.equal(novagen.salesUnits, 16); // 10 + 6
  assert.equal(novagen.lmtdSalesUnits, 8);
  assert.equal(novagen.stockUnits, 45); // 40 + 5
  assert.equal(novagen.stockValue, 40 * 100 + 5 * 100);
  assert.equal(novagen.targetUnits, 20);
  assert.equal(novagen.targetAchvPercent, novagen.salesValue / novagen.targetValue);

  const other = byProd.find((r) => r.productName === "Other Product")!;
  assert.equal(other.lmtdPercent, "-", "product with zero LMTD value");
  assert.equal(other.targetAchvPercent, "-", "product with zero target value");
}

// --- Grain percents recomputed after aggregate (not averaged) ---
{
  const rows: MonthlyGrainRow[] = [
    {
      distributorId: "d1",
      distributorName: "D1",
      city: "City",
      productId: "p1",
      productName: "P1",
      sellingPrice: 10,
      targetUnits: 10,
      salesUnits: 5,
      lmtdSalesUnits: 10,
      targetValue: 100,
      salesValue: 50,
      lmtdSalesValue: 100,
      closingStockUnits: 1,
      stockValue: 10,
    },
    {
      distributorId: "d1",
      distributorName: "D1",
      city: "City",
      productId: "p2",
      productName: "P2",
      sellingPrice: 10,
      targetUnits: 10,
      salesUnits: 15,
      lmtdSalesUnits: 0,
      targetValue: 100,
      salesValue: 150,
      lmtdSalesValue: 0,
      closingStockUnits: 2,
      stockValue: 20,
    },
  ];

  const [agg] = aggregateDistributorWise(rows);
  assert.equal(agg!.salesValue, 200);
  assert.equal(agg!.targetValue, 200);
  assert.equal(agg!.lmtdSalesValue, 100);
  assert.equal(agg!.targetAchvPercent, 1);
  assert.equal(agg!.lmtdPercent, 1); // 200/100 - 1
}

console.log("monthly-reports-metrics tests passed");
