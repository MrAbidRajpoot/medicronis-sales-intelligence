import type {
  SalesBatch,
  Distributor,
  SalesLine,
  Product,
  ProductGroup,
  DailySalesFact,
  Manager,
  Territory,
  Area,
  Region,
  Zone,
} from "@prisma/client";
import {
  addDays,
  minDate,
  sameDayPriorMonth,
  toIsoDate,
} from "@/lib/date-utils";
import { resolveDistributorManagerName } from "@/lib/manager-helpers";

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
  territory: string;
  area: string;
  region: string;
  zone: string;
  category: string;
  group: string;
  manager: string;
  productName: string;
  sellingPrice: number;
  salesUnits: number;
  salesValue: number;
  /** Prior calendar day units (Yesterday column). */
  yesterdayUnits: number;
  /** Prior comparison units × resolved selling price. */
  yesterdaySalesValue: number;
  /** Current period sales value − prior comparison value. */
  difference: number;
  /** Assigned ProductTarget.quantity for product + month + geo; 0 if none. */
  targetUnits: number;
  /** targetUnits × selling price (S.P). */
  targetValue: number;
  /** salesValue / targetValue when targetValue ≠ 0, else "-". */
  targetAchvPercent: number | "-";
  lmtdSalesUnits: number;
  /** Current period units − same-day-prior-month units. */
  lmtdDifferenceUnits: number;
  lmtdSalesValue: number;
  /** Current period value − same-day-prior-month value. */
  lmtdDifferenceValue: number;
  /** (salesValue / lmtdSalesValue − 1) when lmtdSalesValue ≠ 0, else "-". */
  lmtdPercent: number | "-";
  closingStock: number | null;
  stockValue: number | null;
  inventory: number;
  order: number;
  orderValue: number;
  excessStock: number;
  excessStockValue: number;
  inventoryValue: number;
}

export type SsrCellKind = "units" | "money" | "percent" | "closingStock";

export interface SsrDataColumn {
  label: string;
  key: keyof SsrDataLine;
  kind: SsrCellKind | "text";
}

/** Single source of truth for DATA sheet column order and labels (export + preview). */
export const DATA_COLUMNS: readonly SsrDataColumn[] = [
  { label: "Distributor Name", key: "distributorName", kind: "text" },
  { label: "Territory", key: "territory", kind: "text" },
  { label: "Area", key: "area", kind: "text" },
  { label: "Region", key: "region", kind: "text" },
  { label: "Zone", key: "zone", kind: "text" },
  { label: "Category", key: "category", kind: "text" },
  { label: "Group", key: "group", kind: "text" },
  { label: "Manager", key: "manager", kind: "text" },
  { label: "Product Name", key: "productName", kind: "text" },
  { label: "S.P", key: "sellingPrice", kind: "money" },
  { label: "Sales Units", key: "salesUnits", kind: "units" },
  { label: "Closing Stock", key: "closingStock", kind: "closingStock" },
  { label: "Sales Value", key: "salesValue", kind: "money" },
  { label: "Stock Value", key: "stockValue", kind: "money" },
  { label: "Yesterday", key: "yesterdayUnits", kind: "units" },
  { label: "Yesterday Sale Value", key: "yesterdaySalesValue", kind: "money" },
  { label: "Difference", key: "difference", kind: "money" },
  { label: "Target Units", key: "targetUnits", kind: "units" },
  { label: "Target Value", key: "targetValue", kind: "money" },
  { label: "Target Achv. %", key: "targetAchvPercent", kind: "percent" },
  { label: "LMTD Sales Unit", key: "lmtdSalesUnits", kind: "units" },
  { label: "LMTD Difference", key: "lmtdDifferenceUnits", kind: "units" },
  { label: "LMTD Sales Value", key: "lmtdSalesValue", kind: "money" },
  { label: "LMTD Difference", key: "lmtdDifferenceValue", kind: "money" },
  { label: "LMTD %age", key: "lmtdPercent", kind: "percent" },
  { label: "Inventory", key: "inventory", kind: "units" },
  { label: "Order", key: "order", kind: "units" },
  { label: "Order Value", key: "orderValue", kind: "money" },
  { label: "Excess Stock", key: "excessStock", kind: "units" },
  { label: "Excess Stock Value", key: "excessStockValue", kind: "money" },
  { label: "Inventory Value", key: "inventoryValue", kind: "money" },
];

export const DATA_HEADERS: readonly string[] = DATA_COLUMNS.map((c) => c.label);

