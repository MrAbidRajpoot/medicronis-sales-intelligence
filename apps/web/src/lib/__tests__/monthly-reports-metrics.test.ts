/**
 * Monthly report metrics: per-distributor MTD snapshots (never sum days), LMTD, stock, %.
 * Run: npx tsx --tsconfig apps/web/tsconfig.json apps/web/src/lib/__tests__/monthly-reports-metrics.test.ts
 */
import assert from "node:assert/strict";
import { endOfMonth, toIsoDate } from "../date-utils";
import {
  aggregateDistributorWise,
  aggregateProductWise,
  buildMonthlyGrainRows,
  collapseDistributorWiseByName,
  filterGrainToLatestDistributorByName,
  snapshotCoverageFromGrain,
  type MonthlyFactRow,
} from "../monthly-reports/metrics";
import { resolveMonthlyReportPeriod } from "../monthly-reports/query";
import {
  distributorWiseHeaders,
  monthlyReportColumnLabels,
  type MonthlyGrainRow,
} from "../monthly-reports/types";

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
assert.equal(labels.tillDate, "Till date");
assert.ok(distributorWiseHeaders(period).includes("Till date"));

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
const distC = makeDistributor("dist-c", "Gamma Dist", "Islamabad", {
  territoryId: "terr-3",
  areaId: "area-3",
  regionId: "reg-3",
  zoneId: "zone-3",
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

function readyDates(...dates: Date[]): Set<string> {
  return new Set(dates.map(toIsoDate));
}

function grainsFrom(
  facts: MonthlyFactRow[],
  extra?: { ready?: Date[]; targets?: Map<string, number> }
) {
  const ready = extra?.ready ?? facts.map((f) => f.saleDate);
  return buildMonthlyGrainRows(facts, period, {
    readyAsOfDates: readyDates(...ready),
    targetUnitsByKey: extra?.targets,
  });
}

const aug14 = new Date(Date.UTC(2026, 7, 14));
const aug16 = new Date(Date.UTC(2026, 7, 16));
const aug17 = new Date(Date.UTC(2026, 7, 17));
const jul10 = new Date(Date.UTC(2026, 6, 10));
const jul20 = new Date(Date.UTC(2026, 6, 20));
const jul25 = new Date(Date.UTC(2026, 6, 25));

// --- Per-distributor MTD snapshots: do NOT sum days ---
{
  const facts = [
    fact(distA, productX, aug16, 100, { closingStock: 10 }),
    fact(distA, productX, aug17, 180, { closingStock: 8 }),
    fact(distB, productX, aug16, 50, { closingStock: 3 }),
  ];

  const grains = grainsFrom(facts);
  assert.equal(grains.length, 2);

  const a = grains.find((g) => g.distributorId === "dist-a")!;
  assert.equal(a.salesUnits, 180, "DistA uses 17 Aug MTD snapshot, not 100+180");
  assert.equal(toIsoDate(a.asOfDate), "2026-08-17");
  assert.equal(a.closingStockUnits, 8, "stock from DistA snapshot day (17), not earlier");
  assert.equal(a.salesValue, 180 * 100);
  assert.equal(a.lmtdSalesUnits, 0);
  assert.equal(a.lmtdAsOfDate, null);

  const b = grains.find((g) => g.distributorId === "dist-b")!;
  assert.equal(b.salesUnits, 50, "DistB uses 16 Aug snapshot");
  assert.equal(toIsoDate(b.asOfDate), "2026-08-16");
  assert.equal(b.closingStockUnits, 3);

  const byDist = aggregateDistributorWise(grains);
  assert.equal(byDist.find((r) => r.distributorName === "Alpha Dist")!.asOfDate, "2026-08-17");
  assert.equal(byDist.find((r) => r.distributorName === "Beta Dist")!.asOfDate, "2026-08-16");
  assert.equal(byDist.find((r) => r.distributorName === "Alpha Dist")!.salesUnits, 180);
  assert.equal(byDist.find((r) => r.distributorName === "Beta Dist")!.salesUnits, 50);

  const byProd = aggregateProductWise(grains);
  assert.equal(byProd.length, 1);
  assert.equal(byProd[0]!.salesUnits, 230, "product total = 180+50, not summed days");

  const coverage = snapshotCoverageFromGrain(grains);
  assert.equal(coverage?.fromDate, "2026-08-16");
  assert.equal(coverage?.toDate, "2026-08-17");
  assert.equal(coverage?.priorFromDate, null);
  assert.equal(coverage?.priorToDate, null);
}

// --- DistC with no current-month facts is omitted; A/B still show ---
{
  const facts = [
    fact(distA, productX, aug17, 180),
    fact(distB, productX, aug16, 50),
    fact(distC, productX, jul25, 999), // prior month only
  ];
  const grains = grainsFrom(facts);
  const names = grains.map((g) => g.distributorName).sort();
  assert.deepEqual(names, ["Alpha Dist", "Beta Dist"]);
  assert.equal(
    aggregateDistributorWise(grains).some((r) => r.distributorName === "Gamma Dist"),
    false
  );
}

// --- Prior month: independent latest snapshot per distributor ---
{
  const facts = [
    fact(distA, productX, aug17, 180),
    fact(distA, productX, jul10, 20),
    fact(distA, productX, jul25, 40),
    fact(distB, productX, aug16, 50),
    fact(distB, productX, jul10, 15),
    fact(distB, productX, jul20, 30),
  ];
  const grains = grainsFrom(facts);
  const a = grains.find((g) => g.distributorId === "dist-a")!;
  const b = grains.find((g) => g.distributorId === "dist-b")!;
  assert.equal(a.lmtdSalesUnits, 40, "DistA LMTD from Jul 25, not 20+40");
  assert.equal(toIsoDate(a.lmtdAsOfDate!), "2026-07-25");
  assert.equal(a.lmtdSalesValue, 40 * 100, "LMTD value uses current snapshot S.P");
  assert.equal(b.lmtdSalesUnits, 30, "DistB LMTD from Jul 20, independent of DistA");
  assert.equal(toIsoDate(b.lmtdAsOfDate!), "2026-07-20");

  const coverage = snapshotCoverageFromGrain(grains);
  assert.equal(coverage?.fromDate, "2026-08-16");
  assert.equal(coverage?.toDate, "2026-08-17");
  assert.equal(coverage?.priorFromDate, "2026-07-20");
  assert.equal(coverage?.priorToDate, "2026-07-25");
}

// --- READY SSR required: later fact day without READY sheet is skipped ---
{
  const facts = [
    fact(distA, productX, aug16, 100),
    fact(distA, productX, aug17, 180),
  ];
  const grains = grainsFrom(facts, { ready: [aug16] });
  assert.equal(grains.length, 1);
  assert.equal(grains[0]!.salesUnits, 100);
  assert.equal(toIsoDate(grains[0]!.asOfDate), "2026-08-16");
}

// --- Closing stock: snapshot day (null → 0), not latest-non-null in month ---
{
  const facts = [
    fact(distA, productX, aug16, 100, { closingStock: 250 }),
    fact(distA, productX, aug17, 180, { closingStock: null }),
  ];
  const grains = grainsFrom(facts);
  assert.equal(grains[0]!.salesUnits, 180);
  assert.equal(grains[0]!.closingStockUnits, 0, "null stock on snapshot day → 0");
  assert.equal(grains[0]!.stockValue, 0);
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

  const aug10 = new Date(Date.UTC(2026, 7, 10));
  const facts = [
    fact(distA, productX, aug10, 10, { closingStock: 40 }),
    fact(distA, productY, aug10, 4, { closingStock: 10 }),
    fact(distB, productX, aug10, 6, { closingStock: 5 }),
    fact(distA, productX, jul10, 8),
    fact(distB, productY, aug10, 2, { closingStock: 1 }),
  ];

  const grains = grainsFrom(facts, { targets });

  const byDist = aggregateDistributorWise(grains);
  assert.equal(byDist.length, 2);

  const alpha = byDist.find((r) => r.distributorName === "Alpha Dist")!;
  assert.equal(alpha.city, "Karachi");
  assert.equal(alpha.asOfDate, "2026-08-10");
  assert.equal(alpha.salesUnits, 14); // 10 + 4 on snapshot day
  assert.equal(alpha.lmtdSalesUnits, 8);
  assert.equal(alpha.lmtdAsOfDate, "2026-07-10");
  assert.equal(alpha.targetUnits, 20);
  assert.equal(alpha.targetValue, 20 * 100);
  assert.equal(alpha.salesValue, 10 * 100 + 4 * 50);
  assert.equal(alpha.targetAchvPercent, alpha.salesValue / alpha.targetValue);
  assert.equal(alpha.lmtdPercent, alpha.salesValue / (8 * 100) - 1);
  assert.equal(alpha.closingStockUnits, 50); // 40 + 10
  assert.equal(alpha.stockValue, 40 * 100 + 10 * 50);

  const beta = byDist.find((r) => r.distributorName === "Beta Dist")!;
  assert.equal(beta.salesUnits, 8); // 6 + 2 on same snapshot day
  assert.equal(beta.lmtdSalesUnits, 0);
  assert.equal(beta.lmtdAsOfDate, null);
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
      asOfDate: aug17,
      lmtdAsOfDate: jul25,
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
      asOfDate: aug17,
      lmtdAsOfDate: jul25,
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
  assert.equal(agg!.asOfDate, "2026-08-17");
}

function displayDistributorWise(grains: MonthlyGrainRow[]) {
  return collapseDistributorWiseByName(
    aggregateDistributorWise(filterGrainToLatestDistributorByName(grains))
  );
}

function grainStub(
  distributorId: string,
  distributorName: string,
  asOf: Date,
  salesUnits: number,
  productId = "prod-x"
): MonthlyGrainRow {
  return {
    distributorId,
    distributorName,
    city: "City",
    productId,
    productName: productId,
    asOfDate: asOf,
    lmtdAsOfDate: null,
    sellingPrice: 1,
    targetUnits: 0,
    salesUnits,
    lmtdSalesUnits: 0,
    targetValue: 0,
    salesValue: salesUnits,
    lmtdSalesValue: 0,
    closingStockUnits: 0,
    stockValue: 0,
  };
}

// --- Same distributorId, two current-month snapshots: latest date only ---
{
  const facts = [
    fact(distA, productX, aug14, 2052, { closingStock: 10 }),
    fact(distA, productX, aug16, 2032, { closingStock: 7 }),
  ];
  const grains = grainsFrom(facts);
  assert.equal(grains.length, 1, "grain must not emit a row for 14 Aug when 16 Aug exists");
  assert.equal(toIsoDate(grains[0]!.asOfDate), "2026-08-16");
  assert.equal(grains[0]!.salesUnits, 2032);

  const byDist = displayDistributorWise(grains);
  assert.equal(byDist.length, 1);
  assert.equal(byDist[0]!.asOfDate, "2026-08-16");
  assert.equal(byDist[0]!.salesUnits, 2032, "must be 16th qty, not 2052 and not 2052+2032");
}

// --- Aggregate mixed-date grain for one id: drop older, do not sum ---
{
  const mixed = [
    grainStub("dist-a", "AIM Pharma", aug14, 2052),
    grainStub("dist-a", "AIM Pharma", aug16, 2032),
  ];
  const [agg] = aggregateDistributorWise(mixed);
  assert.equal(agg!.asOfDate, "2026-08-16");
  assert.equal(agg!.salesUnits, 2032);
}

// --- Two distributorIds, same display name: one row, later till date ---
{
  const distAimA = makeDistributor("aim-a", "AIM Pharma", "Hyderabad", {
    territoryId: "terr-aim-a",
    areaId: "area-aim-a",
    regionId: "reg-aim-a",
    zoneId: "zone-aim-a",
  });
  const distAimB = makeDistributor("aim-b", "AIM  pharma", "Hyderabad", {
    territoryId: "terr-aim-b",
    areaId: "area-aim-b",
    regionId: "reg-aim-b",
    zoneId: "zone-aim-b",
  });
  const distHaramA = makeDistributor("haram-a", "Al Haram", "Kohat", {
    territoryId: "terr-h-a",
    areaId: "area-h-a",
    regionId: "reg-h-a",
    zoneId: "zone-h-a",
  });
  const distHaramB = makeDistributor("haram-b", "al haram", "Kohat", {
    territoryId: "terr-h-b",
    areaId: "area-h-b",
    regionId: "reg-h-b",
    zoneId: "zone-h-b",
  });
  const distOther = makeDistributor("other-1", "Beta Dist", "Lahore", {
    territoryId: "terr-o",
    areaId: "area-o",
    regionId: "reg-o",
    zoneId: "zone-o",
  });

  const facts = [
    fact(distAimA, productX, aug14, 2052),
    fact(distAimB, productX, aug16, 2032),
    fact(distHaramA, productX, aug14, 100),
    fact(distHaramB, productX, aug16, 80),
    fact(distOther, productX, aug14, 50),
  ];
  const grains = grainsFrom(facts);
  const byDist = displayDistributorWise(grains);

  assert.equal(byDist.length, 3, "duplicate names collapse; distinct names stay");
  const aim = byDist.find((r) => r.distributorName.toLowerCase().includes("aim"))!;
  assert.equal(aim.asOfDate, "2026-08-16");
  assert.equal(aim.salesUnits, 2032, "units from the 16th row only");
  const haram = byDist.find((r) => r.distributorName.toLowerCase().includes("haram"))!;
  assert.equal(haram.asOfDate, "2026-08-16");
  assert.equal(haram.salesUnits, 80);
  const other = byDist.find((r) => r.distributorName === "Beta Dist")!;
  assert.equal(other.asOfDate, "2026-08-14");
  assert.equal(other.salesUnits, 50);

  const totalUnits = byDist.reduce((sum, r) => sum + r.salesUnits, 0);
  assert.equal(totalUnits, 2032 + 80 + 50, "totals exclude dropped older snapshot rows");

  const remaining = filterGrainToLatestDistributorByName(grains);
  const byProd = aggregateProductWise(remaining);
  assert.equal(byProd.length, 1);
  assert.equal(
    byProd[0]!.salesUnits,
    2032 + 80 + 50,
    "product totals must not double-count duplicate distributor names"
  );
}

console.log("monthly-reports-metrics tests passed");
