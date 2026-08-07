import type {
  SalesBatch,
  Distributor,
  SalesLine,
  Product,
  DailySalesFact,
  Manager,
  DistributorRegion,
  DistributorCountry,
} from "@prisma/client";
import { addDays, addMonths, minDate, startOfMonth, startOfWeek, toIsoDate } from "@/lib/date-utils";

/** Line layout matching Medicronis SSR workbook (Wholeseller / Direct Party sheet). */
export interface SsrLineData {
  partyName: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  value: number;
}

/** Line layout for SSR DATA sheet (phase 1 + computed phase 3 columns). */
export interface SsrDataLine {
  distributorName: string;
  city: string;
  region: string;
  country: string;
  category: string;
  group: string;
  manager: string;
  productName: string;
  sellingPrice: number;
  salesUnits: number;
  salesValue: number;
  /** Sales units on asOfDate − 1 day (same distributor + product). */
  yesterdayUnits: number;
  /** Sales value on asOfDate − 1 day. */
  yesterdaySalesValue: number;
  /** Day: today value − yesterday value; week/month: period total − prior period total. */
  difference: number;
  lmtdSalesUnits: number;
  /** Current LMTD units − prior-month same-window LMTD units. */
  lmtdDifferenceUnits: number;
  lmtdSalesValue: number;
  /** Current LMTD value − prior-month same-window LMTD value. */
  lmtdDifferenceValue: number;
  /** (lmtdDifferenceValue / lmtdSalesValue) when lmtdSalesValue ≠ 0, else "-". */
  lmtdPercent: number | "-";
  closingStock?: number | null;
  stockValue?: number | null;
}

