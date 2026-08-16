/**
 * Pure monthly-report metrics: grain build + Distributor/Product Wise aggregation.
 * Reuses SSR pricing (resolveSellingPrice), target lookup, and % helpers.
 * LMTD here = full prior calendar month (NOT SSR same-day-prior-month).
 */

import type { DailySalesFact, Distributor, Product } from "@prisma/client";
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
  ProductWiseRow,
} from "./types";

export type MonthlyFactRow = DailySalesFact & {
  distributor: DistributorWithGeo;
  product: Pick<Product, "id" | "name" | "newSp">;
};

function factKey(distributorId: string, productId: string): string {
  return `${distributorId}:${productId}`;
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

interface AggUnits {
  salesUnits: number;
}

function aggregateUnitsInRange(
  facts: MonthlyFactRow[],
  start: Date,
  end: Date
): Map<string, AggUnits> {
  const groups = new Map<string, AggUnits>();
  for (const fact of facts) {
    if (!inRange(fact.saleDate, start, end)) continue;
    const key = factKey(fact.distributorId, fact.productId);
    const quantity = Number(fact.quantity);
    const existing = groups.get(key);
    if (existing) existing.salesUnits += quantity;
    else groups.set(key, { salesUnits: quantity });
  }
  return groups;
}

/**
 * Latest non-null closingStock per distributor×product within [monthStart, monthEnd].
 * Unlike SSR (which looks only at asOfDate), monthly reports use the last stock day in the month.
 */
export function latestClosingStockInMonth(
  facts: MonthlyFactRow[],
  monthStart: Date,
  monthEnd: Date
): Map<string, number> {
  const latestDate = new Map<string, number>();
  const latestStock = new Map<string, number>();

  for (const fact of facts) {
    if (fact.closingStock == null) continue;
    if (!inRange(fact.saleDate, monthStart, monthEnd)) continue;

    const key = factKey(fact.distributorId, fact.productId);
    const saleTime = fact.saleDate.getTime();
    const prev = latestDate.get(key);
    if (prev == null || saleTime >= prev) {
      latestDate.set(key, saleTime);
      latestStock.set(key, Number(fact.closingStock));
    }
  }

  return latestStock;
}

/** Latest fact in current month (for unitPrice fallback when product.newSp is null). */
function latestFactInMonthByKey(
  facts: MonthlyFactRow[],
  monthStart: Date,
  monthEnd: Date
): Map<string, MonthlyFactRow> {
  const latest = new Map<string, MonthlyFactRow>();
  for (const fact of facts) {
    if (!inRange(fact.saleDate, monthStart, monthEnd)) continue;
    const key = factKey(fact.distributorId, fact.productId);
    const prev = latest.get(key);
    if (!prev || fact.saleDate.getTime() >= prev.saleDate.getTime()) {
      latest.set(key, fact);
    }
  }
  return latest;
}

/**
 * Build distributor×product grain rows for the monthly period.
 * Keys = union of current-month and prior-month fact pairs (after query filters).
 */
export function buildMonthlyGrainRows(
  facts: MonthlyFactRow[],
  period: MonthlyReportPeriod,
  targetUnitsByKey?: Map<string, number>
): MonthlyGrainRow[] {
  const currentAgg = aggregateUnitsInRange(facts, period.monthStart, period.monthEnd);
  const lmtdAgg = aggregateUnitsInRange(facts, period.priorMonthStart, period.priorMonthEnd);
  const closingStockByKey = latestClosingStockInMonth(facts, period.monthStart, period.monthEnd);
  const latestFactByKey = latestFactInMonthByKey(facts, period.monthStart, period.monthEnd);

  const keys = new Set<string>([
    ...Array.from(currentAgg.keys()),
    ...Array.from(lmtdAgg.keys()),
  ]);
  // Include keys that only have closing stock in the current month (no sales either month).
  for (const key of Array.from(closingStockByKey.keys())) keys.add(key);

  const metaByKey = new Map<
    string,
    {
      distributor: DistributorWithGeo;
      product: Pick<Product, "id" | "name" | "newSp">;
    }
  >();
  for (const fact of facts) {
    const key = factKey(fact.distributorId, fact.productId);
    if (!keys.has(key) || metaByKey.has(key)) continue;
    metaByKey.set(key, { distributor: fact.distributor, product: fact.product });
  }

  const rows: MonthlyGrainRow[] = [];

  for (const key of Array.from(keys)) {
    const meta = metaByKey.get(key);
    if (!meta) continue;

    const { distributor, product } = meta;
    const salesUnits = currentAgg.get(key)?.salesUnits ?? 0;
    const lmtdSalesUnits = lmtdAgg.get(key)?.salesUnits ?? 0;
    const asOfFact = latestFactByKey.get(key);
    const sellingPrice = resolveSellingPrice(product, asOfFact);
    const salesValue = salesUnits * sellingPrice;
    const lmtdSalesValue = lmtdSalesUnits * sellingPrice;

    const targetUnits = lookupTargetUnits(
      targetUnitsByKey,
      product.id,
      distributor as Pick<Distributor, "territoryId" | "areaId" | "regionId" | "zoneId">
    );
    const targetValue = targetUnits * sellingPrice;

    const closingStockUnits = closingStockByKey.get(key) ?? 0;
    const stockValue = closingStockUnits * sellingPrice;

    rows.push({
      distributorId: distributor.id,
      distributorName: distributor.name,
      city: distributor.territory?.name ?? "",
      productId: product.id,
      productName: product.name,
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

/** Roll grain rows up to one row per distributor (sums; percents from totals). */
export function aggregateDistributorWise(rows: MonthlyGrainRow[]): DistributorWiseRow[] {
  type Acc = {
    distributorName: string;
    city: string;
    targetUnits: number;
    salesUnits: number;
    lmtdSalesUnits: number;
    targetValue: number;
    salesValue: number;
    lmtdSalesValue: number;
    closingStockUnits: number;
    stockValue: number;
  };

  const byDistributor = new Map<string, Acc>();

  for (const row of rows) {
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
