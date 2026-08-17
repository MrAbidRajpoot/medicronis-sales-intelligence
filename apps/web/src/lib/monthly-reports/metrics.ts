/**
 * Pure monthly-report metrics: grain build + Distributor/Product Wise aggregation.
 * Reuses SSR pricing (resolveSellingPrice), target lookup, and % helpers.
 *
 * Facts are MTD snapshots: DailySalesFact.quantity on saleDate D = month-start through D.
 * Never sum quantities across days in the same month.
 * Each distributor uses its own latest READY SSR asOfDate in the selected month.
 */

import type { DailySalesFact, Distributor, Product } from "@prisma/client";
import { toIsoDate } from "@/lib/date-utils";
import {
  computeLmtdPercent,
  computeTargetAchvPercent,
  lookupTargetUnits,
  resolveSellingPrice,
  type DistributorWithGeo,
} from "@/lib/ssr-data";
import type {
  DistributorWiseRow,
  MonthlyGrainRow,
  MonthlyReportPeriod,
  MonthlySnapshotCoverage,
  ProductWiseRow,
} from "./types";

export type MonthlyFactRow = DailySalesFact & {
  distributor: DistributorWithGeo;
  product: Pick<Product, "id" | "name" | "newSp">;
};

function factKey(distributorId: string, productId: string): string {
  return `${distributorId}:${productId}`;
}

function snapshotFactKey(distributorId: string, productId: string, date: Date): string {
  return `${distributorId}:${productId}:${toIsoDate(date)}`;
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export interface BuildMonthlyGrainOptions {
  /** ISO YYYY-MM-DD of READY SsrReport rows with salesBatchId = null. */
  readyAsOfDates: ReadonlySet<string>;
  targetUnitsByKey?: Map<string, number>;
}

/** Trim, collapse inner whitespace, lower-case — used to treat duplicate master names as one distributor. */
export function normalizeDistributorDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Per-distributor latest saleDate in [start, end] that has facts AND a READY global SSR
 * asOfDate on that calendar day. Distributors with no such day are omitted.
 * Comparison is by ISO YYYY-MM-DD (not raw Date ticks) so time-of-day cannot split a day.
 */
export function latestSnapshotDateByDistributor(
  facts: MonthlyFactRow[],
  start: Date,
  end: Date,
  readyAsOfDates: ReadonlySet<string>
): Map<string, Date> {
  const latest = new Map<string, Date>();
  for (const fact of facts) {
    if (!inRange(fact.saleDate, start, end)) continue;
    const iso = toIsoDate(fact.saleDate);
    if (!readyAsOfDates.has(iso)) continue;
    const prev = latest.get(fact.distributorId);
    if (!prev || iso > toIsoDate(prev)) {
      latest.set(fact.distributorId, fact.saleDate);
    }
  }
  return latest;
}

function indexFactsBySnapshot(facts: MonthlyFactRow[]): Map<string, MonthlyFactRow> {
  const index = new Map<string, MonthlyFactRow>();
  for (const fact of facts) {
    index.set(snapshotFactKey(fact.distributorId, fact.productId, fact.saleDate), fact);
  }
  return index;
}

function minMaxIso(dates: Date[]): { min: string; max: string } | null {
  if (dates.length === 0) return null;
  let minT = dates[0]!.getTime();
  let maxT = minT;
  let minDate = dates[0]!;
  let maxDate = dates[0]!;
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]!;
    const t = d.getTime();
    if (t < minT) {
      minT = t;
      minDate = d;
    }
    if (t > maxT) {
      maxT = t;
      maxDate = d;
    }
  }
  return { min: toIsoDate(minDate), max: toIsoDate(maxDate) };
}