/** Apply the workbook's display conventions to SSR values shown in the UI. */
export function formatSsrCell(
  value: number | null | "-",
  kind: SsrCellKind
): string {
  if (kind === "percent") {
    return value === "-" || value == null ? "-" : `${(value * 100).toFixed(2)}%`;
  }
  if (kind === "closingStock" && value == null) return "—";
  const numericValue = typeof value === "number" ? value : 0;
  if (kind === "money") {
    return numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return numericValue.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Render one DATA line cell for its column; unset text and optional numerics show as "—". */
export function formatSsrDataCell(line: SsrDataLine, column: SsrDataColumn): string {
  const value = line[column.key];
  if (column.kind === "text") return typeof value === "string" && value ? value : "—";
  if (value == null) return "—";
  return formatSsrCell(value as number | "-", column.kind);
}

export interface SsrExportMeta {
  batchCode: string;
  distributorName: string;
  distributorCode: string;
  territory: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

export interface SsrDateRange {
  start: Date;
  end: Date;
}

export interface SsrDateExportMeta {
  reportCode: string;
  asOfDate: Date;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

/** Master data carried on facts (distributor + product relations). */
export type SsrMasters = Record<string, never>;

export type DistributorWithGeo = Distributor & {
  territory: (Territory & { manager: Manager | null }) | null;
  area: (Area & { manager: Manager | null }) | null;
  region: (Region & { manager: Manager | null }) | null;
  zone: (Zone & { manager: Manager | null }) | null;
};

/** @deprecated Use DistributorWithGeo */
export type DistributorWithManager = DistributorWithGeo;

export type ProductWithGroup = Product & { productGroup: ProductGroup | null };

export interface SsrGridMasters {
  distributors: DistributorWithGeo[];
  products: ProductWithGroup[];
}

type BatchWithLines = SalesBatch & {
  distributor: DistributorWithGeo;
  salesLines: (SalesLine & { product: Product })[];
};

type FactWithRelations = DailySalesFact & {
  distributor: DistributorWithGeo;
  product: Product;
};

export function buildSsrLines(batch: BatchWithLines): SsrLineData[] {
  const partyName = formatPartyName(batch.distributor.name, batch.distributor.territory?.name ?? null);

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

/**
 * SSR period is always the single asOfDate.
 * Facts for that date already carry till-date quantities from the distributor PDF
 * (not daily increments), so we do not sum startOfMonth..asOfDate.
 */
export function buildDateRange(asOfDate: Date): SsrDateRange {
  return { start: asOfDate, end: asOfDate };
}

/** Prior comparison window: previous calendar day (Yesterday column). */
export function priorPeriodRange(asOfDate: Date): SsrDateRange {
  const yesterday = addDays(asOfDate, -1);
  return { start: yesterday, end: yesterday };
}

export interface SsrExportFactBounds {
  min: Date;
  max: Date;
  periodRange: SsrDateRange;
  priorPeriodRange: SsrDateRange;
  lmtdDate: Date;
}

/** Date span for one DailySalesFact query covering all computed SSR columns. */
export function getSsrExportFactBounds(asOfDate: Date): SsrExportFactBounds {
  const periodRange = buildDateRange(asOfDate);
  const priorPeriod = priorPeriodRange(asOfDate);
  const lmtdDate = sameDayPriorMonth(asOfDate);

  const min = minDate([
    periodRange.start,
    priorPeriod.start,
    lmtdDate,
  ]);

  return {
    min,
    max: asOfDate,
    periodRange,
    priorPeriodRange: priorPeriod,
    lmtdDate,
  };
}

interface AggTotals {
  salesUnits: number;
}

function factKey(distributorId: string, productId: string): string {
  return `${distributorId}:${productId}`;
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
    const existing = groups.get(key);

    if (existing) {
      existing.salesUnits += quantity;
    } else {
      groups.set(key, { salesUnits: quantity });
    }
  }

  return groups;
}

export function resolveSellingPrice(
  product: Pick<Product, "newSp">,
  asOfFact: Pick<DailySalesFact, "unitPrice"> | undefined
): number {
  if (product.newSp != null) return Number(product.newSp);
  if (asOfFact?.unitPrice != null) return Number(asOfFact.unitPrice);
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
  return map.get(key) ?? { salesUnits: 0 };
}

/** (salesValue / lmtdSalesValue − 1) when lmtdSalesValue ≠ 0, else "-". Shared by SSR and monthly reports. */
export function computeLmtdPercent(salesValue: number, lmtdSalesValue: number): number | "-" {
  if (lmtdSalesValue === 0) return "-";
  return salesValue / lmtdSalesValue - 1;
}

/** Achievement ratio (Sales Value ÷ Target Value); "-" when no target value. */
export function computeTargetAchvPercent(salesValue: number, targetValue: number): number | "-" {
  if (targetValue === 0) return "-";
  return salesValue / targetValue;
}

export function lookupTargetUnits(
  targetUnitsByKey: Map<string, number> | undefined,
  productId: string,
  distributor: Pick<Distributor, "territoryId" | "areaId" | "regionId" | "zoneId">
): number {
  if (!targetUnitsByKey) return 0;
  const { territoryId, areaId, regionId, zoneId } = distributor;
  if (!territoryId || !areaId || !regionId || !zoneId) return 0;
  return targetUnitsByKey.get(`${productId}|${territoryId}|${areaId}|${regionId}|${zoneId}`) ?? 0;
}

/** Latest closing stock on asOfDate per distributor + product (when populated on facts). */
function latestClosingStockByKey(
  facts: FactWithRelations[],
  asOfDate: Date
): Map<string, number> {
  const asOfTime = asOfDate.getTime();
  const latest = new Map<string, number>();

  for (const fact of facts) {
    if (fact.saleDate.getTime() !== asOfTime || fact.closingStock == null) continue;

    const key = factKey(fact.distributorId, fact.productId);
    latest.set(key, Number(fact.closingStock));
  }

  return latest;
}

/** Full product master × distributor grid; left-join aggregated facts (zeros where no sale). */
export function buildDataSheetRows(
  facts: FactWithRelations[],
  range: SsrDateRange,
  options: {
    asOfDate?: Date;
    masters: SsrGridMasters;
    /** productId|territoryId|areaId|regionId|zoneId → target quantity for asOfDate's month. */
    targetUnitsByKey?: Map<string, number>;
  }
): SsrDataLine[] {
  const asOfDate = options.asOfDate ?? range.end;
  const { distributors, products } = resolveSsrGridMasters(facts, range, options.masters);

  if (distributors.length === 0 || products.length === 0) return [];

  const periodAgg = aggregateFactsInRange(facts, range);
  const priorPeriodAgg = aggregateFactsInRange(facts, priorPeriodRange(asOfDate));
  const lmtdDate = sameDayPriorMonth(asOfDate);
  const lmtdAgg = aggregateFactsInRange(facts, { start: lmtdDate, end: lmtdDate });
  const closingStockByKey = latestClosingStockByKey(facts, asOfDate);

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

      const asOfFact = asOfFactByKey.get(key);
      const sellingPrice = resolveSellingPrice(product, asOfFact);
      const salesValue = salesUnits * sellingPrice;

      const comparison = lookupTotals(priorPeriodAgg, key);
      const yesterdayUnits = comparison.salesUnits;
      const yesterdaySalesValue = yesterdayUnits * sellingPrice;
      const lmtd = lookupTotals(lmtdAgg, key);
      const lmtdSalesUnits = lmtd.salesUnits;
      const lmtdSalesValue = lmtdSalesUnits * sellingPrice;
      const lmtdDifferenceUnits = salesUnits - lmtdSalesUnits;
      const lmtdDifferenceValue = salesValue - lmtdSalesValue;
      const difference = salesValue - yesterdaySalesValue;

      const targetUnits = lookupTargetUnits(options.targetUnitsByKey, product.id, distributor);
      const targetValue = targetUnits * sellingPrice;
      const targetAchvPercent = computeTargetAchvPercent(salesValue, targetValue);

      const closingStock = closingStockByKey.get(key) ?? null;
      const stockValue = closingStock == null ? null : closingStock * sellingPrice;
      const inventory = salesUnits * 1.5;
      // Missing closing stock is displayed as "—", but Excel-style comparisons treat it as zero.
      const closingStockForComparison = closingStock ?? 0;
      const order =
        inventory > closingStockForComparison ? inventory - closingStockForComparison : 0;
      const excessStock =
        inventory < closingStockForComparison ? closingStockForComparison - inventory : 0;

      rows.push({
        distributorName: distributor.name,
        territory: distributor.territory?.name ?? "",
        area: distributor.area?.name ?? "",
        region: distributor.region?.name ?? "",
        zone: distributor.zone?.name ?? "",
        category: "Distributor",
        group: product.productGroup?.name ?? "",
        manager: resolveDistributorManagerName(distributor) ?? "",
        productName: product.name,
        sellingPrice,
        salesUnits,
        salesValue,
        yesterdayUnits,
        yesterdaySalesValue,
        difference,
        targetUnits,
        targetValue,
        targetAchvPercent,
        lmtdSalesUnits,
        lmtdDifferenceUnits,
        lmtdSalesValue,
        lmtdDifferenceValue,
        lmtdPercent: computeLmtdPercent(salesValue, lmtdSalesValue),
        closingStock,
        stockValue,
        inventory,
        order,
        orderValue: order * sellingPrice,
        excessStock,
        excessStockValue: excessStock * sellingPrice,
        inventoryValue: inventory * sellingPrice,
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
  return buildDataSheetRows(facts, range, { asOfDate, masters });
}

export function reportCodeFor(asOfDate: Date): string {
  return `SSR-${toIsoDate(asOfDate)}`;
}

export function formatPartyName(name: string, territory: string | null): string {
  if (territory?.trim()) {
    return `${name}, ${territory.trim()}`;
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