export interface SsrExportMeta {
  batchCode: string;
  distributorName: string;
  distributorCode: string;
  city: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

export type SsrViewTypeLabel = "day" | "week" | "month";

export interface SsrDateRange {
  start: Date;
  end: Date;
}

export interface SsrDateExportMeta {
  reportCode: string;
  asOfDate: Date;
  viewType: SsrViewTypeLabel;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

/** Master data carried on facts (distributor + product relations). */
export type SsrMasters = Record<string, never>;

export type DistributorWithManager = Distributor & { manager: Manager | null };

export interface SsrGridMasters {
  distributors: DistributorWithManager[];
  products: Product[];
}

type BatchWithLines = SalesBatch & {
  distributor: Distributor;
  salesLines: (SalesLine & { product: Product })[];
};

type FactWithRelations = DailySalesFact & {
  distributor: Distributor & { manager: Manager | null };
  product: Product;
};

const REGION_LABELS: Record<DistributorRegion, string> = {
  SOUTH: "South",
  CENTER_1: "Center 1",
  CENTER_2: "Center 2",
  NORTH_1: "North 1",
  NORTH_2: "North 2",
};

const COUNTRY_LABELS: Record<DistributorCountry, string> = {
  PAK_1: "Pak 1",
  PAK_2: "Pak 2",
};

export function formatRegion(region: DistributorRegion | null): string {
  return region ? REGION_LABELS[region] : "";
}

export function formatCountry(country: DistributorCountry | null): string {
  return country ? COUNTRY_LABELS[country] : "";
}

export function buildSsrLines(batch: BatchWithLines): SsrLineData[] {
  const partyName = formatPartyName(batch.distributor.name, batch.distributor.city);

  return batch.salesLines.map((sl) => {
    const quantity = Number(sl.quantity);
    const sellingPrice = sl.unitPrice ? Number(sl.unitPrice) : 0;
    const value = sl.lineTotal ? Number(sl.lineTotal) : quantity * sellingPrice;

    return {
      partyName,
      productName: sl.product.name,
      quantity,
      sellingPrice,
      value,
    };
  });
}

export function buildDateRange(viewType: SsrViewTypeLabel, asOfDate: Date): SsrDateRange {
  switch (viewType) {
    case "week":
      return { start: startOfWeek(asOfDate), end: asOfDate };
    case "month":
      return { start: startOfMonth(asOfDate), end: asOfDate };
    default:
      return { start: asOfDate, end: asOfDate };
  }
}

/** Prior comparison window: day → yesterday; week → same Mon..day shifted −7d; month → same calendar window in prior month. */
export function priorPeriodRange(viewType: SsrViewTypeLabel, asOfDate: Date): SsrDateRange {
  switch (viewType) {
    case "week": {
      const start = startOfWeek(asOfDate);
      return { start: addDays(start, -7), end: addDays(asOfDate, -7) };
    }
    case "month": {
      const start = startOfMonth(asOfDate);
      return { start: addMonths(start, -1), end: addMonths(asOfDate, -1) };
    }
    default: {
      const yesterday = addDays(asOfDate, -1);
      return { start: yesterday, end: yesterday };
    }
  }
}

/** Month-to-date through asOfDate. */
export function lmtdRange(asOfDate: Date): SsrDateRange {
  return { start: startOfMonth(asOfDate), end: asOfDate };
}

/** Same calendar window in the prior month (day clamped to month length). */
export function priorLmtdRange(asOfDate: Date): SsrDateRange {
  return { start: addMonths(startOfMonth(asOfDate), -1), end: addMonths(asOfDate, -1) };
}

/** Single calendar day before asOfDate. */
export function yesterdayRange(asOfDate: Date): SsrDateRange {
  const yesterday = addDays(asOfDate, -1);
  return { start: yesterday, end: yesterday };
}

export interface SsrExportFactBounds {
  min: Date;
  max: Date;
  periodRange: SsrDateRange;
  yesterdayRange: SsrDateRange;
  priorPeriodRange: SsrDateRange;
  lmtdRange: SsrDateRange;
  priorLmtdRange: SsrDateRange;
}

/** Date span for one DailySalesFact query covering all computed SSR columns. */
export function getSsrExportFactBounds(
  viewType: SsrViewTypeLabel,
  asOfDate: Date
): SsrExportFactBounds {
  const periodRange = buildDateRange(viewType, asOfDate);
  const yesterday = yesterdayRange(asOfDate);
  const priorPeriod = priorPeriodRange(viewType, asOfDate);
  const lmtd = lmtdRange(asOfDate);
  const priorLmtd = priorLmtdRange(asOfDate);

  const min = minDate([
    periodRange.start,
    yesterday.start,
    priorPeriod.start,
    lmtd.start,
    priorLmtd.start,
  ]);

  return {
    min,
    max: asOfDate,
    periodRange,
    yesterdayRange: yesterday,
    priorPeriodRange: priorPeriod,
    lmtdRange: lmtd,
    priorLmtdRange: priorLmtd,
  };
}

interface AggTotals {
  salesUnits: number;
  salesValue: number;
}

function factKey(distributorId: string, productId: string): string {
  return `${distributorId}:${productId}`;
}

function factLineValue(fact: FactWithRelations): number {
  const quantity = Number(fact.quantity);
  const unitPrice = fact.unitPrice ? Number(fact.unitPrice) : 0;
  return fact.salesValue ? Number(fact.salesValue) : quantity * unitPrice;
}

function aggregateFactsInRange(
  facts: FactWithRelations[],
  range: SsrDateRange
): Map<string, AggTotals> {
  const groups = new Map<string, AggTotals>();

  for (const fact of facts) {
    const saleTime = fact.saleDate.getTime();
    if (saleTime < range.start.getTime() || saleTime > range.end.getTime()) continue;

    const key = factKey(fact.distributorId, fact.productId);
    const quantity = Number(fact.quantity);
    const lineValue = factLineValue(fact);
    const existing = groups.get(key);

    if (existing) {
      existing.salesUnits += quantity;
      existing.salesValue += lineValue;
    } else {
      groups.set(key, { salesUnits: quantity, salesValue: lineValue });
    }
  }

  return groups;
}

function productDefaultPrice(product: Product): number {
  if (product.newSp != null) return Number(product.newSp);
  if (product.netPrice != null) return Number(product.netPrice);
  if (product.tp != null) return Number(product.tp);
  return 0;
}

function distributorIdsInRange(facts: FactWithRelations[], range: SsrDateRange): string[] {
  const ids = new Set<string>();
  for (const fact of facts) {
    const saleTime = fact.saleDate.getTime();
    if (saleTime >= range.start.getTime() && saleTime <= range.end.getTime()) {
      ids.add(fact.distributorId);
    }
  }
  return Array.from(ids);
}

/** Distributors with facts in range + all active products for SSR grid export. */
export function resolveSsrGridMasters(
  facts: FactWithRelations[],
  range: SsrDateRange,
  masters: SsrGridMasters
): SsrGridMasters {
  const distributorIds = new Set(distributorIdsInRange(facts, range));
  const distributors = masters.distributors.filter((d) => distributorIds.has(d.id));
  return { distributors, products: masters.products };
}

function lookupTotals(map: Map<string, AggTotals>, key: string): AggTotals {
  return map.get(key) ?? { salesUnits: 0, salesValue: 0 };
}

function unitPriceForStock(fact: FactWithRelations | undefined, product: Product): number {
  if (fact?.unitPrice != null) return Number(fact.unitPrice);
  return productDefaultPrice(product);
}

function computeLmtdPercent(lmtdSalesValue: number, lmtdDifferenceValue: number): number | "-" {
  if (lmtdSalesValue === 0) return "-";
  return lmtdDifferenceValue / lmtdSalesValue;
}

/** Latest closing stock on asOfDate per distributor + product (when populated on facts). */
function latestClosingStockByKey(
  facts: FactWithRelations[],
  asOfDate: Date,
  productsById: Map<string, Product>
): Map<string, { closingStock: number; stockValue: number }> {
  const asOfTime = asOfDate.getTime();
  const latest = new Map<string, { closingStock: number; stockValue: number }>();

  for (const fact of facts) {
    if (fact.saleDate.getTime() !== asOfTime || fact.closingStock == null) continue;

    const key = factKey(fact.distributorId, fact.productId);
    const closingStock = Number(fact.closingStock);
    const product = productsById.get(fact.productId);
    const unitPrice = unitPriceForStock(fact, product ?? fact.product);
    latest.set(key, {
      closingStock,
      stockValue: closingStock * unitPrice,
    });
  }

  return latest;
}

export function viewTypeLabel(viewType: SsrViewTypeLabel): string {
  const labels: Record<SsrViewTypeLabel, string> = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
  };
  return labels[viewType];
}

/** Full product master × distributor grid; left-join aggregated facts (zeros where no sale). */
export function buildDataSheetRows(
  facts: FactWithRelations[],
  range: SsrDateRange,
  options: {
    asOfDate?: Date;
    viewType?: SsrViewTypeLabel;
    masters: SsrGridMasters;
  }
): SsrDataLine[] {
  const asOfDate = options.asOfDate ?? range.end;
  const viewType = options.viewType ?? "day";
  const { distributors, products } = resolveSsrGridMasters(facts, range, options.masters);

  if (distributors.length === 0 || products.length === 0) return [];

  const productsById = new Map(products.map((p) => [p.id, p]));
  const periodAgg = aggregateFactsInRange(facts, range);
  const yesterdayAgg = aggregateFactsInRange(facts, yesterdayRange(asOfDate));
  const priorPeriodAgg = aggregateFactsInRange(facts, priorPeriodRange(viewType, asOfDate));
  const lmtdAgg = aggregateFactsInRange(facts, lmtdRange(asOfDate));
  const priorLmtdAgg = aggregateFactsInRange(facts, priorLmtdRange(asOfDate));
  const closingStockByKey = latestClosingStockByKey(facts, asOfDate, productsById);

  const asOfFactByKey = new Map<string, FactWithRelations>();
  const asOfTime = asOfDate.getTime();
  for (const fact of facts) {
    if (fact.saleDate.getTime() === asOfTime) {
      asOfFactByKey.set(factKey(fact.distributorId, fact.productId), fact);
    }
  }

  const rows: SsrDataLine[] = [];

  for (const distributor of distributors) {
    for (const product of products) {
      const key = factKey(distributor.id, product.id);
      const period = lookupTotals(periodAgg, key);
      const salesUnits = period.salesUnits;
      const salesValue = period.salesValue;

      const asOfFact = asOfFactByKey.get(key);
      const defaultPrice = productDefaultPrice(product);
      const sellingPrice =
        salesUnits > 0
          ? salesValue / salesUnits
          : asOfFact?.unitPrice
            ? Number(asOfFact.unitPrice)
            : defaultPrice;

      const yesterday = lookupTotals(yesterdayAgg, key);
      const priorPeriod = lookupTotals(priorPeriodAgg, key);
      const lmtd = lookupTotals(lmtdAgg, key);
      const priorLmtd = lookupTotals(priorLmtdAgg, key);

      const lmtdDifferenceUnits = lmtd.salesUnits - priorLmtd.salesUnits;
      const lmtdDifferenceValue = lmtd.salesValue - priorLmtd.salesValue;

      const difference =
        viewType === "day" ? salesValue - yesterday.salesValue : salesValue - priorPeriod.salesValue;

      const stock = closingStockByKey.get(key);

      rows.push({
        distributorName: distributor.name,
        city: distributor.city ?? "",
        region: formatRegion(distributor.region),
        country: formatCountry(distributor.country),
        category: "",
        group: product.category ?? "",
        manager: distributor.manager?.name ?? "",
        productName: product.name,
        sellingPrice,
        salesUnits,
        salesValue,
        yesterdayUnits: yesterday.salesUnits,
        yesterdaySalesValue: yesterday.salesValue,
        difference,
        lmtdSalesUnits: lmtd.salesUnits,
        lmtdDifferenceUnits,
        lmtdSalesValue: lmtd.salesValue,
        lmtdDifferenceValue,
        lmtdPercent: computeLmtdPercent(lmtd.salesValue, lmtdDifferenceValue),
        closingStock: stock?.closingStock ?? null,
        stockValue: stock?.stockValue ?? null,
      });
    }
  }

  return rows.sort((a, b) => {
    const nameCmp = a.distributorName.localeCompare(b.distributorName);
    if (nameCmp !== 0) return nameCmp;
    return a.productName.localeCompare(b.productName);
  });
}

export function buildSsrDataLines(
  facts: FactWithRelations[],
  masters: SsrGridMasters
): SsrDataLine[] {
  if (facts.length === 0) return [];
  const asOfDate = facts[0]!.saleDate;
  const range = { start: asOfDate, end: asOfDate };
  return buildDataSheetRows(facts, range, { asOfDate, viewType: "day", masters });
}

export function reportCodeFor(asOfDate: Date, viewType: string): string {
  const iso = toIsoDate(asOfDate);
  return `SSR-${viewType}-${iso}`;
}

export function formatPartyName(name: string, city: string | null): string {
  if (city?.trim()) {
    return `${name}, ${city.trim()}`;
  }
  return name;
}

export function formatPeriod(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatSalesTillDate(end: Date): string {
  const dd = String(end.getUTCDate()).padStart(2, "0");
  const mm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(end.getUTCFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