/** Coverage from included distributors' per-row snapshot dates. */
export function snapshotCoverageFromGrain(rows: MonthlyGrainRow[]): MonthlySnapshotCoverage | null {
  if (rows.length === 0) return null;

  const currentByDist = new Map<string, Date>();
  const priorByDist = new Map<string, Date>();
  for (const row of rows) {
    currentByDist.set(row.distributorId, row.asOfDate);
    if (row.lmtdAsOfDate) priorByDist.set(row.distributorId, row.lmtdAsOfDate);
  }

  const current = minMaxIso(Array.from(currentByDist.values()));
  if (!current) return null;
  const prior = minMaxIso(Array.from(priorByDist.values()));

  return {
    fromDate: current.min,
    toDate: current.max,
    priorFromDate: prior?.min ?? null,
    priorToDate: prior?.max ?? null,
  };
}

/**
 * Build distributor×product grain rows from each included distributor's latest READY SSR
 * snapshot in the current month (and independently in the prior month for LMTD).
 * Distributors with no usable current-month snapshot are omitted entirely.
 */
export function buildMonthlyGrainRows(
  facts: MonthlyFactRow[],
  period: MonthlyReportPeriod,
  options: BuildMonthlyGrainOptions
): MonthlyGrainRow[] {
  const { readyAsOfDates, targetUnitsByKey } = options;
  const latestCurrent = latestSnapshotDateByDistributor(
    facts,
    period.monthStart,
    period.monthEnd,
    readyAsOfDates
  );
  const latestPrior = latestSnapshotDateByDistributor(
    facts,
    period.priorMonthStart,
    period.priorMonthEnd,
    readyAsOfDates
  );

  if (latestCurrent.size === 0) return [];

  const factBySnapshot = indexFactsBySnapshot(facts);
  const keys = new Set<string>();
  const metaByKey = new Map<
    string,
    {
      distributor: DistributorWithGeo;
      product: Pick<Product, "id" | "name" | "newSp">;
    }
  >();

  for (const fact of facts) {
    const currentAsOf = latestCurrent.get(fact.distributorId);
    if (!currentAsOf) continue;
    const priorAsOf = latestPrior.get(fact.distributorId);
    const iso = toIsoDate(fact.saleDate);
    const onCurrent = iso === toIsoDate(currentAsOf);
    const onPrior = priorAsOf != null && iso === toIsoDate(priorAsOf);
    if (!onCurrent && !onPrior) continue;

    const key = factKey(fact.distributorId, fact.productId);
    keys.add(key);
    if (!metaByKey.has(key)) {
      metaByKey.set(key, { distributor: fact.distributor, product: fact.product });
    }
  }

  const rows: MonthlyGrainRow[] = [];

  for (const key of Array.from(keys)) {
    const meta = metaByKey.get(key);
    if (!meta) continue;

    const { distributor, product } = meta;
    const asOfDate = latestCurrent.get(distributor.id);
    if (!asOfDate) continue;
    const lmtdAsOfDate = latestPrior.get(distributor.id) ?? null;

    const currentFact = factBySnapshot.get(snapshotFactKey(distributor.id, product.id, asOfDate));
    const priorFact =
      lmtdAsOfDate != null
        ? factBySnapshot.get(snapshotFactKey(distributor.id, product.id, lmtdAsOfDate))
        : undefined;

    const salesUnits = currentFact ? Number(currentFact.quantity) : 0;
    const lmtdSalesUnits = priorFact ? Number(priorFact.quantity) : 0;
    const sellingPrice = resolveSellingPrice(product, currentFact);
    const salesValue = salesUnits * sellingPrice;
    const lmtdSalesValue = lmtdSalesUnits * sellingPrice;

    const targetUnits = lookupTargetUnits(
      targetUnitsByKey,
      product.id,
      distributor as Pick<Distributor, "territoryId" | "areaId" | "regionId" | "zoneId">
    );
    const targetValue = targetUnits * sellingPrice;

    const closingStockUnits =
      currentFact?.closingStock != null ? Number(currentFact.closingStock) : 0;
    const stockValue = closingStockUnits * sellingPrice;

    rows.push({
      distributorId: distributor.id,
      distributorName: distributor.name,
      city: distributor.territory?.name ?? "",
      productId: product.id,
      productName: product.name,
      asOfDate,
      lmtdAsOfDate,
      sellingPrice,
      targetUnits,
      salesUnits,
      lmtdSalesUnits,
      targetValue,
      salesValue,
      lmtdSalesValue,
      closingStockUnits,
      stockValue,
    });
  }

  return rows.sort((a, b) => {
    const d = a.distributorName.localeCompare(b.distributorName);
    if (d !== 0) return d;
    return a.productName.localeCompare(b.productName);
  });
}

/**
 * Keep only grain for the winning distributorId per normalized display name
 * (later asOfDate wins; older snapshot for a duplicate master name is dropped, not summed).
 */
export function filterGrainToLatestDistributorByName(rows: MonthlyGrainRow[]): MonthlyGrainRow[] {
  const latestById = new Map<string, { name: string; asOfIso: string }>();
  for (const row of rows) {
    const asOfIso = toIsoDate(row.asOfDate);
    const prev = latestById.get(row.distributorId);
    if (!prev || asOfIso > prev.asOfIso) {
      latestById.set(row.distributorId, { name: row.distributorName, asOfIso });
    }
  }

  const winnerIdByName = new Map<string, { id: string; asOfIso: string }>();
  for (const [id, meta] of latestById) {
    const nameKey = normalizeDistributorDisplayName(meta.name);
    const existing = winnerIdByName.get(nameKey);
    if (!existing || meta.asOfIso > existing.asOfIso) {
      winnerIdByName.set(nameKey, { id, asOfIso: meta.asOfIso });
    }
  }

  const keepIds = new Set(Array.from(winnerIdByName.values()).map((w) => w.id));
  return rows.filter((row) => keepIds.has(row.distributorId));
}

/**
 * One display row per normalized distributor name. Later asOfDate (ISO YYYY-MM-DD) wins;
 * the older row is dropped entirely (never 14th + 16th).
 */
export function collapseDistributorWiseByName(rows: DistributorWiseRow[]): DistributorWiseRow[] {
  const byName = new Map<string, DistributorWiseRow>();
  for (const row of rows) {
    const key = normalizeDistributorDisplayName(row.distributorName);
    const existing = byName.get(key);
    if (!existing || row.asOfDate > existing.asOfDate) {
      byName.set(key, row);
    }
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.distributorName.localeCompare(b.distributorName)
  );
}

/** Roll grain rows up to one row per distributorId (sums on that id's latest asOfDate only). */
export function aggregateDistributorWise(rows: MonthlyGrainRow[]): DistributorWiseRow[] {
  type Acc = {
    distributorName: string;
    city: string;
    asOfDate: Date;
    lmtdAsOfDate: Date | null;
    targetUnits: number;
    salesUnits: number;
    lmtdSalesUnits: number;
    targetValue: number;
    salesValue: number;
    lmtdSalesValue: number;
    closingStockUnits: number;
    stockValue: number;
  };

  const latestIsoById = new Map<string, string>();
  for (const row of rows) {
    const iso = toIsoDate(row.asOfDate);
    const prev = latestIsoById.get(row.distributorId);
    if (!prev || iso > prev) latestIsoById.set(row.distributorId, iso);
  }

  const byDistributor = new Map<string, Acc>();

  for (const row of rows) {
    const latestIso = latestIsoById.get(row.distributorId);
    if (toIsoDate(row.asOfDate) !== latestIso) continue;

    const existing = byDistributor.get(row.distributorId);
    if (existing) {
      existing.targetUnits += row.targetUnits;
      existing.salesUnits += row.salesUnits;
      existing.lmtdSalesUnits += row.lmtdSalesUnits;
      existing.targetValue += row.targetValue;
      existing.salesValue += row.salesValue;
      existing.lmtdSalesValue += row.lmtdSalesValue;
      existing.closingStockUnits += row.closingStockUnits;
      existing.stockValue += row.stockValue;
    } else {
      byDistributor.set(row.distributorId, {
        distributorName: row.distributorName,
        city: row.city,
        asOfDate: row.asOfDate,
        lmtdAsOfDate: row.lmtdAsOfDate,
        targetUnits: row.targetUnits,
        salesUnits: row.salesUnits,
        lmtdSalesUnits: row.lmtdSalesUnits,
        targetValue: row.targetValue,
        salesValue: row.salesValue,
        lmtdSalesValue: row.lmtdSalesValue,
        closingStockUnits: row.closingStockUnits,
        stockValue: row.stockValue,
      });
    }
  }

  return Array.from(byDistributor.values())
    .map((acc) => ({
      distributorName: acc.distributorName,
      city: acc.city,
      asOfDate: toIsoDate(acc.asOfDate),
      lmtdAsOfDate: acc.lmtdAsOfDate ? toIsoDate(acc.lmtdAsOfDate) : null,
      targetUnits: acc.targetUnits,
      salesUnits: acc.salesUnits,
      lmtdSalesUnits: acc.lmtdSalesUnits,
      targetValue: acc.targetValue,
      salesValue: acc.salesValue,
      targetAchvPercent: computeTargetAchvPercent(acc.salesValue, acc.targetValue),
      lmtdSalesValue: acc.lmtdSalesValue,
      lmtdPercent: computeLmtdPercent(acc.salesValue, acc.lmtdSalesValue),
      closingStockUnits: acc.closingStockUnits,
      stockValue: acc.stockValue,
    }))
    .sort((a, b) => a.distributorName.localeCompare(b.distributorName));
}

/** Roll grain rows up to one row per product (sums; percents from totals). */
export function aggregateProductWise(rows: MonthlyGrainRow[]): ProductWiseRow[] {
  type Acc = {
    productName: string;
    targetUnits: number;
    salesUnits: number;
    lmtdSalesUnits: number;
    targetValue: number;
    salesValue: number;
    lmtdSalesValue: number;
    stockUnits: number;
    stockValue: number;
  };

  const byProduct = new Map<string, Acc>();

  for (const row of rows) {
    const existing = byProduct.get(row.productId);
    if (existing) {
      existing.targetUnits += row.targetUnits;
      existing.salesUnits += row.salesUnits;
      existing.lmtdSalesUnits += row.lmtdSalesUnits;
      existing.targetValue += row.targetValue;
      existing.salesValue += row.salesValue;
      existing.lmtdSalesValue += row.lmtdSalesValue;
      existing.stockUnits += row.closingStockUnits;
      existing.stockValue += row.stockValue;
    } else {
      byProduct.set(row.productId, {
        productName: row.productName,
        targetUnits: row.targetUnits,
        salesUnits: row.salesUnits,
        lmtdSalesUnits: row.lmtdSalesUnits,
        targetValue: row.targetValue,
        salesValue: row.salesValue,
        lmtdSalesValue: row.lmtdSalesValue,
        stockUnits: row.closingStockUnits,
        stockValue: row.stockValue,
      });
    }
  }

  return Array.from(byProduct.values())
    .map((acc) => ({
      productName: acc.productName,
      targetUnits: acc.targetUnits,
      salesUnits: acc.salesUnits,
      lmtdSalesUnits: acc.lmtdSalesUnits,
      targetValue: acc.targetValue,
      salesValue: acc.salesValue,
      targetAchvPercent: computeTargetAchvPercent(acc.salesValue, acc.targetValue),
      lmtdSalesValue: acc.lmtdSalesValue,
      lmtdPercent: computeLmtdPercent(acc.salesValue, acc.lmtdSalesValue),
      stockUnits: acc.stockUnits,
      stockValue: acc.stockValue,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}
